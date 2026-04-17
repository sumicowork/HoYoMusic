package com.hoyomusic.mobile.core.download

enum class DownloadStatus {
    QUEUED,
    RUNNING,
    COMPLETED,
    FAILED,
    CANCELED
}

data class DownloadTask(
    val trackId: Int,
    val title: String,
    val url: String,
    val status: DownloadStatus,
    val progress: Int,
    val filePath: String? = null,
    val errorMessage: String? = null,
    val retryCount: Int = 0,
    val workId: String? = null,
    val fileBytes: Long = 0L,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

data class DownloadQueueState(
    val tasks: List<DownloadTask> = emptyList()
)
