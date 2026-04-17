package com.hoyomusic.mobile.feature.track

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AssistChip
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

@Composable
fun TrackListRoute(
    onTrackClick: (Int) -> Unit,
    onPlay: (Track, List<Track>) -> Unit,
    onRequireLogin: () -> Unit,
    viewModel: TrackListViewModel = hiltViewModel()
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
        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = state.search,
            onValueChange = viewModel::updateSearch,
            label = { Text("搜索曲目") }
        )
        androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            GlassPrimaryButton(text = "搜索", onClick = viewModel::refresh)
            GlassGhostButton(
                text = if (state.showAdvancedFilter) "收起高级" else "高级筛选",
                onClick = viewModel::toggleAdvancedFilter
            )
        }

        TrackSortControls(
            sortBy = state.filter.sortBy,
            sortDir = state.filter.sortDir,
            onSortByChange = {
                viewModel.updateFilter { filter -> filter.copy(sortBy = it) }
                viewModel.refresh()
            },
            onSortDirChange = {
                viewModel.updateFilter { filter -> filter.copy(sortDir = it) }
                viewModel.refresh()
            }
        )

        if (state.showAdvancedFilter) {
            TrackAdvancedFilterSheet(
                state = state.filter,
                onStateChange = { next -> viewModel.updateFilter { next } },
                onApply = viewModel::refresh,
                onReset = {
                    viewModel.resetFilter()
                    viewModel.refresh()
                }
            )
        }

        if (state.filter.gameIdsRaw.isNotBlank()) {
            AssistChip(onClick = {}, label = { Text("game_ids=${state.filter.gameIdsRaw}") })
        }
        if (state.filter.tagIdsRaw.isNotBlank()) {
            AssistChip(onClick = {}, label = { Text("tag_ids=${state.filter.tagIdsRaw}") })
        }

        if (state.loading) {
            CircularProgressIndicator()
        } else {
            if (state.items.isEmpty()) {
                Text("暂无匹配曲目，请调整筛选条件", style = MaterialTheme.typography.bodySmall)
            }
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(state.items, key = { it.id }) { track ->
                    TrackListItem(
                        track = track,
                        isFavorited = state.favoriteIds.contains(track.id),
                        operating = state.operatingTrackId == track.id,
                        onOpen = { onTrackClick(track.id) },
                        onPlay = { onPlay(track, state.items) },
                        onToggleFavorite = { viewModel.toggleFavorite(track) },
                        onDownload = { viewModel.enqueueDownload(track) },
                        onAddToPlaylist = { viewModel.openPlaylistPicker(track.id) }
                    )
                }
                item {
                    if (state.loadingMore) {
                        CircularProgressIndicator()
                    } else if (state.hasMore) {
                        GlassGhostButton(text = "加载更多", onClick = viewModel::loadMore)
                    }
                }
            }
        }

        if (!state.error.isNullOrBlank()) {
            Text(state.error.orEmpty(), color = MaterialTheme.colorScheme.error)
        }
        }
    }

    PlaylistPickerDialog(
        state = state.picker,
        onDismiss = viewModel::closePlaylistPicker,
        onQueryChange = viewModel::updatePickerQuery,
        onPick = { viewModel.addTrackToPlaylist(it.id) },
        onNewPlaylistNameChange = viewModel::updateNewPlaylistName,
        onCreatePlaylist = viewModel::createPlaylistAndAddTrack
    )
}

@Composable
private fun TrackListItem(
    track: Track,
    isFavorited: Boolean,
    operating: Boolean,
    onOpen: () -> Unit,
    onPlay: () -> Unit,
    onToggleFavorite: () -> Unit,
    onDownload: () -> Unit,
    onAddToPlaylist: () -> Unit
) {
    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(track.title, style = MaterialTheme.typography.titleSmall)
            Text(track.albumTitle ?: "未知专辑", style = MaterialTheme.typography.bodySmall)
            Text(track.artists.joinToString(" / ") { it.name }, style = MaterialTheme.typography.bodySmall)
            androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GlassGhostButton(text = "详情", onClick = onOpen)
                GlassPrimaryButton(text = "播放", onClick = onPlay)
                GlassGhostButton(text = "下载", onClick = onDownload)
            }
            androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GlassGhostButton(
                    text = if (isFavorited) "取消收藏" else "收藏",
                    onClick = onToggleFavorite,
                    enabled = !operating
                )
                GlassGhostButton(text = "加入歌单", onClick = onAddToPlaylist)
            }
        }
    }
}
