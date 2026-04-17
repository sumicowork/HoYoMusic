package com.hoyomusic.mobile.core.player

data class PlaybackHistoryItem(
    val trackId: Int,
    val title: String,
    val artist: String,
    val playedAt: Long
)

