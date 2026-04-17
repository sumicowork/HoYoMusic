package com.hoyomusic.mobile.core.download

import android.content.Context
import androidx.work.Data
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DownloadWorkScheduler @Inject constructor(
    @ApplicationContext private val context: Context
) {
    fun schedule(task: DownloadTask): String {
        val data = Data.Builder()
            .putInt("trackId", task.trackId)
            .putString("title", task.title)
            .putString("url", task.url)
            .putString("output", task.filePath)
            .build()

        val request = OneTimeWorkRequestBuilder<TrackDownloadWorker>()
            .setInputData(data)
            .build()

        WorkManager.getInstance(context).enqueue(request)
        return request.id.toString()
    }

    fun cancel(workId: String) {
        runCatching {
            WorkManager.getInstance(context).cancelWorkById(java.util.UUID.fromString(workId))
        }
    }
}
