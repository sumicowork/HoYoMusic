package com.hoyomusic.mobile.core.network

import com.hoyomusic.mobile.core.common.UiMessageBus
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import com.hoyomusic.mobile.session.SessionManager

class AuthInterceptor @Inject constructor(
    private val tokenProvider: AuthTokenProvider,
    private val sessionManager: SessionManager,
    private val messageBus: UiMessageBus
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = tokenProvider.getTokenOrNull()
        if (token.isNullOrBlank()) {
            return chain.proceed(chain.request())
        }

        val request = chain.request().newBuilder()
            .header("Authorization", "Bearer $token")
            .build()
        val response = chain.proceed(request)
        if (response.code == 401) {
            sessionManager.markExpired()
            messageBus.push("登录已过期，请重新登录")
        }
        return response
    }
}

