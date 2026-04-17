package com.hoyomusic.mobile.core.download

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.WorkerParameters
import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

class TrackDownloadWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val url = inputData.getString("url") ?: return Result.failure()
        val output = inputData.getString("output") ?: return Result.failure()

        return runCatching {
            val outputFile = File(output)
            outputFile.parentFile?.mkdirs()

            val connection = URL(url).openConnection() as HttpURLConnection
            connection.connectTimeout = 15_000
            connection.readTimeout = 20_000
            connection.instanceFollowRedirects = true
            connection.connect()

            if (connection.responseCode !in 200..299) {
                return Result.retry()
            }

            val totalBytes = connection.contentLengthLong.takeIf { it > 0 } ?: -1L
            BufferedInputStream(connection.inputStream).use { bis ->
                FileOutputStream(outputFile).use { fos ->
                    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                    var downloadedBytes = 0L
                    var read = bis.read(buffer)
                    while (read >= 0) {
                        if (isStopped) {
                            outputFile.delete()
                            return Result.failure()
                        }
                        fos.write(buffer, 0, read)
                        downloadedBytes += read
                        if (totalBytes > 0) {
                            val progress = ((downloadedBytes * 100L) / totalBytes).toInt().coerceIn(0, 100)
                            setProgress(Data.Builder().putInt("progress", progress).build())
                        }
                        read = bis.read(buffer)
                    }
                    fos.flush()
                }
            }

            val bytes = outputFile.length()
            Result.success(
                Data.Builder()
                    .putLong("bytes", bytes)
                    .putString("output", outputFile.absolutePath)
                    .putInt("progress", 100)
                    .build()
            )
        }.getOrElse {
            Result.retry()
        }
    }
}
