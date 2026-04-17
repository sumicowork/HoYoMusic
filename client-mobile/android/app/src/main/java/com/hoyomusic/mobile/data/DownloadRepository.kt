package com.hoyomusic.mobile.data

import android.content.Context
import androidx.work.WorkInfo
import androidx.work.WorkManager
import com.hoyomusic.mobile.core.common.StreamUrlResolver
import com.hoyomusic.mobile.core.download.DownloadFileResolver
import com.hoyomusic.mobile.core.download.DownloadQueueManager
import com.hoyomusic.mobile.core.download.DownloadQueueState
import com.hoyomusic.mobile.core.download.DownloadStatus
import com.hoyomusic.mobile.core.download.DownloadTask
import com.hoyomusic.mobile.core.download.DownloadWorkScheduler
import com.hoyomusic.mobile.core.model.Track
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

@Singleton
class DownloadRepository @Inject constructor(
    private val queueManager: DownloadQueueManager,
    private val scheduler: DownloadWorkScheduler,
    private val streamUrlResolver: StreamUrlResolver,
    private val fileResolver: DownloadFileResolver,
    @ApplicationContext private val context: Context
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    val queueState: StateFlow<DownloadQueueState> = queueManager.state

    fun enqueue(track: Track): Boolean {
        val existing = queueManager.find(track.id)
        if (existing != null && (existing.status == DownloadStatus.RUNNING || existing.status == DownloadStatus.QUEUED)) {
            return false
        }
        if (existing != null && existing.status == DownloadStatus.COMPLETED) {
            return false
        }

        val file = fileResolver.resolve(track.id, track.title)
        val scheduledTask = DownloadTask(
            trackId = track.id,
            title = track.title,
            url = streamUrlResolver.publicDownloadUrl(track.id),
            status = DownloadStatus.QUEUED,
            progress = 0,
            filePath = file.absolutePath,
            errorMessage = null
        )
        queueManager.enqueue(scheduledTask)

        val workId = scheduler.schedule(scheduledTask.copy(status = DownloadStatus.RUNNING))
        queueManager.update(track.id) {
            it.copy(status = DownloadStatus.RUNNING, workId = workId, errorMessage = null)
        }
        observeWork(track.id, workId)
        return true
    }

    fun retry(trackId: Int) {
        val current = queueManager.find(trackId) ?: return
        val nextRetry = current.retryCount + 1
        val workId = scheduler.schedule(
            current.copy(
                status = DownloadStatus.RUNNING,
                retryCount = nextRetry,
                errorMessage = null,
                progress = 0
            )
        )
        queueManager.update(trackId) {
            it.copy(
                status = DownloadStatus.RUNNING,
                progress = 0,
                retryCount = nextRetry,
                workId = workId,
                errorMessage = null
            )
        }
        observeWork(trackId, workId)
    }

    fun cancel(trackId: Int) {
        queueManager.find(trackId)?.workId?.let(scheduler::cancel)
        queueManager.cancel(trackId)
    }

    fun remove(trackId: Int) {
        queueManager.find(trackId)?.workId?.let(scheduler::cancel)
        queueManager.remove(trackId)
    }

    fun clearCompleted() {
        queueManager.clearCompleted()
    }

    fun clearFinished() {
        queueManager.clearFinished()
    }

    private fun observeWork(trackId: Int, workId: String) {
        val uuid = runCatching { java.util.UUID.fromString(workId) }.getOrNull() ?: return
        scope.launch {
            WorkManager.getInstance(context).getWorkInfoByIdFlow(uuid).collect { workInfo ->
                if (workInfo == null) return@collect
                val progress = workInfo.progress.getInt("progress", 0).coerceIn(0, 100)
                when (workInfo.state) {
                    WorkInfo.State.ENQUEUED, WorkInfo.State.BLOCKED -> {
                        queueManager.update(trackId) { it.copy(status = DownloadStatus.QUEUED, progress = progress) }
                    }
                    WorkInfo.State.RUNNING -> {
                        queueManager.update(trackId) { it.copy(status = DownloadStatus.RUNNING, progress = progress) }
                    }
                    WorkInfo.State.SUCCEEDED -> {
                        queueManager.update(trackId) {
                            it.copy(
                                status = DownloadStatus.COMPLETED,
                                progress = 100,
                                fileBytes = workInfo.outputData.getLong("bytes", it.fileBytes),
                                filePath = workInfo.outputData.getString("output") ?: it.filePath,
                                errorMessage = null
                            )
                        }
                        return@collect
                    }
                    WorkInfo.State.FAILED -> {
                        queueManager.update(trackId) {
                            it.copy(status = DownloadStatus.FAILED, errorMessage = "下载失败，请重试或检查网络")
                        }
                        return@collect
                    }
                    WorkInfo.State.CANCELLED -> {
                        queueManager.update(trackId) {
                            it.copy(status = DownloadStatus.CANCELED, errorMessage = "下载已取消")
                        }
                        return@collect
                    }
                }
            }
        }
    }
}
