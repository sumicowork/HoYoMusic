package com.hoyomusic.mobile.core.player

import android.app.Service
import android.content.Intent
import android.os.IBinder
import androidx.media3.common.Player
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class PlaybackService : Service() {

    @Inject
    lateinit var playerEngine: PlayerEngine

    @Inject
    lateinit var notificationManager: PlaybackNotificationManager

    private val playerListener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) {
            pushNotification()
        }
    }

    override fun onCreate() {
        super.onCreate()
        playerEngine.addListener(playerListener)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            PlaybackNotificationActions.ACTION_PLAY -> playerEngine.play()
            PlaybackNotificationActions.ACTION_PAUSE -> playerEngine.pause()
            PlaybackNotificationActions.ACTION_NEXT -> Unit
            PlaybackNotificationActions.ACTION_PREV -> Unit
            PlaybackNotificationActions.ACTION_STOP -> {
                playerEngine.pause()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
        }
        pushNotification()
        return START_STICKY
    }

    private fun pushNotification() {
        val metadata = playerEngine.player.mediaMetadata
        val title = metadata.title?.toString() ?: getString(com.hoyomusic.mobile.R.string.app_name)
        val artist = metadata.artist?.toString() ?: ""
        val notification = notificationManager.build(this, title, artist, playerEngine.player.isPlaying)
        startForeground(101, notification)
    }

    override fun onDestroy() {
        playerEngine.removeListener(playerListener)
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}

