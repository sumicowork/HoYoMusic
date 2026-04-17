package com.hoyomusic.mobile.core.network

import com.hoyomusic.mobile.core.model.TrackSearchParams

data class PublicTrackQuery(
    val page: Int,
    val limit: Int,
    val search: String,
    val gameIds: String?,
    val artist: String?,
    val titleExact: String?,
    val albumExact: String?,
    val yearFrom: Int?,
    val yearTo: Int?,
    val durationMin: Int?,
    val durationMax: Int?,
    val durationBucket: String?,
    val sampleRateMin: Int?,
    val bitDepth: Int?,
    val tagIds: String?,
    val tagLogic: String?,
    val hasLyrics: Boolean?,
    val lyricsStatus: String?,
    val sortBy: String,
    val sortDir: String
)

object PublicTrackQueryMapper {
    fun map(params: TrackSearchParams): PublicTrackQuery {
        return PublicTrackQuery(
            page = params.page,
            limit = params.limit,
            search = params.search,
            gameIds = params.gameIds.takeIf { it.isNotEmpty() }?.joinToString(","),
            artist = params.artist?.takeIf { it.isNotBlank() },
            titleExact = params.titleExact?.takeIf { it.isNotBlank() },
            albumExact = params.albumExact?.takeIf { it.isNotBlank() },
            yearFrom = params.yearFrom,
            yearTo = params.yearTo,
            durationMin = params.durationMin,
            durationMax = params.durationMax,
            durationBucket = params.durationBucket,
            sampleRateMin = params.sampleRateMin,
            bitDepth = params.bitDepth,
            tagIds = params.tagIds.takeIf { it.isNotEmpty() }?.joinToString(","),
            tagLogic = params.tagLogic,
            hasLyrics = params.hasLyrics,
            lyricsStatus = params.lyricsStatus,
            sortBy = params.sortBy,
            sortDir = params.sortDir
        )
    }
}

