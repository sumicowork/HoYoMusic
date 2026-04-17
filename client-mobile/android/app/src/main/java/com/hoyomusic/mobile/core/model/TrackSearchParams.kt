package com.hoyomusic.mobile.core.model

data class TrackSearchParams(
    val search: String = "",
    val gameIds: List<Int> = emptyList(),
    val artist: String? = null,
    val titleExact: String? = null,
    val albumExact: String? = null,
    val yearFrom: Int? = null,
    val yearTo: Int? = null,
    val durationMin: Int? = null,
    val durationMax: Int? = null,
    val durationBucket: String? = null,
    val sampleRateMin: Int? = null,
    val bitDepth: Int? = null,
    val tagIds: List<Int> = emptyList(),
    val tagLogic: String? = null,
    val hasLyrics: Boolean? = null,
    val lyricsStatus: String? = null,
    val sortBy: String = "release_date",
    val sortDir: String = "DESC",
    val page: Int = 1,
    val limit: Int = 20
)

