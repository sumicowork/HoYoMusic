package com.hoyomusic.mobile.data

import com.hoyomusic.mobile.core.model.HealthStatus
import com.hoyomusic.mobile.core.network.ApiClient
import com.hoyomusic.mobile.core.network.ApiResult
import com.hoyomusic.mobile.core.network.HealthApi
import com.hoyomusic.mobile.core.network.NetworkError
import com.hoyomusic.mobile.core.network.toDomain
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HealthRepository @Inject constructor(
    private val apiClient: ApiClient,
    private val healthApi: HealthApi
) {
    fun getHealthStatus(): Flow<ApiResult<HealthStatus>> = flow {
        when (val result = apiClient.executeRaw { healthApi.getHealth() }) {
            is ApiResult.Success -> {
                if (result.data.success) {
                    emit(ApiResult.Success(result.data.toDomain()))
                } else {
                    emit(ApiResult.Failure(NetworkError.Envelope(result.data.message ?: "健康检查失败")))
                }
            }
            is ApiResult.Failure -> emit(result)
        }
    }
}

