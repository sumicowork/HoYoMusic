package com.hoyomusic.mobile.feature.download

import com.hoyomusic.mobile.core.download.DownloadQueueState
import com.hoyomusic.mobile.core.download.DownloadStatus
import com.hoyomusic.mobile.core.download.DownloadTask
import org.junit.Assert.assertEquals
import org.junit.Test

class DownloadCenterStateBuilderTest {

    @Test
    fun filtersAndCountsDownloadTasks() {
        val queue = DownloadQueueState(
            tasks = listOf(
                task(1, "B", DownloadStatus.RUNNING, 10, 200L, 200),
                task(2, "A", DownloadStatus.FAILED, 20, 0L, 100),
                task(3, "C", DownloadStatus.COMPLETED, 100, 800L, 300)
            )
        )

        val state = buildDownloadCenterState(
            queue = queue,
            filter = DownloadFilter.ALL,
            sortMode = DownloadSortMode.TITLE_ASC,
            message = "ok"
        )

        assertEquals(3, state.totalCount)
        assertEquals(1, state.activeCount)
        assertEquals(1, state.completedCount)
        assertEquals(1, state.failedCount)
        assertEquals(1000L, state.totalBytes)
        assertEquals(listOf("A", "B", "C"), state.visibleTasks.map { it.title })
        assertEquals("ok", state.actionMessage)
    }

    @Test
    fun supportsFailedFilter() {
        val queue = DownloadQueueState(
            tasks = listOf(
                task(1, "X", DownloadStatus.FAILED, 0, 0L, 10),
                task(2, "Y", DownloadStatus.COMPLETED, 100, 20L, 20)
            )
        )

        val state = buildDownloadCenterState(
            queue = queue,
            filter = DownloadFilter.FAILED,
            sortMode = DownloadSortMode.NEWEST,
            message = null
        )

        assertEquals(1, state.visibleTasks.size)
        assertEquals(1, state.visibleTasks.first().trackId)
    }

    private fun task(
        id: Int,
        title: String,
        status: DownloadStatus,
        progress: Int,
        bytes: Long,
        updatedAt: Long
    ): DownloadTask {
        return DownloadTask(
            trackId = id,
            title = title,
            url = "u",
            status = status,
            progress = progress,
            fileBytes = bytes,
            updatedAt = updatedAt,
            createdAt = updatedAt - 1
        )
    }
}

