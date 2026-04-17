package com.hoyomusic.mobile.core.network

class AuthNoCacheInterceptor(
    private val tokenProvider: AuthTokenProvider
) : okhttp3.Interceptor {
    override fun intercept(chain: okhttp3.Interceptor.Chain): okhttp3.Response {
        val request = chain.request()
        val token = tokenProvider.getTokenOrNull()
        val adjusted = if (!token.isNullOrBlank() && request.method == "GET") {
            request.newBuilder()
                .header("Cache-Control", "no-cache")
                .header("Pragma", "no-cache")
                .build()
        } else request
        return chain.proceed(adjusted)
    }
}

