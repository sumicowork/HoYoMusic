package com.hoyomusic.mobile.core.player

data class PlayerPersistentState(
    val playMode: String,
    val volume: Float,
    val currentTrackId: Int?,
    val progressMs: Long,
    val queueTrackIds: List<Int>
)

