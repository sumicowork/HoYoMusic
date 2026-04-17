package com.hoyomusic.mobile.core.player

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.hoyomusic.mobile.MainActivity
import com.hoyomusic.mobile.R
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlaybackNotificationManager @Inject constructor(
    private val channel: PlaybackNotificationChannel
) {

    fun build(context: Context, title: String, artist: String, isPlaying: Boolean): android.app.Notification {
        channel.ensure(context)

        val contentIntent = PendingIntent.getActivity(
            context,
            1,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val prevIntent = broadcastAction(context, PlaybackNotificationActions.ACTION_PREV, 2)
        val playPauseIntent = broadcastAction(
            context,
            if (isPlaying) PlaybackNotificationActions.ACTION_PAUSE else PlaybackNotificationActions.ACTION_PLAY,
            3
        )
        val nextIntent = broadcastAction(context, PlaybackNotificationActions.ACTION_NEXT, 4)
        val stopIntent = broadcastAction(context, PlaybackNotificationActions.ACTION_STOP, 5)

        return NotificationCompat.Builder(context, PlaybackNotificationChannel.CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(title)
            .setContentText(artist)
            .setContentIntent(contentIntent)
            .setOnlyAlertOnce(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(android.R.drawable.ic_media_previous, context.getString(R.string.playback_prev), prevIntent)
            .addAction(
                if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play,
                if (isPlaying) context.getString(R.string.playback_pause) else context.getString(R.string.playback_play),
                playPauseIntent
            )
            .addAction(android.R.drawable.ic_media_next, context.getString(R.string.playback_next), nextIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, context.getString(R.string.playback_stop), stopIntent)
            .build()
    }

    private fun broadcastAction(context: Context, action: String, requestCode: Int): PendingIntent {
        val intent = Intent(context, PlaybackActionReceiver::class.java).apply {
            putExtra(PlaybackNotificationActions.EXTRA_ACTION, action)
        }
        return PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}

