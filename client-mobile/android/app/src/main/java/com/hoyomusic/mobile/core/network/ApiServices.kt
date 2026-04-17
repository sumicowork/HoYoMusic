package com.hoyomusic.mobile.core.network

import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Body
import retrofit2.http.PUT
import retrofit2.http.DELETE

interface HealthApi {
    @GET("health")
    suspend fun getHealth(): Response<HealthResponseDto>
}

interface AuthApi {
    @POST("auth/login")
    suspend fun login(@Body payload: LoginRequestDto): Response<ApiEnvelope<LoginDataDto>>

    @GET("auth/me")
    suspend fun me(): Response<ApiEnvelope<UserDto>>
}

interface PublicTrackApi {
    @GET("public/tracks")
    suspend fun getPublicTracks(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
        @Query("search") search: String = "",
        @Query("game_ids") gameIds: String? = null,
        @Query("artist") artist: String? = null,
        @Query("title_exact") titleExact: String? = null,
        @Query("album_exact") albumExact: String? = null,
        @Query("year_from") yearFrom: Int? = null,
        @Query("year_to") yearTo: Int? = null,
        @Query("duration_min") durationMin: Int? = null,
        @Query("duration_max") durationMax: Int? = null,
        @Query("duration_bucket") durationBucket: String? = null,
        @Query("sample_rate_min") sampleRateMin: Int? = null,
        @Query("bit_depth") bitDepth: Int? = null,
        @Query("tag_ids") tagIds: String? = null,
        @Query("tag_logic") tagLogic: String? = null,
        @Query("has_lyrics") hasLyrics: Boolean? = null,
        @Query("lyrics_status") lyricsStatus: String? = null,
        @Query("sort_by") sortBy: String = "release_date",
        @Query("sort_dir") sortDir: String = "DESC"
    ): Response<ApiEnvelope<TrackListDataDto>>

    @GET("public/tracks/{id}")
    suspend fun getTrackDetail(
        @Path("id") trackId: Int
    ): Response<ApiEnvelope<TrackDetailDataDto>>

    @GET("public/tracks/random")
    suspend fun getRandomTracks(
        @Query("count") count: Int = 10
    ): Response<ApiEnvelope<TrackListDataDto>>

    @GET("public/top-tracks")
    suspend fun getTopTracks(
        @Query("limit") limit: Int = 20
    ): Response<ApiEnvelope<TrackListDataDto>>

    @GET("public/tracks/{id}/music-sources")
    suspend fun getTrackMusicSources(
        @Path("id") trackId: Int
    ): Response<ApiEnvelope<TrackSourceDataDto>>

    @POST("public/tracks/{id}/play")
    suspend fun recordPlay(
        @Path("id") trackId: Int,
        @Body payload: RecordPlayRequestDto
    ): Response<ApiEnvelope<RecordPlayDataDto>>
}

interface FavoriteApi {
    @POST("favorites/toggle")
    suspend fun toggleFavorite(@Body payload: ToggleFavoriteRequestDto): Response<ApiEnvelope<FavoriteToggleDataDto>>

    @GET("favorites")
    suspend fun getFavorites(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50
    ): Response<ApiEnvelope<TrackListDataDto>>

    @POST("favorites/check")
    suspend fun checkFavorites(@Body payload: CheckFavoritesRequestDto): Response<ApiEnvelope<FavoriteCheckDataDto>>
}

interface PlaylistApi {
    @GET("playlists")
    suspend fun getPlaylists(): Response<ApiEnvelope<PlaylistListDataDto>>

    @GET("playlists/{id}")
    suspend fun getPlaylistById(@Path("id") playlistId: Int): Response<ApiEnvelope<PlaylistDetailDataDto>>

    @POST("playlists")
    suspend fun createPlaylist(@Body payload: CreatePlaylistRequestDto): Response<ApiEnvelope<PlaylistMutationDataDto>>

    @PUT("playlists/{id}")
    suspend fun updatePlaylist(
        @Path("id") playlistId: Int,
        @Body payload: UpdatePlaylistRequestDto
    ): Response<ApiEnvelope<PlaylistMutationDataDto>>

    @DELETE("playlists/{id}")
    suspend fun deletePlaylist(@Path("id") playlistId: Int): Response<ApiEnvelope<ActionMessageDataDto>>

    @POST("playlists/{id}/tracks")
    suspend fun addTrack(
        @Path("id") playlistId: Int,
        @Body payload: PlaylistTrackMutationRequestDto
    ): Response<ApiEnvelope<ActionMessageDataDto>>

    @DELETE("playlists/{id}/tracks/{trackId}")
    suspend fun removeTrack(
        @Path("id") playlistId: Int,
        @Path("trackId") trackId: Int
    ): Response<ApiEnvelope<ActionMessageDataDto>>

    @PUT("playlists/{id}/reorder")
    suspend fun reorderTracks(
        @Path("id") playlistId: Int,
        @Body payload: PlaylistReorderRequestDto
    ): Response<ApiEnvelope<ActionMessageDataDto>>
}

data class RecordPlayRequestDto(
    val played_seconds: Double,
    val track_duration_seconds: Double?,
    val session_key: String
)

data class LoginRequestDto(
    val identifier: String,
    val password: String
)

data class LoginDataDto(
    val token: String?,
    val user: UserDto?
)

data class UserDto(
    val id: Int?,
    val username: String?,
    val is_admin: Boolean?
)

data class ToggleFavoriteRequestDto(
    val trackId: Int
)

data class CheckFavoritesRequestDto(
    val trackIds: List<Int>
)

data class FavoriteToggleDataDto(
    val favorited: Boolean?,
    val message: String?
)

data class FavoriteCheckDataDto(
    val favorites: Map<Int, Boolean>?
)

data class CreatePlaylistRequestDto(
    val name: String,
    val description: String? = null
)

data class UpdatePlaylistRequestDto(
    val name: String? = null,
    val description: String? = null
)

data class PlaylistTrackMutationRequestDto(
    val trackId: Int
)

data class PlaylistReorderRequestDto(
    val trackIds: List<Int>
)
