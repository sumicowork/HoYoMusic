package com.hoyomusic.mobile.core.download

import com.hoyomusic.mobile.core.persistence.DownloadStateDataStore
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

@Singleton
class DownloadQueueManager @Inject constructor(
    private val stateDataStore: DownloadStateDataStore
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val _state = MutableStateFlow(DownloadQueueState())
    val state: StateFlow<DownloadQueueState> = _state.asStateFlow()

    init {
        scope.launch {
            _state.value = DownloadQueueState(tasks = stateDataStore.load())
        }
    }

    fun enqueue(task: DownloadTask) {
        val existing = _state.value.tasks.firstOrNull { it.trackId == task.trackId }
        val now = System.currentTimeMillis()
        val updated = if (existing == null) {
            _state.value.tasks + task.copy(createdAt = now, updatedAt = now)
        } else {
            _state.value.tasks.map {
                if (it.trackId == task.trackId) {
                    task.copy(createdAt = it.createdAt, updatedAt = now)
                } else {
                    it
                }
            }
        }
        _state.value = DownloadQueueState(updated)
        persist(updated)
    }

    fun replace(task: DownloadTask) {
        val now = System.currentTimeMillis()
        val updated = _state.value.tasks.map {
            if (it.trackId == task.trackId) task.copy(createdAt = it.createdAt, updatedAt = now) else it
        }
        _state.value = DownloadQueueState(updated)
        persist(updated)
    }

    fun update(trackId: Int, transform: (DownloadTask) -> DownloadTask) {
        val now = System.currentTimeMillis()
        val updated = _state.value.tasks.map {
            if (it.trackId == trackId) transform(it).copy(updatedAt = now) else it
        }
        _state.value = DownloadQueueState(updated)
        persist(updated)
    }

    fun find(trackId: Int): DownloadTask? = _state.value.tasks.firstOrNull { it.trackId == trackId }

    fun remove(trackId: Int) {
        val updated = _state.value.tasks.filterNot { it.trackId == trackId }
        _state.value = DownloadQueueState(updated)
        persist(updated)
    }

    fun cancel(trackId: Int) {
        update(trackId) { task ->
            task.copy(status = DownloadStatus.CANCELED, progress = task.progress.coerceIn(0, 100))
        }
    }

    fun clearCompleted() {
        val updated = _state.value.tasks.filterNot { it.status == DownloadStatus.COMPLETED }
        _state.value = DownloadQueueState(updated)
        persist(updated)
    }

    fun clearFinished() {
        val updated = _state.value.tasks.filterNot {
            it.status == DownloadStatus.COMPLETED || it.status == DownloadStatus.CANCELED
        }
        _state.value = DownloadQueueState(updated)
        persist(updated)
    }

    private fun persist(tasks: List<DownloadTask>) {
        scope.launch { stateDataStore.save(tasks) }
    }
}
