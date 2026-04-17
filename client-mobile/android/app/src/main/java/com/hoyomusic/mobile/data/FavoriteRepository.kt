package com.hoyomusic.mobile.data

import com.hoyomusic.mobile.core.model.TrackPage
import com.hoyomusic.mobile.core.network.ApiClient
import com.hoyomusic.mobile.core.network.ApiResult
import com.hoyomusic.mobile.core.network.CheckFavoritesRequestDto
import com.hoyomusic.mobile.core.network.FavoriteApi
import com.hoyomusic.mobile.core.network.ToggleFavoriteRequestDto
import com.hoyomusic.mobile.core.network.toDomain
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FavoriteRepository @Inject constructor(
    private val apiClient: ApiClient,
    private val favoriteApi: FavoriteApi
) {
    fun toggle(trackId: Int): Flow<ApiResult<Boolean>> = flow {
        when (
            val result = apiClient.executeEnvelope {
                favoriteApi.toggleFavorite(ToggleFavoriteRequestDto(trackId = trackId))
            }
        ) {
            is ApiResult.Success -> emit(ApiResult.Success(result.data.favorited == true))
            is ApiResult.Failure -> emit(result)
        }
    }

    fun getFavorites(page: Int = 1, limit: Int = 50): Flow<ApiResult<TrackPage>> = flow {
        when (val result = apiClient.executeEnvelope { favoriteApi.getFavorites(page = page, limit = limit) }) {
            is ApiResult.Success -> emit(ApiResult.Success(result.data.toDomain()))
            is ApiResult.Failure -> emit(result)
        }
    }

    fun checkFavorites(trackIds: List<Int>): Flow<ApiResult<Map<Int, Boolean>>> = flow {
        if (trackIds.isEmpty()) {
            emit(ApiResult.Success(emptyMap()))
            return@flow
        }

        when (
            val result = apiClient.executeEnvelope {
                favoriteApi.checkFavorites(CheckFavoritesRequestDto(trackIds = trackIds))
            }
        ) {
            is ApiResult.Success -> emit(ApiResult.Success(result.data.toDomain()))
            is ApiResult.Failure -> emit(result)
        }
    }

    fun applyFavoriteHints(page: TrackPage, favoriteMap: Map<Int, Boolean>): TrackPage {
        if (favoriteMap.isEmpty()) return page
        val tracks = page.tracks.map { track ->
            val favorited = favoriteMap[track.id] ?: false
            val favoriteCount = track.favoriteCount ?: 0
            track.copy(favoriteCount = (if (favorited) favoriteCount.coerceAtLeast(1) else favoriteCount))
        }
        return page.copy(tracks = tracks)
    }
}
