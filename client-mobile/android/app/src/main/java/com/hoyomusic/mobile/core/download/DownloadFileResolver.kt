package com.hoyomusic.mobile.core.download

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DownloadFileResolver @Inject constructor(
    @ApplicationContext private val context: Context
) {
    fun resolve(trackId: Int, title: String): File {
        val safeTitle = title.replace(Regex("[^a-zA-Z0-9._-]"), "_")
        val dir = File(context.filesDir, "downloads/tracks")
        if (!dir.exists()) dir.mkdirs()
        return File(dir, "${trackId}_$safeTitle.bin")
    }
}

