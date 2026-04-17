package com.hoyomusic.mobile.core.model

data class Artist(
    val id: Int?,
    val name: String
)

data class Track(
    val id: Int,
    val uuid: String?,
    val title: String,
    val titleCn: String?,
    val titleEn: String?,
    val albumId: Int?,
    val albumTitle: String?,
    val coverPath: String?,
    val durationSeconds: Int?,
    val trackNumber: Int?,
    val releaseDate: String?,
    val effectivePlayCount: Int?,
    val favoriteCount: Int?,
    val artists: List<Artist>
)

data class Pagination(
    val page: Int,
    val limit: Int,
    val total: Int,
    val totalPages: Int
)

data class TrackPage(
    val tracks: List<Track>,
    val pagination: Pagination
)

data class TrackMusicSource(
    val id: Long,
    val categoryName: String,
    val nodeName: String,
    val path: List<String>
)

data class TrackPlayPayload(
    val playedSeconds: Double,
    val trackDurationSeconds: Double?,
    val sessionKey: String
)

