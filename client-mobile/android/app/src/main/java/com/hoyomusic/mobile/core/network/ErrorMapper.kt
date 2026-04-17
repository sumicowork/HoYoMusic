package com.hoyomusic.mobile.core.network

import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.net.ssl.SSLException
import retrofit2.HttpException

object ErrorMapper {
    fun fromHttpStatus(code: Int, fallbackMessage: String): NetworkError {
        return when (code) {
            401 -> NetworkError.Unauthorized()
            403 -> NetworkError.Forbidden()
            404 -> NetworkError.NotFound()
            408 -> NetworkError.RequestTimeout()
            429 -> NetworkError.RateLimited()
            503 -> NetworkError.ServiceUnavailable()
            else -> NetworkError.Http(code = code, message = fallbackMessage)
        }
    }

    fun fromThrowable(throwable: Throwable): NetworkError {
        return when (throwable) {
            is UnknownHostException -> NetworkError.NoNetwork()
            is SocketTimeoutException -> NetworkError.RequestTimeout()
            is SSLException -> NetworkError.SslError()
            is IOException -> NetworkError.NetworkIO()
            is HttpException -> fromHttpStatus(throwable.code(), throwable.message())
            else -> NetworkError.Unknown(throwable.message ?: "未知错误")
        }
    }
}

