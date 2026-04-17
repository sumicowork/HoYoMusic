package com.hoyomusic.mobile.feature.playlist

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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.hoyomusic.mobile.core.model.Track
import com.hoyomusic.mobile.ui.theme.GlassBackground
import com.hoyomusic.mobile.ui.theme.GlassCard
import com.hoyomusic.mobile.ui.theme.GlassGhostButton
import com.hoyomusic.mobile.ui.theme.GlassPrimaryButton
import com.hoyomusic.mobile.ui.theme.GlassSectionTitle

@Composable
fun PlaylistDetailRoute(
    onOpenTrackDetail: (Int) -> Unit,
    onPlayTrack: (Track, List<Track>) -> Unit,
    onRequireLogin: () -> Unit,
    viewModel: PlaylistDetailViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()
    var nameDraft by remember(state.playlist?.id) { mutableStateOf(state.playlist?.name.orEmpty()) }
    var descDraft by remember(state.playlist?.id) { mutableStateOf(state.playlist?.description.orEmpty()) }
    var addTrackIdInput by remember { mutableStateOf("") }

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
        GlassSectionTitle("歌单详情")

        if (state.loading) {
            CircularProgressIndicator()
        }

        state.playlist?.let { playlist ->
            OutlinedTextField(
                modifier = Modifier.fillMaxWidth(),
                value = nameDraft,
                onValueChange = { nameDraft = it },
                label = { Text("歌单名称") }
            )
            OutlinedTextField(
                modifier = Modifier.fillMaxWidth(),
                value = descDraft,
                onValueChange = { descDraft = it },
                label = { Text("歌单描述") }
            )
            GlassPrimaryButton(
                text = if (state.saving) "保存中" else "保存信息",
                onClick = { viewModel.updateMeta(nameDraft, descDraft) },
                enabled = !state.saving
            )

            Text("共 ${state.tracks.size} 首", style = MaterialTheme.typography.bodySmall)

            OutlinedTextField(
                modifier = Modifier.fillMaxWidth(),
                value = state.query,
                onValueChange = viewModel::updateQuery,
                label = { Text("搜索歌单曲目") }
            )
            androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GlassGhostButton(text = "原顺序", onClick = { viewModel.updateSortMode(PlaylistTrackSortMode.POSITION) })
                GlassGhostButton(text = "A-Z", onClick = { viewModel.updateSortMode(PlaylistTrackSortMode.TITLE_ASC) })
                GlassGhostButton(text = "Z-A", onClick = { viewModel.updateSortMode(PlaylistTrackSortMode.TITLE_DESC) })
            }

            OutlinedTextField(
                modifier = Modifier.fillMaxWidth(),
                value = addTrackIdInput,
                onValueChange = { addTrackIdInput = it },
                label = { Text("追加曲目 ID") }
            )
            GlassGhostButton(text = "追加曲目", onClick = {
                addTrackIdInput.toIntOrNull()?.let(viewModel::addTrack)
                addTrackIdInput = ""
            })

            if (state.visibleTracks.isEmpty()) {
                Text("当前歌单暂无曲目", style = MaterialTheme.typography.bodySmall)
            }

            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(state.visibleTracks, key = { it.id }) { track ->
                    GlassCard(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(track.title, style = MaterialTheme.typography.titleSmall)
                            Text(track.artists.joinToString(" / ") { it.name }, style = MaterialTheme.typography.bodySmall)
                            androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                GlassGhostButton(text = "详情", onClick = { onOpenTrackDetail(track.id) })
                                GlassPrimaryButton(text = "播放", onClick = { onPlayTrack(track, state.visibleTracks) })
                                GlassGhostButton(text = "上移", onClick = { viewModel.moveTrack(track.id, -1) })
                                GlassGhostButton(text = "下移", onClick = { viewModel.moveTrack(track.id, 1) })
                                GlassGhostButton(text = "移除", onClick = { viewModel.removeTrack(track.id) })
                            }
                        }
                    }
                }
            }
        }

        if (!state.error.isNullOrBlank()) {
            Text(state.error.orEmpty(), color = MaterialTheme.colorScheme.error)
            GlassPrimaryButton(text = "重试", onClick = viewModel::refresh)
        }
        }
    }
}

