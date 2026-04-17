package com.hoyomusic.mobile.feature.download

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hoyomusic.mobile.core.download.DownloadQueueState
import com.hoyomusic.mobile.core.download.DownloadStatus
import com.hoyomusic.mobile.core.download.DownloadTask
import com.hoyomusic.mobile.data.DownloadRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn

enum class DownloadFilter {
    ALL,
    ACTIVE,
    COMPLETED,
    FAILED,
    CANCELED
}

enum class DownloadSortMode {
    NEWEST,
    OLDEST,
    TITLE_ASC
}

data class DownloadCenterUiState(
    val queue: DownloadQueueState = DownloadQueueState(),
    val visibleTasks: List<DownloadTask> = emptyList(),
    val totalCount: Int = 0,
    val activeCount: Int = 0,
    val completedCount: Int = 0,
    val failedCount: Int = 0,
    val canceledCount: Int = 0,
    val totalBytes: Long = 0L,
    val filter: DownloadFilter = DownloadFilter.ALL,
    val sortMode: DownloadSortMode = DownloadSortMode.NEWEST,
    val actionMessage: String? = null
)

internal fun buildDownloadCenterState(
    queue: DownloadQueueState,
    filter: DownloadFilter,
    sortMode: DownloadSortMode,
    message: String?
): DownloadCenterUiState {
    val filtered = queue.tasks.filter { task ->
        when (filter) {
            DownloadFilter.ALL -> true
            DownloadFilter.ACTIVE -> task.status == DownloadStatus.RUNNING || task.status == DownloadStatus.QUEUED
            DownloadFilter.COMPLETED -> task.status == DownloadStatus.COMPLETED
            DownloadFilter.FAILED -> task.status == DownloadStatus.FAILED
            DownloadFilter.CANCELED -> task.status == DownloadStatus.CANCELED
        }
    }
    val sorted = when (sortMode) {
        DownloadSortMode.NEWEST -> filtered.sortedByDescending { it.updatedAt }
        DownloadSortMode.OLDEST -> filtered.sortedBy { it.updatedAt }
        DownloadSortMode.TITLE_ASC -> filtered.sortedBy { it.title.lowercase() }
    }

    return DownloadCenterUiState(
        queue = queue,
        visibleTasks = sorted,
        totalCount = queue.tasks.size,
        activeCount = queue.tasks.count {
            it.status == DownloadStatus.RUNNING || it.status == DownloadStatus.QUEUED
        },
        completedCount = queue.tasks.count { it.status == DownloadStatus.COMPLETED },
        failedCount = queue.tasks.count { it.status == DownloadStatus.FAILED },
        canceledCount = queue.tasks.count { it.status == DownloadStatus.CANCELED },
        totalBytes = queue.tasks.sumOf { it.fileBytes },
        filter = filter,
        sortMode = sortMode,
        actionMessage = message
    )
}

@HiltViewModel
class DownloadCenterViewModel @Inject constructor(
    private val downloadRepository: DownloadRepository
) : ViewModel() {

    private val filter = MutableStateFlow(DownloadFilter.ALL)
    private val sortMode = MutableStateFlow(DownloadSortMode.NEWEST)
    private val actionMessage = MutableStateFlow<String?>(null)

    val uiState: StateFlow<DownloadCenterUiState> = combine(
        downloadRepository.queueState,
        filter,
        sortMode,
        actionMessage
    ) { queue, filter, sortMode, message ->
        buildDownloadCenterState(queue, filter, sortMode, message)
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = DownloadCenterUiState()
    )

    fun setFilter(value: DownloadFilter) {
        filter.value = value
    }

    fun setSortMode(value: DownloadSortMode) {
        sortMode.value = value
    }

    fun retry(task: DownloadTask) {
        downloadRepository.retry(task.trackId)
        actionMessage.value = "已重试: ${task.title}"
    }

    fun cancel(task: DownloadTask) {
        downloadRepository.cancel(task.trackId)
        actionMessage.value = "已取消: ${task.title}"
    }

    fun remove(task: DownloadTask) {
        downloadRepository.remove(task.trackId)
        actionMessage.value = "已移除: ${task.title}"
    }

    fun clearCompleted() {
        downloadRepository.clearCompleted()
        actionMessage.value = "已清理完成任务"
    }

    fun clearFinished() {
        downloadRepository.clearFinished()
        actionMessage.value = "已清理已结束任务"
    }

    fun clearFailed() {
        uiState.value.queue.tasks
            .filter { it.status == DownloadStatus.FAILED }
            .forEach { downloadRepository.remove(it.trackId) }
        actionMessage.value = "已清理失败任务"
    }

    fun consumeActionMessage() {
        actionMessage.value = null
    }
}
