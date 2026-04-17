package com.hoyomusic.mobile.feature.track

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.hoyomusic.mobile.core.common.CoverUrlResolver
import com.hoyomusic.mobile.core.model.Track
import com.hoyomusic.mobile.feature.playlist.PlaylistPickerDialog
import com.hoyomusic.mobile.ui.theme.GlassBackground
import com.hoyomusic.mobile.ui.theme.GlassCard
import com.hoyomusic.mobile.ui.theme.GlassGhostButton
import com.hoyomusic.mobile.ui.theme.GlassPrimaryButton

@Composable
fun TrackDetailRoute(
    onPlay: (Track) -> Unit,
    onRequireLogin: () -> Unit,
    coverUrlResolver: CoverUrlResolver,
    viewModel: TrackDetailViewModel = hiltViewModel()
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
        if (state.loading) {
            CircularProgressIndicator()
            return@Column
        }

        val track = state.track
        if (track == null) {
            Text(state.error ?: "未找到曲目", color = MaterialTheme.colorScheme.error)
            GlassPrimaryButton(text = "重试", onClick = viewModel::load)
            return@Column
        }

        GlassCard(modifier = Modifier.fillMaxWidth()) {
            AsyncImage(
                model = coverUrlResolver.resolve(track.coverPath, thumb = false),
                contentDescription = null,
                modifier = Modifier.fillMaxWidth()
            )
            Text(track.title, style = MaterialTheme.typography.headlineSmall)
            Text(track.albumTitle ?: "未知专辑")
            Text(track.artists.joinToString(" / ") { it.name })
            Text("时长: ${track.durationSeconds ?: 0}s")
            Text("播放: ${track.effectivePlayCount ?: 0} | 收藏: ${track.favoriteCount ?: 0}")
        }

        androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            GlassPrimaryButton(text = "播放", onClick = { onPlay(track) })
            GlassGhostButton(text = "下载", onClick = viewModel::enqueueDownload)
            GlassGhostButton(
                text = if (state.favorited) "取消收藏" else "收藏",
                onClick = viewModel::toggleFavorite,
                enabled = !state.actionLoading
            )
            GlassGhostButton(text = "加入歌单", onClick = viewModel::openPlaylistPicker, enabled = !state.actionLoading)
        }

        Text("音乐来源", style = MaterialTheme.typography.titleMedium)
        if (state.sources.isEmpty()) {
            Text("暂无来源信息", style = MaterialTheme.typography.bodySmall)
        }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            items(state.sources, key = { it.id }) { source ->
                Text("${source.categoryName} / ${source.nodeName}")
            }
        }

        if (!state.actionMessage.isNullOrBlank()) {
            Text(state.actionMessage.orEmpty(), color = MaterialTheme.colorScheme.primary)
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
        onCreatePlaylist = viewModel::createPlaylistAndAddCurrentTrack
    )
}
