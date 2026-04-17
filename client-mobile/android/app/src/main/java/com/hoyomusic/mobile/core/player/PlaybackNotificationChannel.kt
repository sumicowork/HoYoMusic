package com.hoyomusic.mobile.core.player

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlaybackNotificationChannel @Inject constructor() {
    companion object {
        const val CHANNEL_ID = "hoyomusic_playback"
    }

    fun ensure(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            CHANNEL_ID,
            "HoYoMusic Playback",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Playback controls and now-playing status"
        }
        manager.createNotificationChannel(channel)
    }
}

