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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.hoyomusic.mobile.ui.theme.GlassBackground
import com.hoyomusic.mobile.ui.theme.GlassCard
import com.hoyomusic.mobile.ui.theme.GlassGhostButton
import com.hoyomusic.mobile.ui.theme.GlassPrimaryButton
import com.hoyomusic.mobile.ui.theme.GlassSectionTitle

@Composable
fun PlaylistListRoute(
    onOpenPlaylist: (Int) -> Unit,
    onRequireLogin: () -> Unit,
    viewModel: PlaylistListViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()
    var newName by remember { mutableStateOf("") }
    var newDescription by remember { mutableStateOf("") }

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
        GlassSectionTitle("我的歌单")

        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = state.query,
            onValueChange = viewModel::updateQuery,
            label = { Text("搜索歌单") }
        )
        androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            GlassGhostButton(text = "最近更新", onClick = { viewModel.updateSortMode(PlaylistSortMode.UPDATED_DESC) })
            GlassGhostButton(text = "名称", onClick = { viewModel.updateSortMode(PlaylistSortMode.NAME_ASC) })
            GlassGhostButton(text = "曲目数", onClick = { viewModel.updateSortMode(PlaylistSortMode.TRACK_COUNT_DESC) })
        }

        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = newName,
            onValueChange = { newName = it },
            label = { Text("新歌单名称") }
        )
        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = newDescription,
            onValueChange = { newDescription = it },
            label = { Text("描述（可选）") }
        )
        GlassPrimaryButton(text = if (state.creating) "创建中" else "创建歌单", onClick = {
            viewModel.createPlaylist(newName, newDescription)
            if (newName.isNotBlank()) {
                newName = ""
                newDescription = ""
            }
        }, enabled = !state.creating)

        if (state.loading) {
            CircularProgressIndicator()
        }

        if (!state.loading && state.visiblePlaylists.isEmpty()) {
            Text("暂无歌单，可先创建一个", style = MaterialTheme.typography.bodySmall)
        }

        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(state.visiblePlaylists, key = { it.id }) { playlist ->
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(playlist.name, style = MaterialTheme.typography.titleSmall)
                        Text("${playlist.trackCount} 首 | 总时长 ${playlist.totalDuration}s", style = MaterialTheme.typography.bodySmall)
                        if (!playlist.description.isNullOrBlank()) {
                            Text(playlist.description, style = MaterialTheme.typography.bodySmall)
                        }
                        androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            GlassGhostButton(text = "查看", onClick = { onOpenPlaylist(playlist.id) })
                            GlassGhostButton(text = "删除", onClick = { viewModel.deletePlaylist(playlist.id) })
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

