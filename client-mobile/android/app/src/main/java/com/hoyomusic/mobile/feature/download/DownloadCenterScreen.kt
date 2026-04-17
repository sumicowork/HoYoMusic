package com.hoyomusic.mobile.feature.download

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.hoyomusic.mobile.core.download.DownloadStatus
import com.hoyomusic.mobile.core.download.DownloadTask
import com.hoyomusic.mobile.ui.theme.GlassBackground
import com.hoyomusic.mobile.ui.theme.GlassCard
import com.hoyomusic.mobile.ui.theme.GlassGhostButton
import com.hoyomusic.mobile.ui.theme.GlassSectionTitle

@Composable
fun DownloadCenterRoute(viewModel: DownloadCenterViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsState()

    GlassBackground {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
        GlassSectionTitle("下载中心")
        Text("总任务 ${state.totalCount} | 活跃 ${state.activeCount} | 完成 ${state.completedCount}")
        Text("失败 ${state.failedCount} | 取消 ${state.canceledCount} | 总字节 ${state.totalBytes}")

        androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            GlassGhostButton(text = "全部", onClick = { viewModel.setFilter(DownloadFilter.ALL) })
            GlassGhostButton(text = "进行中", onClick = { viewModel.setFilter(DownloadFilter.ACTIVE) })
            GlassGhostButton(text = "已完成", onClick = { viewModel.setFilter(DownloadFilter.COMPLETED) })
            GlassGhostButton(text = "失败", onClick = { viewModel.setFilter(DownloadFilter.FAILED) })
        }

        androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            GlassGhostButton(text = "最新", onClick = { viewModel.setSortMode(DownloadSortMode.NEWEST) })
            GlassGhostButton(text = "最早", onClick = { viewModel.setSortMode(DownloadSortMode.OLDEST) })
            GlassGhostButton(text = "名称", onClick = { viewModel.setSortMode(DownloadSortMode.TITLE_ASC) })
        }

        androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            GlassGhostButton(text = "清理完成", onClick = viewModel::clearCompleted)
            GlassGhostButton(text = "清理已结束", onClick = viewModel::clearFinished)
            GlassGhostButton(text = "清理失败", onClick = viewModel::clearFailed)
        }

        if (state.visibleTasks.isEmpty()) {
            Text("当前筛选下暂无任务", style = MaterialTheme.typography.bodySmall)
        }

        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(state.visibleTasks, key = { it.trackId }) { task ->
                DownloadTaskCard(
                    task = task,
                    onRetry = { viewModel.retry(task) },
                    onCancel = { viewModel.cancel(task) },
                    onRemove = { viewModel.remove(task) }
                )
            }
        }

        if (!state.actionMessage.isNullOrBlank()) {
            Text(state.actionMessage.orEmpty(), color = MaterialTheme.colorScheme.primary)
        }
        }
    }
}

@Composable
private fun DownloadTaskCard(
    task: DownloadTask,
    onRetry: () -> Unit,
    onCancel: () -> Unit,
    onRemove: () -> Unit
) {
    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(task.title, style = MaterialTheme.typography.titleSmall)
            Text("状态: ${task.status.name} | ${task.progress}%")
            LinearProgressIndicator(progress = { task.progress / 100f }, modifier = Modifier.fillMaxWidth())

            if (!task.errorMessage.isNullOrBlank()) {
                Text(task.errorMessage, color = MaterialTheme.colorScheme.error)
            }
            if (!task.filePath.isNullOrBlank()) {
                Text(task.filePath, style = MaterialTheme.typography.bodySmall)
            }
            if (task.fileBytes > 0) {
                Text("文件大小: ${task.fileBytes} bytes", style = MaterialTheme.typography.bodySmall)
            }

            androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (task.status == DownloadStatus.FAILED || task.status == DownloadStatus.CANCELED) {
                    GlassGhostButton(text = "重试", onClick = onRetry)
                }
                if (task.status == DownloadStatus.QUEUED || task.status == DownloadStatus.RUNNING) {
                    GlassGhostButton(text = "取消", onClick = onCancel)
                }
                GlassGhostButton(text = "移除", onClick = onRemove)
            }
        }
    }
}

