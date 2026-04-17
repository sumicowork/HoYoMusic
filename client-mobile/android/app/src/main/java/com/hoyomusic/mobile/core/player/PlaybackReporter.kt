package com.hoyomusic.mobile.core.player

import com.hoyomusic.mobile.core.model.Track
import com.hoyomusic.mobile.core.model.TrackPlayPayload
import com.hoyomusic.mobile.core.network.ApiResult
import com.hoyomusic.mobile.data.TrackRepository
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

@Singleton
class PlaybackReporter @Inject constructor(
    private val trackRepository: TrackRepository,
    private val sessionManager: PlaybackSessionManager
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val lastReportedSeconds = mutableMapOf<String, Double>()

    fun reportProgress(track: Track, playedSeconds: Double) {
        val sessionKey = sessionManager.sessionForTrack(track.id)
        val last = lastReportedSeconds[sessionKey] ?: 0.0
        if (playedSeconds <= last) return

        val payload = TrackPlayPayload(
            playedSeconds = playedSeconds,
            trackDurationSeconds = track.durationSeconds?.toDouble(),
            sessionKey = sessionKey
        )

        scope.launch {
            when (trackRepository.recordPlay(track.id, payload).first()) {
                is ApiResult.Success -> lastReportedSeconds[sessionKey] = playedSeconds
                is ApiResult.Failure -> Unit
            }
        }
    }

    fun clearTrackSession(trackId: Int) {
        val keysToRemove = lastReportedSeconds.keys.filter { it.startsWith("trk-$trackId-") }
        keysToRemove.forEach { lastReportedSeconds.remove(it) }
    }
}

