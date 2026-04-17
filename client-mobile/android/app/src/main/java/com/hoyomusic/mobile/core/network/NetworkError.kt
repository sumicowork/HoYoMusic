package com.hoyomusic.mobile.core.network

sealed class NetworkError(open val message: String, val recoverable: Boolean) {
    data class Unauthorized(override val message: String = "登录状态失效，请重新登录") : NetworkError(message, false)
    data class Forbidden(override val message: String = "权限不足") : NetworkError(message, false)
    data class NotFound(override val message: String = "请求资源不存在") : NetworkError(message, false)
    data class RequestTimeout(override val message: String = "请求超时，请重试") : NetworkError(message, true)
    data class RateLimited(override val message: String = "请求过于频繁，请稍后再试") : NetworkError(message, true)
    data class ServiceUnavailable(override val message: String = "服务维护中，请稍后再试") : NetworkError(message, true)
    data class SslError(override val message: String = "安全连接失败") : NetworkError(message, false)
    data class NoNetwork(override val message: String = "当前无网络连接") : NetworkError(message, true)
    data class Http(val code: Int, override val message: String) : NetworkError(message, code >= 500)
    data class Envelope(override val message: String) : NetworkError(message, false)
    data class NetworkIO(override val message: String = "网络异常，请检查连接") : NetworkError(message, true)
    data class Unknown(override val message: String = "请求失败，请稍后再试") : NetworkError(message, true)
}

