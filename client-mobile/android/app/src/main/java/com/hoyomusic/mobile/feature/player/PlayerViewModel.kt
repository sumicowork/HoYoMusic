package com.hoyomusic.mobile.feature.player

import android.content.Context
import android.content.Intent
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.Player
import com.hoyomusic.mobile.core.common.UiMessageBus
import com.hoyomusic.mobile.core.common.StreamUrlResolver
import com.hoyomusic.mobile.core.model.Track
import com.hoyomusic.mobile.core.player.AudioFocusController
import com.hoyomusic.mobile.core.player.PlayMode
import com.hoyomusic.mobile.core.player.PlaybackMediaSessionManager
import com.hoyomusic.mobile.core.player.PlaybackNotificationActions
import com.hoyomusic.mobile.core.player.PlaybackPreloadManager
import com.hoyomusic.mobile.core.player.PlaybackReporter
import com.hoyomusic.mobile.core.player.PlaybackService
import com.hoyomusic.mobile.core.player.PlaybackFailureTracker
import com.hoyomusic.mobile.core.player.PlayerEngine
import com.hoyomusic.mobile.core.player.PlayerQueueManager
import com.hoyomusic.mobile.core.player.PlayerUiState
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

@HiltViewModel
class PlayerViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val playerEngine: PlayerEngine,
    private val streamUrlResolver: StreamUrlResolver,
    private val queueManager: PlayerQueueManager,
    private val playbackReporter: PlaybackReporter,
    private val preloadManager: PlaybackPreloadManager,
    private val mediaSessionManager: PlaybackMediaSessionManager,
    private val audioFocusController: AudioFocusController,
    private val uiMessageBus: UiMessageBus,
    private val failureTracker: PlaybackFailureTracker
) : ViewModel() {

    private val _uiState = MutableStateFlow(PlayerUiState())
    val uiState: StateFlow<PlayerUiState> = _uiState.asStateFlow()

    private val listener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) {
            _uiState.value = _uiState.value.copy(isPlaying = isPlaying)
        }

        override fun onPlaybackStateChanged(playbackState: Int) {
            if (playbackState == Player.STATE_ENDED) {
                reportCurrentProgress(force = true)
                playNext(autoTriggered = true)
            }
        }

        override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
            val current = _uiState.value.currentTrack
            if (current != null) {
                val failures = failureTracker.onFailure()
                val failedSet = _uiState.value.failedTrackIds + current.id
                _uiState.value = _uiState.value.copy(
                    errorMessage = if (failures >= 3) "连续播放失败，已暂停" else "播放失败，自动切换下一首",
                    failedTrackIds = failedSet
                )
                if (failures >= 3) {
                    pause()
                    uiMessageBus.push("已触发熔断，请稍后重试")
                } else {
                    playNext(autoTriggered = true)
                }
            } else {
                _uiState.value = _uiState.value.copy(errorMessage = error.message)
            }
        }
    }

    private var progressJob: Job? = null

    init {
        playerEngine.addListener(listener)
        mediaSessionManager.attach(playerEngine)
        startProgressTicker()
    }

    fun setQueue(playlist: List<Track>, startTrack: Track? = null, autoPlay: Boolean = false) {
        val start = startTrack ?: playlist.firstOrNull()
        _uiState.value = _uiState.value.copy(
            playlist = playlist,
            currentTrack = start,
            errorMessage = null
        )
        if (autoPlay && start != null) {
            playTrack(start)
        }
    }

    fun playTrack(track: Track) {
        val hasFocus = audioFocusController.request(
            onLoss = { canDuck ->
                if (canDuck) {
                    playerEngine.player.volume = 0.3f
                    _uiState.value = _uiState.value.copy(audioFocusState = "duck")
                } else {
                    pause()
                    _uiState.value = _uiState.value.copy(audioFocusState = "loss")
                }
            },
            onGain = {
                playerEngine.player.volume = 1f
                _uiState.value = _uiState.value.copy(audioFocusState = "normal")
            }
        )
        if (!hasFocus) {
            uiMessageBus.push("音频焦点不可用")
            return
        }

        val state = _uiState.value
        val ensuredPlaylist = if (state.playlist.any { it.id == track.id }) state.playlist else state.playlist + track
        _uiState.value = state.copy(playlist = ensuredPlaylist, currentTrack = track, errorMessage = null)
        failureTracker.reset()
        playerEngine.setAndPlay(streamUrlResolver.publicStreamUrl(track.id))
        preloadNextTrack(ensuredPlaylist, track)
        startPlaybackService(PlaybackNotificationActions.ACTION_PLAY)
    }

    fun togglePlayPause() {
        if (_uiState.value.isPlaying) {
            pause()
        } else {
            resume()
        }
    }

    fun resume() {
        playerEngine.play()
        startPlaybackService(PlaybackNotificationActions.ACTION_PLAY)
    }

    fun pause() {
        reportCurrentProgress(force = true)
        playerEngine.pause()
        startPlaybackService(PlaybackNotificationActions.ACTION_PAUSE)
    }

    fun seekTo(positionMs: Long) {
        playerEngine.seekTo(positionMs)
        _uiState.value = _uiState.value.copy(progressMs = positionMs)
    }

    fun togglePlayMode() {
        _uiState.value = _uiState.value.copy(playMode = _uiState.value.playMode.next())
    }

    fun playNext(autoTriggered: Boolean = false) {
        val state = _uiState.value
        val currentIndex = state.playlist.indexOfFirst { it.id == state.currentTrack?.id }
        val nextIndex = queueManager.nextIndex(state.playlist, currentIndex, state.playMode)

        if (nextIndex == null) {
            if (!autoTriggered) {
                _uiState.value = state.copy(errorMessage = "已经是最后一首")
            }
            pause()
            return
        }

        playTrack(state.playlist[nextIndex])
    }

    fun playPrevious() {
        val state = _uiState.value
        val currentIndex = state.playlist.indexOfFirst { it.id == state.currentTrack?.id }
        val prevIndex = queueManager.previousIndex(state.playlist, currentIndex, state.playMode)

        if (prevIndex == null) {
            _uiState.value = state.copy(errorMessage = "已经是第一首")
            return
        }

        playTrack(state.playlist[prevIndex])
    }

    fun addToQueue(track: Track) {
        val state = _uiState.value
        if (state.playlist.any { it.id == track.id }) return
        _uiState.value = state.copy(playlist = state.playlist + track)
    }

    fun removeFromQueue(trackId: Int) {
        val state = _uiState.value
        val updated = state.playlist.filterNot { it.id == trackId }
        if (updated.isEmpty()) {
            playerEngine.pause()
            _uiState.value = state.copy(
                playlist = emptyList(),
                currentTrack = null,
                isPlaying = false,
                progressMs = 0,
                durationMs = 0,
                bufferedPositionMs = 0
            )
            return
        }

        if (state.currentTrack?.id == trackId) {
            val fallbackTrack = updated.first()
            _uiState.value = state.copy(playlist = updated, currentTrack = fallbackTrack)
            playTrack(fallbackTrack)
        } else {
            _uiState.value = state.copy(playlist = updated)
        }
    }

    fun clearQueue() {
        playerEngine.pause()
        _uiState.value = PlayerUiState(playMode = _uiState.value.playMode)
        audioFocusController.abandon()
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(errorMessage = null)
    }

    private fun startProgressTicker() {
        progressJob?.cancel()
        progressJob = viewModelScope.launch {
            while (true) {
                val duration = playerEngine.player.duration.takeIf { it > 0 } ?: 0
                val progress = playerEngine.player.currentPosition
                val buffered = playerEngine.player.bufferedPosition
                _uiState.value = _uiState.value.copy(
                    progressMs = progress,
                    durationMs = duration,
                    bufferedPositionMs = buffered
                )
                reportCurrentProgress(force = false)
                delay(1000)
            }
        }
    }

    private fun reportCurrentProgress(force: Boolean) {
        val track = _uiState.value.currentTrack ?: return
        val progressSeconds = playerEngine.player.currentPosition / 1000.0
        if (!force && progressSeconds < 10.0) return
        playbackReporter.reportProgress(track, progressSeconds)
    }

    private fun preloadNextTrack(playlist: List<Track>, current: Track) {
        val idx = playlist.indexOfFirst { it.id == current.id }
        if (idx >= 0 && idx < playlist.lastIndex) {
            preloadManager.preload(playlist[idx + 1])
        }
    }

    private fun startPlaybackService(action: String) {
        val serviceIntent = Intent(context, PlaybackService::class.java).apply { this.action = action }
        runCatching {
            context.startService(serviceIntent)
            _uiState.value = _uiState.value.copy(isServiceBound = true, playbackOrigin = "service")
        }
    }

    override fun onCleared() {
        progressJob?.cancel()
        playerEngine.removeListener(listener)
        mediaSessionManager.detach()
        audioFocusController.abandon()
        super.onCleared()
    }
}

