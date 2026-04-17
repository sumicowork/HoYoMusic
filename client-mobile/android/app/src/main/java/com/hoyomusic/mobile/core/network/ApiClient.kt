package com.hoyomusic.mobile.core.network

import retrofit2.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ApiClient @Inject constructor() {
    suspend fun <T> executeEnvelope(call: suspend () -> Response<ApiEnvelope<T>>): ApiResult<T> {
        return try {
            val response = call()
            if (!response.isSuccessful) {
                val statusMessage = extractErrorMessage(response) ?: response.message().ifBlank { "HTTP ${response.code()}" }
                return ApiResult.Failure(ErrorMapper.fromHttpStatus(response.code(), statusMessage))
            }

            val envelope = response.body()
                ?: return ApiResult.Failure(NetworkError.Envelope("响应数据为空"))

            if (!envelope.success) {
                val serverMessage = envelope.error?.message ?: "服务端返回失败"
                return ApiResult.Failure(NetworkError.Envelope(serverMessage))
            }

            val payload = envelope.data
                ?: return ApiResult.Failure(NetworkError.Envelope("响应缺少 data 字段"))

            ApiResult.Success(payload)
        } catch (throwable: Throwable) {
            ApiResult.Failure(ErrorMapper.fromThrowable(throwable))
        }
    }

    suspend fun <T> executeEnvelopeNullable(call: suspend () -> Response<ApiEnvelope<T>>): ApiResult<T?> {
        return try {
            val response = call()
            if (!response.isSuccessful) {
                val statusMessage = extractErrorMessage(response) ?: response.message().ifBlank { "HTTP ${response.code()}" }
                return ApiResult.Failure(ErrorMapper.fromHttpStatus(response.code(), statusMessage))
            }

            val envelope = response.body()
                ?: return ApiResult.Failure(NetworkError.Envelope("响应数据为空"))

            if (!envelope.success) {
                val serverMessage = envelope.error?.message ?: "服务端返回失败"
                return ApiResult.Failure(NetworkError.Envelope(serverMessage))
            }

            ApiResult.Success(envelope.data)
        } catch (throwable: Throwable) {
            ApiResult.Failure(ErrorMapper.fromThrowable(throwable))
        }
    }

    suspend fun <T> executeRaw(call: suspend () -> Response<T>): ApiResult<T> {
        return try {
            val response = call()
            if (!response.isSuccessful) {
                val statusMessage = extractErrorMessage(response) ?: response.message().ifBlank { "HTTP ${response.code()}" }
                return ApiResult.Failure(ErrorMapper.fromHttpStatus(response.code(), statusMessage))
            }

            val payload = response.body()
                ?: return ApiResult.Failure(NetworkError.Envelope("响应数据为空"))

            ApiResult.Success(payload)
        } catch (throwable: Throwable) {
            ApiResult.Failure(ErrorMapper.fromThrowable(throwable))
        }
    }

    private fun <T> extractErrorMessage(response: Response<T>): String? {
        return runCatching { response.errorBody()?.string() }
            .getOrNull()
            ?.takeIf { it.isNotBlank() }
            ?.let { raw ->
                // Prefer backend provided readable message when possible.
                Regex("\"message\"\\s*:\\s*\"([^\"]+)\"")
                    .find(raw)
                    ?.groupValues
                    ?.getOrNull(1)
                    ?: raw.take(200)
            }
    }
}

