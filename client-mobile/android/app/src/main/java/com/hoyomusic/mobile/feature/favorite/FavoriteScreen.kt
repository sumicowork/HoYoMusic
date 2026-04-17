package com.hoyomusic.mobile.feature.favorite

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.hoyomusic.mobile.core.model.Track
import com.hoyomusic.mobile.feature.playlist.PlaylistPickerDialog
import com.hoyomusic.mobile.ui.theme.GlassBackground
import com.hoyomusic.mobile.ui.theme.GlassCard
import com.hoyomusic.mobile.ui.theme.GlassGhostButton
import com.hoyomusic.mobile.ui.theme.GlassPrimaryButton
import com.hoyomusic.mobile.ui.theme.GlassSectionTitle

@Composable
fun FavoriteRoute(
    onOpenTrackDetail: (Int) -> Unit,
    onPlay: (Track, List<Track>) -> Unit,
    onRequireLogin: () -> Unit,
    viewModel: FavoriteViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(state.requestLogin) {
        if (state.requestLogin) {
            onRequireLogin()
            viewModel.consumeLoginRequest()
        }
    }

    GlassBackground {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
        GlassSectionTitle("我的收藏")

        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = state.query,
            onValueChange = viewModel::updateQuery,
            label = { Text("筛选收藏") }
        )
        androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            GlassGhostButton(text = "最新", onClick = { viewModel.updateSortMode(FavoriteSortMode.LATEST) })
            GlassGhostButton(text = "A-Z", onClick = { viewModel.updateSortMode(FavoriteSortMode.TITLE_ASC) })
            GlassGhostButton(text = "Z-A", onClick = { viewModel.updateSortMode(FavoriteSortMode.TITLE_DESC) })
        }

        if (state.loading && state.tracks.isEmpty()) {
            CircularProgressIndicator()
        }

        if (!state.loading && state.visibleTracks.isEmpty()) {
            Text("暂无收藏曲目", style = MaterialTheme.typography.bodySmall)
        }

        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(state.visibleTracks, key = { it.id }) { track ->
                FavoriteTrackCard(
                    track = track,
                    isOperating = state.operatingTrackId == track.id,
                    onOpen = { onOpenTrackDetail(track.id) },
                    onPlay = { onPlay(track, state.visibleTracks) },
                    onDownload = { viewModel.enqueueDownload(track) },
                    onAddToPlaylist = { viewModel.openPlaylistPicker(track.id) },
                    onUnfavorite = { viewModel.toggleFavorite(track) }
                )
            }

            item {
                if (state.hasMore) {
                    GlassGhostButton(text = "加载更多", onClick = viewModel::loadMore)
                }
            }
        }

        if (!state.error.isNullOrBlank()) {
            Text(state.error.orEmpty(), color = MaterialTheme.colorScheme.error)
            GlassPrimaryButton(text = "重试", onClick = viewModel::refresh)
        }
        }
    }

    PlaylistPickerDialog(
        state = state.picker,
        onDismiss = viewModel::closePlaylistPicker,
        onQueryChange = viewModel::updatePickerQuery,
        onPick = { viewModel.addTrackToPlaylist(it.id) },
        onNewPlaylistNameChange = viewModel::updateNewPlaylistName,
        onCreatePlaylist = viewModel::createPlaylistAndAdd
    )
}

@Composable
private fun FavoriteTrackCard(
    track: Track,
    isOperating: Boolean,
    onOpen: () -> Unit,
    onPlay: () -> Unit,
    onDownload: () -> Unit,
    onAddToPlaylist: () -> Unit,
    onUnfavorite: () -> Unit
) {
    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(track.title, style = MaterialTheme.typography.titleSmall)
            Text(track.albumTitle ?: "未知专辑", style = MaterialTheme.typography.bodySmall)
            Text(track.artists.joinToString(" / ") { it.name }, style = MaterialTheme.typography.bodySmall)

            androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GlassGhostButton(text = "详情", onClick = onOpen)
                GlassPrimaryButton(text = "播放", onClick = onPlay)
                GlassGhostButton(text = "下载", onClick = onDownload)
            }
            androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GlassGhostButton(text = "加入歌单", onClick = onAddToPlaylist)
                GlassGhostButton(text = if (isOperating) "处理中" else "取消收藏", onClick = onUnfavorite, enabled = !isOperating)
            }
        }
    }
}

