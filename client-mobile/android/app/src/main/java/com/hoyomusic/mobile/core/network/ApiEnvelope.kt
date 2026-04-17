package com.hoyomusic.mobile.core.network

import com.squareup.moshi.Json

data class ApiEnvelope<T>(
    @Json(name = "success") val success: Boolean,
    @Json(name = "data") val data: T?,
    @Json(name = "error") val error: ApiErrorPayload?
)

data class ApiErrorPayload(
    @Json(name = "code") val code: String?,
    @Json(name = "message") val message: String?
)

