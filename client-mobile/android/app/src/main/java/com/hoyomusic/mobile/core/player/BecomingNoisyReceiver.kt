package com.hoyomusic.mobile.core.player

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BecomingNoisyReceiver(
    private val onNoisy: () -> Unit
) : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action == android.media.AudioManager.ACTION_AUDIO_BECOMING_NOISY) {
            onNoisy()
        }
    }
}

