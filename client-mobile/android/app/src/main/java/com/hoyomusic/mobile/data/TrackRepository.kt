package com.hoyomusic.mobile.data

import com.hoyomusic.mobile.core.model.Track
import com.hoyomusic.mobile.core.model.TrackMusicSource
import com.hoyomusic.mobile.core.model.TrackPage
import com.hoyomusic.mobile.core.model.TrackPlayPayload
import com.hoyomusic.mobile.core.model.TrackSearchParams
import com.hoyomusic.mobile.core.cache.TrackSearchMemoryCache
import com.hoyomusic.mobile.core.network.ApiClient
import com.hoyomusic.mobile.core.network.ApiResult
import com.hoyomusic.mobile.core.network.NetworkError
import com.hoyomusic.mobile.core.network.PublicTrackApi
import com.hoyomusic.mobile.core.network.PublicTrackQueryMapper
import com.hoyomusic.mobile.core.network.RecordPlayRequestDto
import com.hoyomusic.mobile.core.network.toDomain
import com.hoyomusic.mobile.core.network.toDomainOrNull
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TrackRepository @Inject constructor(
    private val apiClient: ApiClient,
    private val publicTrackApi: PublicTrackApi,
    private val searchMemoryCache: TrackSearchMemoryCache
) {
    fun getPublicTracks(page: Int = 1, limit: Int = 20, search: String = ""): Flow<ApiResult<TrackPage>> = flow {
        when (
            val result = apiClient.executeEnvelope {
                publicTrackApi.getPublicTracks(page = page, limit = limit, search = search)
            }
        ) {
            is ApiResult.Success -> emit(ApiResult.Success(result.data.toDomain()))
            is ApiResult.Failure -> emit(result)
        }
    }

    fun searchPublicTracks(
        page: Int,
        limit: Int,
        search: String,
        sortBy: String,
        sortDir: String
    ): Flow<ApiResult<TrackPage>> = flow {
        when (
            val result = apiClient.executeEnvelope {
                publicTrackApi.getPublicTracks(
                    page = page,
                    limit = limit,
                    search = search,
                    sortBy = sortBy,
                    sortDir = sortDir
                )
            }
        ) {
            is ApiResult.Success -> emit(ApiResult.Success(result.data.toDomain()))
            is ApiResult.Failure -> emit(result)
        }
    }

    fun searchPublicTracks(params: TrackSearchParams): Flow<ApiResult<TrackPage>> {
        return flow {
            val query = PublicTrackQueryMapper.map(params)
            val cacheKey = "${query.page}|${query.limit}|${query.search}|${query.gameIds}|${query.artist}|${query.titleExact}|${query.albumExact}|${query.yearFrom}|${query.yearTo}|${query.durationMin}|${query.durationMax}|${query.durationBucket}|${query.sampleRateMin}|${query.bitDepth}|${query.tagIds}|${query.tagLogic}|${query.hasLyrics}|${query.lyricsStatus}|${query.sortBy}|${query.sortDir}"
            searchMemoryCache.get(cacheKey)?.let {
                emit(ApiResult.Success(it))
                return@flow
            }

            when (
                val result = apiClient.executeEnvelope {
                    publicTrackApi.getPublicTracks(
                        page = query.page,
                        limit = query.limit,
                        search = query.search,
                        gameIds = query.gameIds,
                        artist = query.artist,
                        titleExact = query.titleExact,
                        albumExact = query.albumExact,
                        yearFrom = query.yearFrom,
                        yearTo = query.yearTo,
                        durationMin = query.durationMin,
                        durationMax = query.durationMax,
                        durationBucket = query.durationBucket,
                        sampleRateMin = query.sampleRateMin,
                        bitDepth = query.bitDepth,
                        tagIds = query.tagIds,
                        tagLogic = query.tagLogic,
                        hasLyrics = query.hasLyrics,
                        lyricsStatus = query.lyricsStatus,
                        sortBy = query.sortBy,
                        sortDir = query.sortDir
                    )
                }
            ) {
                is ApiResult.Success -> {
                    val mapped = result.data.toDomain()
                    searchMemoryCache.put(cacheKey, mapped)
                    emit(ApiResult.Success(mapped))
                }
                is ApiResult.Failure -> emit(result)
            }
        }
    }

    fun getTrackDetail(trackId: Int): Flow<ApiResult<Track>> = flow {
        when (val result = apiClient.executeEnvelope { publicTrackApi.getTrackDetail(trackId) }) {
            is ApiResult.Success -> {
                val mapped = result.data.toDomainOrNull()
                if (mapped == null) {
                    emit(ApiResult.Failure(NetworkError.Envelope("曲目详情为空")))
                } else {
                    emit(ApiResult.Success(mapped))
                }
            }
            is ApiResult.Failure -> emit(result)
        }
    }

    fun getRandomTracks(count: Int = 10): Flow<ApiResult<List<Track>>> = flow {
        when (val result = apiClient.executeEnvelope { publicTrackApi.getRandomTracks(count) }) {
            is ApiResult.Success -> emit(ApiResult.Success(result.data.toDomain().tracks))
            is ApiResult.Failure -> emit(result)
        }
    }

    fun getTopTracks(limit: Int = 20): Flow<ApiResult<List<Track>>> = flow {
        when (val result = apiClient.executeEnvelope { publicTrackApi.getTopTracks(limit) }) {
            is ApiResult.Success -> emit(ApiResult.Success(result.data.toDomain().tracks))
            is ApiResult.Failure -> emit(result)
        }
    }

    fun getTrackMusicSources(trackId: Int): Flow<ApiResult<List<TrackMusicSource>>> = flow {
        when (val result = apiClient.executeEnvelope { publicTrackApi.getTrackMusicSources(trackId) }) {
            is ApiResult.Success -> emit(ApiResult.Success(result.data.toDomain()))
            is ApiResult.Failure -> emit(result)
        }
    }

    fun recordPlay(trackId: Int, payload: TrackPlayPayload): Flow<ApiResult<Boolean>> = flow {
        when (
            val result = apiClient.executeEnvelopeNullable {
                publicTrackApi.recordPlay(
                    trackId = trackId,
                    payload = RecordPlayRequestDto(
                        played_seconds = payload.playedSeconds,
                        track_duration_seconds = payload.trackDurationSeconds,
                        session_key = payload.sessionKey
                    )
                )
            }
        ) {
            is ApiResult.Success -> emit(ApiResult.Success(true))
            is ApiResult.Failure -> emit(result)
        }
    }
}

