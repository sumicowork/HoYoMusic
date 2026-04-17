package com.hoyomusic.mobile.core.network

import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject

class VisitorIdInterceptor @Inject constructor(
    private val visitorIdProvider: VisitorIdProvider
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request().newBuilder()
            .header("x-visitor-id", visitorIdProvider.getOrCreateVisitorId())
            .build()
        return chain.proceed(request)
    }
}

