package com.hoyomusic.mobile.core.network

import com.hoyomusic.mobile.core.common.NetworkStatusMonitor
import okhttp3.Interceptor
import okhttp3.Response

class OfflineCacheInterceptor(
    private val networkStatusMonitor: NetworkStatusMonitor
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val isOnline = networkStatusMonitor.isOnline.value
        val adjusted = if (!isOnline && request.method == "GET") {
            request.newBuilder()
                .header("Cache-Control", "only-if-cached, max-stale=86400")
                .build()
        } else request
        return chain.proceed(adjusted)
    }
}

