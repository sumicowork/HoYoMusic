package com.hoyomusic.mobile.core.player

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import dagger.hilt.android.EntryPointAccessors
import com.hoyomusic.mobile.di.PlaybackBusEntryPoint

class PlaybackActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.getStringExtra(PlaybackNotificationActions.EXTRA_ACTION)
        val entryPoint = EntryPointAccessors.fromApplication(context.applicationContext, PlaybackBusEntryPoint::class.java)
        when (action) {
            PlaybackNotificationActions.ACTION_PLAY -> entryPoint.bus().emit(PlaybackCommand.Play)
            PlaybackNotificationActions.ACTION_PAUSE -> entryPoint.bus().emit(PlaybackCommand.Pause)
            PlaybackNotificationActions.ACTION_NEXT -> entryPoint.bus().emit(PlaybackCommand.Next)
            PlaybackNotificationActions.ACTION_PREV -> entryPoint.bus().emit(PlaybackCommand.Prev)
            PlaybackNotificationActions.ACTION_STOP -> entryPoint.bus().emit(PlaybackCommand.Stop)
        }

        val serviceIntent = Intent(context, PlaybackService::class.java).apply {
            this.action = action
        }
        context.startService(serviceIntent)
    }
}

