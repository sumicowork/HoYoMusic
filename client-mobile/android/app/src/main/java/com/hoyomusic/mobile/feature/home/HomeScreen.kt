package com.hoyomusic.mobile.feature.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.hoyomusic.mobile.core.model.Track
import com.hoyomusic.mobile.ui.theme.GlassBackground
import com.hoyomusic.mobile.ui.theme.GlassCard
import com.hoyomusic.mobile.ui.theme.GlassGhostButton
import com.hoyomusic.mobile.ui.theme.GlassPrimaryButton
import com.hoyomusic.mobile.ui.theme.GlassSectionTitle
import com.hoyomusic.mobile.ui.theme.GlassStatChips

@Composable
fun HomeScreenRoute(
    onOpenTrackList: () -> Unit,
    onOpenTrackDetail: (Int) -> Unit,
    onOpenPlayer: () -> Unit,
    onOpenSettings: () -> Unit,
    onOpenFavorites: () -> Unit,
    onOpenPlaylists: () -> Unit,
    onOpenDownloads: () -> Unit,
    onPlayTrack: (Track, List<Track>) -> Unit,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    HomeScreen(
        state = uiState,
        onRetry = viewModel::refresh,
        onOpenTrackList = onOpenTrackList,
        onOpenTrackDetail = onOpenTrackDetail,
        onOpenPlayer = onOpenPlayer,
        onOpenSettings = onOpenSettings,
        onOpenFavorites = onOpenFavorites,
        onOpenPlaylists = onOpenPlaylists,
        onOpenDownloads = onOpenDownloads,
        onPlayTrack = onPlayTrack
    )
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
private fun HomeScreen(
    state: HomeUiState,
    onRetry: () -> Unit,
    onOpenTrackList: () -> Unit,
    onOpenTrackDetail: (Int) -> Unit,
    onOpenPlayer: () -> Unit,
    onOpenSettings: () -> Unit,
    onOpenFavorites: () -> Unit,
    onOpenPlaylists: () -> Unit,
    onOpenDownloads: () -> Unit,
    onPlayTrack: (Track, List<Track>) -> Unit
) {
    GlassBackground {
        Scaffold(
            containerColor = androidx.compose.ui.graphics.Color.Transparent,
            topBar = { TopAppBar(title = { Text("HoYoMusic") }) }
        ) { padding ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                HealthCard(state = state)

                GlassStatChips(
                    "最新 ${state.latestTracks.size}",
                    "推荐 ${state.randomTracks.size}",
                    "热门 ${state.topTracks.size}"
                )

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    GlassPrimaryButton(text = "全部曲目", onClick = onOpenTrackList)
                    GlassGhostButton(text = "播放器", onClick = onOpenPlayer)
                    GlassGhostButton(text = "设置", onClick = onOpenSettings)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    GlassGhostButton(text = "收藏", onClick = onOpenFavorites)
                    GlassGhostButton(text = "歌单", onClick = onOpenPlaylists)
                    GlassGhostButton(text = "下载", onClick = onOpenDownloads)
                }

                if (state.isLoading) {
                    CircularProgressIndicator(modifier = Modifier.padding(top = 16.dp))
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxWidth(),
                        contentPadding = PaddingValues(bottom = 20.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        item { GlassSectionTitle("最新曲目") }
                        items(items = state.latestTracks, key = { "latest-${it.id}" }) { track ->
                            TrackRow(track = track, onOpen = { onOpenTrackDetail(track.id) }, onPlay = { onPlayTrack(track, state.latestTracks) })
                        }

                        item { GlassSectionTitle("随机推荐") }
                        items(items = state.randomTracks, key = { "random-${it.id}" }) { track ->
                            TrackRow(track = track, onOpen = { onOpenTrackDetail(track.id) }, onPlay = { onPlayTrack(track, state.randomTracks) })
                        }

                        item { GlassSectionTitle("热门曲目") }
                        items(items = state.topTracks, key = { "top-${it.id}" }) { track ->
                            TrackRow(track = track, onOpen = { onOpenTrackDetail(track.id) }, onPlay = { onPlayTrack(track, state.topTracks) })
                        }
                    }
                }

                if (!state.errorMessage.isNullOrBlank()) {
                    Text(
                        text = state.errorMessage,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodyMedium
                    )
                    GlassPrimaryButton(text = "重试", onClick = onRetry)
                }
            }
        }
    }
}

@Composable
private fun HealthCard(state: HomeUiState) {
    val health = state.health
    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(text = "服务健康状态", style = MaterialTheme.typography.titleMedium)
            if (health == null) {
                Text(text = "未获取", style = MaterialTheme.typography.bodyMedium)
            } else {
                Text(
                    text = if (health.isHealthy) "可达" else "不可达",
                    style = MaterialTheme.typography.bodyLarge
                )
                Text(text = "消息: ${health.message}", style = MaterialTheme.typography.bodySmall)
                Text(text = "数据库: ${health.database ?: "unknown"}", style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun TrackRow(track: Track, onOpen: () -> Unit, onPlay: () -> Unit) {
    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(text = track.title, style = MaterialTheme.typography.titleSmall)
            Text(
                text = track.albumTitle ?: "未知专辑",
                style = MaterialTheme.typography.bodySmall
            )
            val artists = if (track.artists.isEmpty()) {
                "Unknown Artist"
            } else {
                track.artists.joinToString(" / ") { it.name }
            }
            Text(text = artists, style = MaterialTheme.typography.bodySmall)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GlassGhostButton(text = "详情", onClick = onOpen)
                GlassPrimaryButton(text = "播放", onClick = onPlay)
            }
        }
    }
}
