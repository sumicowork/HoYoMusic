package com.hoyomusic.mobile.core.common

import com.hoyomusic.mobile.BuildConfig
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CoverUrlResolver @Inject constructor() {

    private val backendOrigin: String by lazy {
        BuildConfig.API_BASE_URL.removeSuffix("/").removeSuffix("/api")
    }

    fun resolve(coverPath: String?, thumb: Boolean): String? {
        if (coverPath.isNullOrBlank()) return null

        val sizeParam = if (thumb) "&size=thumb" else ""
        if (coverPath.startsWith("http://") || coverPath.startsWith("https://")) {
            val encoded = URLEncoder.encode(coverPath, StandardCharsets.UTF_8.toString())
            return "$backendOrigin/api/public/covers/proxy?path=$encoded$sizeParam"
        }

        if (coverPath.startsWith("/") && !coverPath.startsWith("/uploads/")) {
            return "$backendOrigin$coverPath"
        }

        val normalized = if (coverPath.startsWith("/")) coverPath else "/uploads/$coverPath"
        if (thumb) {
            val encoded = URLEncoder.encode(normalized, StandardCharsets.UTF_8.toString())
            return "$backendOrigin/api/public/covers/proxy?path=$encoded$sizeParam"
        }
        return "$backendOrigin$normalized"
    }
}

