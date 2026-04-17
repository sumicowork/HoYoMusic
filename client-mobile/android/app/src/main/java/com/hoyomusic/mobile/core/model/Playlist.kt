package com.hoyomusic.mobile.core.model

data class Playlist(
    val id: Int,
    val userId: Int?,
    val name: String,
    val description: String?,
    val coverPath: String?,
    val isPublic: Boolean,
    val trackCount: Int,
    val totalDuration: Int,
    val createdAt: String?,
    val updatedAt: String?
)

data class PlaylistDetail(
    val playlist: Playlist,
    val tracks: List<Track>
)

