package com.hoyomusic.mobile.core.network

import com.hoyomusic.mobile.core.model.Artist
import com.hoyomusic.mobile.core.model.HealthStatus
import com.hoyomusic.mobile.core.model.Pagination
import com.hoyomusic.mobile.core.model.Playlist
import com.hoyomusic.mobile.core.model.PlaylistDetail
import com.hoyomusic.mobile.core.model.Track
import com.hoyomusic.mobile.core.model.TrackMusicSource
import com.hoyomusic.mobile.core.model.TrackPage
import com.squareup.moshi.Json

data class HealthResponseDto(
    @Json(name = "success") val success: Boolean,
    @Json(name = "message") val message: String?,
    @Json(name = "database") val database: String?,
    @Json(name = "timestamp") val timestamp: String?
)

data class TrackListDataDto(
    @Json(name = "tracks") val tracks: List<TrackDto>?,
    @Json(name = "pagination") val pagination: PaginationDto?
)

data class TrackDetailDataDto(
    @Json(name = "track") val track: TrackDto?
)

data class TrackSourceDataDto(
    @Json(name = "items") val items: List<TrackMusicSourceDto>?
)

data class RecordPlayDataDto(
    @Json(name = "track_id") val trackId: Int?,
    @Json(name = "effective_play") val effectivePlay: Boolean?,
    @Json(name = "played_seconds") val playedSeconds: Double?
)

data class TrackDto(
    @Json(name = "id") val id: Int,
    @Json(name = "uuid") val uuid: String?,
    @Json(name = "title") val title: String?,
    @Json(name = "title_cn") val titleCn: String?,
    @Json(name = "title_en") val titleEn: String?,
    @Json(name = "album_id") val albumId: Int?,
    @Json(name = "album_title") val albumTitle: String?,
    @Json(name = "cover_path") val coverPath: String?,
    @Json(name = "duration") val duration: Int?,
    @Json(name = "track_number") val trackNumber: Int?,
    @Json(name = "release_date") val releaseDate: String?,
    @Json(name = "effective_play_count") val effectivePlayCount: Int?,
    @Json(name = "favorite_count") val favoriteCount: Int?,
    @Json(name = "artists") val artists: List<ArtistDto>?
)

data class ArtistDto(
    @Json(name = "id") val id: Int?,
    @Json(name = "name") val name: String?
)

data class PaginationDto(
    @Json(name = "page") val page: Int?,
    @Json(name = "limit") val limit: Int?,
    @Json(name = "total") val total: Int?,
    @Json(name = "totalPages") val totalPages: Int?
)

data class TrackMusicSourceDto(
    @Json(name = "id") val id: Long?,
    @Json(name = "category_name") val categoryName: String?,
    @Json(name = "node_name") val nodeName: String?,
    @Json(name = "path") val path: List<String>?
)

data class PlaylistListDataDto(
    @Json(name = "playlists") val playlists: List<PlaylistDto>?
)

data class PlaylistDetailDataDto(
    @Json(name = "playlist") val playlist: PlaylistDto?,
    @Json(name = "tracks") val tracks: List<TrackDto>?
)

data class PlaylistMutationDataDto(
    @Json(name = "playlist") val playlist: PlaylistDto?
)

data class ActionMessageDataDto(
    @Json(name = "message") val message: String?
)

data class PlaylistDto(
    @Json(name = "id") val id: Int?,
    @Json(name = "user_id") val userId: Int?,
    @Json(name = "name") val name: String?,
    @Json(name = "description") val description: String?,
    @Json(name = "cover_path") val coverPath: String?,
    @Json(name = "is_public") val isPublic: Boolean?,
    @Json(name = "track_count") val trackCount: Int?,
    @Json(name = "total_duration") val totalDuration: Int?,
    @Json(name = "created_at") val createdAt: String?,
    @Json(name = "updated_at") val updatedAt: String?
)

fun HealthResponseDto.toDomain(): HealthStatus {
    return HealthStatus(
        isHealthy = success,
        message = message ?: if (success) "API 可用" else "API 不可用",
        database = database,
        timestamp = timestamp
    )
}

fun TrackListDataDto.toDomain(): TrackPage {
    val trackItems = tracks.orEmpty().map { dto ->
        Track(
            id = dto.id,
            uuid = dto.uuid,
            title = dto.title?.ifBlank { null } ?: "(未命名曲目)",
            titleCn = dto.titleCn,
            titleEn = dto.titleEn,
            albumId = dto.albumId,
            albumTitle = dto.albumTitle,
            coverPath = dto.coverPath,
            durationSeconds = dto.duration,
            trackNumber = dto.trackNumber,
            releaseDate = dto.releaseDate,
            effectivePlayCount = dto.effectivePlayCount,
            favoriteCount = dto.favoriteCount,
            artists = dto.artists.orEmpty().map { artist ->
                Artist(
                    id = artist.id,
                    name = artist.name?.ifBlank { null } ?: "Unknown Artist"
                )
            }
        )
    }

    val pageInfo = pagination
    val safePagination = Pagination(
        page = pageInfo?.page ?: 1,
        limit = pageInfo?.limit ?: trackItems.size.coerceAtLeast(1),
        total = pageInfo?.total ?: trackItems.size,
        totalPages = pageInfo?.totalPages ?: 1
    )

    return TrackPage(tracks = trackItems, pagination = safePagination)
}

fun TrackDetailDataDto.toDomainOrNull(): Track? = track?.let {
    TrackListDataDto(tracks = listOf(it), pagination = null).toDomain().tracks.firstOrNull()
}

fun TrackSourceDataDto.toDomain(): List<TrackMusicSource> = items.orEmpty().map {
    TrackMusicSource(
        id = it.id ?: -1,
        categoryName = it.categoryName.orEmpty(),
        nodeName = it.nodeName.orEmpty(),
        path = it.path.orEmpty()
    )
}

fun PlaylistDto.toDomainOrNull(): Playlist? {
    val safeId = id ?: return null
    return Playlist(
        id = safeId,
        userId = userId,
        name = name?.ifBlank { null } ?: "未命名歌单",
        description = description,
        coverPath = coverPath,
        isPublic = isPublic == true,
        trackCount = trackCount ?: 0,
        totalDuration = totalDuration ?: 0,
        createdAt = createdAt,
        updatedAt = updatedAt
    )
}

fun PlaylistListDataDto.toDomain(): List<Playlist> = playlists.orEmpty().mapNotNull { it.toDomainOrNull() }

fun PlaylistMutationDataDto.toDomainOrNull(): Playlist? = playlist?.toDomainOrNull()

fun PlaylistDetailDataDto.toDomainOrNull(): PlaylistDetail? {
    val mappedPlaylist = playlist?.toDomainOrNull() ?: return null
    val mappedTracks = TrackListDataDto(tracks = tracks, pagination = null).toDomain().tracks
    return PlaylistDetail(
        playlist = mappedPlaylist,
        tracks = mappedTracks
    )
}

fun FavoriteCheckDataDto.toDomain(): Map<Int, Boolean> = favorites.orEmpty()
