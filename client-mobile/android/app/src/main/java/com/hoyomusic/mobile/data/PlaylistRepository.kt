package com.hoyomusic.mobile.data

import com.hoyomusic.mobile.core.model.Playlist
import com.hoyomusic.mobile.core.model.PlaylistDetail
import com.hoyomusic.mobile.core.network.ApiClient
import com.hoyomusic.mobile.core.network.ApiResult
import com.hoyomusic.mobile.core.network.CreatePlaylistRequestDto
import com.hoyomusic.mobile.core.network.NetworkError
import com.hoyomusic.mobile.core.network.PlaylistApi
import com.hoyomusic.mobile.core.network.PlaylistReorderRequestDto
import com.hoyomusic.mobile.core.network.PlaylistTrackMutationRequestDto
import com.hoyomusic.mobile.core.network.UpdatePlaylistRequestDto
import com.hoyomusic.mobile.core.network.toDomain
import com.hoyomusic.mobile.core.network.toDomainOrNull
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlaylistRepository @Inject constructor(
    private val apiClient: ApiClient,
    private val playlistApi: PlaylistApi
) {
    fun getPlaylists(): Flow<ApiResult<List<Playlist>>> = flow {
        when (val result = apiClient.executeEnvelope { playlistApi.getPlaylists() }) {
            is ApiResult.Success -> emit(ApiResult.Success(result.data.toDomain()))
            is ApiResult.Failure -> emit(result)
        }
    }

    fun getPlaylistDetail(playlistId: Int): Flow<ApiResult<PlaylistDetail>> = flow {
        when (val result = apiClient.executeEnvelope { playlistApi.getPlaylistById(playlistId) }) {
            is ApiResult.Success -> {
                val mapped = result.data.toDomainOrNull()
                if (mapped == null) {
                    emit(ApiResult.Failure(NetworkError.Envelope("歌单详情为空")))
                } else {
                    emit(ApiResult.Success(mapped))
                }
            }
            is ApiResult.Failure -> emit(result)
        }
    }

    fun createPlaylist(name: String, description: String?): Flow<ApiResult<Playlist>> = flow {
        when (
            val result = apiClient.executeEnvelope {
                playlistApi.createPlaylist(CreatePlaylistRequestDto(name = name, description = description))
            }
        ) {
            is ApiResult.Success -> {
                val mapped = result.data.toDomainOrNull()
                if (mapped == null) {
                    emit(ApiResult.Failure(NetworkError.Envelope("歌单创建返回为空")))
                } else {
                    emit(ApiResult.Success(mapped))
                }
            }
            is ApiResult.Failure -> emit(result)
        }
    }

    fun updatePlaylist(playlistId: Int, name: String?, description: String?): Flow<ApiResult<Playlist>> = flow {
        when (
            val result = apiClient.executeEnvelope {
                playlistApi.updatePlaylist(
                    playlistId = playlistId,
                    payload = UpdatePlaylistRequestDto(name = name, description = description)
                )
            }
        ) {
            is ApiResult.Success -> {
                val mapped = result.data.toDomainOrNull()
                if (mapped == null) {
                    emit(ApiResult.Failure(NetworkError.Envelope("歌单更新返回为空")))
                } else {
                    emit(ApiResult.Success(mapped))
                }
            }
            is ApiResult.Failure -> emit(result)
        }
    }

    fun deletePlaylist(playlistId: Int): Flow<ApiResult<Boolean>> = flow {
        when (val result = apiClient.executeEnvelopeNullable { playlistApi.deletePlaylist(playlistId) }) {
            is ApiResult.Success -> emit(ApiResult.Success(true))
            is ApiResult.Failure -> emit(result)
        }
    }

    fun addTrack(playlistId: Int, trackId: Int): Flow<ApiResult<Boolean>> = flow {
        when (
            val result = apiClient.executeEnvelopeNullable {
                playlistApi.addTrack(playlistId, PlaylistTrackMutationRequestDto(trackId = trackId))
            }
        ) {
            is ApiResult.Success -> emit(ApiResult.Success(true))
            is ApiResult.Failure -> emit(result)
        }
    }

    fun removeTrack(playlistId: Int, trackId: Int): Flow<ApiResult<Boolean>> = flow {
        when (val result = apiClient.executeEnvelopeNullable { playlistApi.removeTrack(playlistId, trackId) }) {
            is ApiResult.Success -> emit(ApiResult.Success(true))
            is ApiResult.Failure -> emit(result)
        }
    }

    fun reorderTracks(playlistId: Int, trackIds: List<Int>): Flow<ApiResult<Boolean>> = flow {
        when (
            val result = apiClient.executeEnvelopeNullable {
                playlistApi.reorderTracks(playlistId, PlaylistReorderRequestDto(trackIds = trackIds))
            }
        ) {
            is ApiResult.Success -> emit(ApiResult.Success(true))
            is ApiResult.Failure -> emit(result)
        }
    }
}
