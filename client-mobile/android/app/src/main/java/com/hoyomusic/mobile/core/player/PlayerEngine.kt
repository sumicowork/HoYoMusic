package com.hoyomusic.mobile.core.player

import android.content.Context
import android.content.IntentFilter
import androidx.media3.common.AudioAttributes
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlayerEngine @Inject constructor(
    @ApplicationContext context: Context
) {
    private val appContext = context
    private val noisyReceiver = BecomingNoisyReceiver { pause() }

    val player: ExoPlayer = ExoPlayer.Builder(context).build().apply {
        setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(androidx.media3.common.C.USAGE_MEDIA)
                .setContentType(androidx.media3.common.C.AUDIO_CONTENT_TYPE_MUSIC)
                .build(),
            true
        )
        setHandleAudioBecomingNoisy(true)
    }

    init {
        appContext.registerReceiver(
            noisyReceiver,
            IntentFilter(android.media.AudioManager.ACTION_AUDIO_BECOMING_NOISY)
        )
    }

    fun setAndPlay(url: String) {
        val mediaItem = MediaItem.fromUri(url)
        player.setMediaItem(mediaItem)
        player.prepare()
        player.playWhenReady = true
    }

    fun play() = player.play()

    fun pause() = player.pause()

    fun seekTo(positionMs: Long) = player.seekTo(positionMs)

    fun addListener(listener: Player.Listener) = player.addListener(listener)

    fun removeListener(listener: Player.Listener) = player.removeListener(listener)

    fun release() {
        runCatching { appContext.unregisterReceiver(noisyReceiver) }
        player.release()
    }
}

