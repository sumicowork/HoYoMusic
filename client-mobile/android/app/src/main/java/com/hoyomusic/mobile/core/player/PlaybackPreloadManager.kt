package com.hoyomusic.mobile.core.player

import com.hoyomusic.mobile.core.common.StreamUrlResolver
import com.hoyomusic.mobile.core.model.Track
import javax.inject.Inject
import javax.inject.Singleton
import okhttp3.OkHttpClient
import okhttp3.Request

@Singleton
class PlaybackPreloadManager @Inject constructor(
    private val streamUrlResolver: StreamUrlResolver,
    private val okHttpClient: OkHttpClient
) {
    fun preload(track: Track?) {
        if (track == null) return
        val request = Request.Builder()
            .url(streamUrlResolver.publicStreamUrl(track.id))
            .header("Range", "bytes=0-2048")
            .build()

        runCatching {
            okHttpClient.newCall(request).execute().use { _ -> }
        }
    }
}

