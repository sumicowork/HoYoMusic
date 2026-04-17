package com.hoyomusic.mobile.core.player

import android.content.Context
import androidx.media3.session.MediaSession
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlaybackMediaSessionManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private var mediaSession: MediaSession? = null

    fun attach(playerEngine: PlayerEngine) {
        if (mediaSession != null) return
        mediaSession = MediaSession.Builder(context, playerEngine.player)
            .setCallback(PlaybackMediaSessionCallback(playerEngine.player))
            .build()
    }

    fun detach() {
        mediaSession?.release()
        mediaSession = null
    }
}

