package com.hoyomusic.mobile.feature.track

data class TrackFilterUiState(
    val titleExact: String = "",
    val albumExact: String = "",
    val artist: String = "",
    val gameIdsRaw: String = "",
    val tagIdsRaw: String = "",
    val tagLogic: String = "AND",
    val yearFrom: String = "",
    val yearTo: String = "",
    val durationMin: String = "",
    val durationMax: String = "",
    val durationBucket: String = "",
    val sampleRateMin: String = "",
    val bitDepth: String = "",
    val hasLyrics: Boolean? = null,
    val lyricsStatus: String = "",
    val sortBy: String = "release_date",
    val sortDir: String = "DESC"
)

