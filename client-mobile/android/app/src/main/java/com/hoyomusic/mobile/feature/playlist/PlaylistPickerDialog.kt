package com.hoyomusic.mobile.feature.playlist

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.hoyomusic.mobile.core.model.Playlist

@Composable
fun PlaylistPickerDialog(
    state: PlaylistPickerState,
    onDismiss: () -> Unit,
    onQueryChange: (String) -> Unit,
    onPick: (Playlist) -> Unit,
    onNewPlaylistNameChange: (String) -> Unit,
    onCreatePlaylist: () -> Unit
) {
    if (!state.visible) return

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("选择歌单") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    modifier = Modifier.fillMaxWidth(),
                    value = state.query,
                    onValueChange = onQueryChange,
                    label = { Text("搜索歌单") }
                )

                OutlinedTextField(
                    modifier = Modifier.fillMaxWidth(),
                    value = state.newPlaylistName,
                    onValueChange = onNewPlaylistNameChange,
                    label = { Text("新建歌单名称") }
                )
                Button(onClick = onCreatePlaylist, enabled = !state.creating) {
                    Text(if (state.creating) "创建中" else "新建并加入")
                }

                if (state.loading) {
                    CircularProgressIndicator(modifier = Modifier.padding(vertical = 6.dp))
                }

                LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(state.filteredPlaylists, key = { it.id }) { playlist ->
                        Button(onClick = { onPick(playlist) }, modifier = Modifier.fillMaxWidth()) {
                            Text("${playlist.name} (${playlist.trackCount} 首)")
                        }
                    }
                }

                if (!state.loading && state.filteredPlaylists.isEmpty()) {
                    Text("没有匹配歌单，可直接新建并加入", style = MaterialTheme.typography.bodySmall)
                }

                if (!state.error.isNullOrBlank()) {
                    Text(state.error, color = MaterialTheme.colorScheme.error)
                }
            }
        },
        confirmButton = {
            Button(onClick = onDismiss) { Text("关闭") }
        }
    )
}

