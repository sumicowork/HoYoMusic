package com.hoyomusic.mobile.core.player

data class SleepTimerState(
    val isRunning: Boolean = false,
    val endAtMillis: Long? = null,
    val remainSeconds: Long = 0
)

