package com.hoyomusic.mobile.core.common

import com.hoyomusic.mobile.BuildConfig
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class StreamUrlResolver @Inject constructor() {
    fun publicStreamUrl(trackId: Int): String {
        return "${BuildConfig.API_BASE_URL.removeSuffix("/")}/public/tracks/$trackId/stream"
    }

    fun publicDownloadUrl(trackId: Int): String {
        return "${BuildConfig.API_BASE_URL.removeSuffix("/")}/public/tracks/$trackId/download"
    }
}

