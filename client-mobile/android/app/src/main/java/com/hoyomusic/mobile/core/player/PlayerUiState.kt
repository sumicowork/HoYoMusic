package com.hoyomusic.mobile.core.player

import com.hoyomusic.mobile.core.model.Track

data class PlayerUiState(
    val playlist: List<Track> = emptyList(),
    val currentTrack: Track? = null,
    val isPlaying: Boolean = false,
    val playMode: PlayMode = PlayMode.SEQUENCE,
    val audioFocusState: String = "normal",
    val playbackOrigin: String = "foreground",
    val isServiceBound: Boolean = false,
    val progressMs: Long = 0,
    val durationMs: Long = 0,
    val bufferedPositionMs: Long = 0,
    val errorMessage: String? = null,
    val failedTrackIds: Set<Int> = emptySet()
)

