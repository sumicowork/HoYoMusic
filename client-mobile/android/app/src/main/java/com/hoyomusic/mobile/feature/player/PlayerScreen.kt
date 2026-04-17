package com.hoyomusic.mobile.feature.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.hoyomusic.mobile.core.player.PlayMode
import com.hoyomusic.mobile.ui.theme.GlassBackground
import com.hoyomusic.mobile.ui.theme.GlassGhostButton
import com.hoyomusic.mobile.ui.theme.GlassPrimaryButton

@Composable
fun PlayerRoute(viewModel: PlayerViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsState()
    val currentTrack = state.currentTrack

    GlassBackground {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
        Text("播放器", style = MaterialTheme.typography.headlineSmall)
        Text(currentTrack?.title ?: "未选择曲目", style = MaterialTheme.typography.titleLarge)
        Text(currentTrack?.artists?.joinToString(" / ") { it.name } ?: "Unknown Artist")
        Text("焦点状态: ${state.audioFocusState}")
        Text("播放来源: ${state.playbackOrigin}")
        Text("服务绑定: ${state.isServiceBound}")

        Slider(
            modifier = Modifier.fillMaxWidth(),
            value = state.progressMs.toFloat(),
            onValueChange = { viewModel.seekTo(it.toLong()) },
            valueRange = 0f..state.durationMs.coerceAtLeast(1).toFloat()
        )

        Text("${state.progressMs / 1000}s / ${state.durationMs / 1000}s")

        androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            IconButton(onClick = viewModel::playPrevious) {
                Icon(Icons.Default.SkipPrevious, contentDescription = null)
            }
            IconButton(onClick = viewModel::togglePlayPause) {
                Icon(if (state.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow, contentDescription = null)
            }
            IconButton(onClick = viewModel::playNext) {
                Icon(Icons.Default.SkipNext, contentDescription = null)
            }
        }

        GlassGhostButton(text = when (state.playMode) {
            PlayMode.SEQUENCE -> "模式: 顺序"
            PlayMode.LOOP -> "模式: 列表循环"
            PlayMode.SHUFFLE -> "模式: 随机"
            PlayMode.SINGLE -> "模式: 单曲循环"
        }, onClick = viewModel::togglePlayMode)

        if (!state.errorMessage.isNullOrBlank()) {
            Text(state.errorMessage.orEmpty(), color = MaterialTheme.colorScheme.error)
            GlassPrimaryButton(text = "清除错误", onClick = viewModel::clearError)
        }
        }
    }
}

