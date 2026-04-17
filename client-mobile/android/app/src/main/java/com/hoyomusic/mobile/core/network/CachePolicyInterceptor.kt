package com.hoyomusic.mobile.core.network

import okhttp3.Interceptor
import okhttp3.Response

class CachePolicyInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val response = chain.proceed(request)

        val path = request.url.encodedPath
        val ttl = when {
            path.contains("/public/tracks/random") -> 30
            path.contains("/public/top-tracks") -> 30
            path.contains("/public/tracks") -> 60
            else -> 10
        }
        return response.newBuilder()
            .header("Cache-Control", "public, max-age=$ttl")
            .build()
    }
}

