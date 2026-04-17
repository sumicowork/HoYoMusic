package com.hoyomusic.mobile.feature.track

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hoyomusic.mobile.core.model.Track
import com.hoyomusic.mobile.core.model.TrackMusicSource
import com.hoyomusic.mobile.core.network.ApiResult
import com.hoyomusic.mobile.data.DownloadRepository
import com.hoyomusic.mobile.data.FavoriteRepository
import com.hoyomusic.mobile.data.PlaylistRepository
import com.hoyomusic.mobile.data.TrackRepository
import com.hoyomusic.mobile.feature.playlist.PlaylistPickerState
import com.hoyomusic.mobile.session.SessionGate
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

data class TrackDetailUiState(
    val loading: Boolean = true,
    val track: Track? = null,
    val sources: List<TrackMusicSource> = emptyList(),
    val error: String? = null,
    val favorited: Boolean = false,
    val picker: PlaylistPickerState = PlaylistPickerState(),
    val actionMessage: String? = null,
    val actionLoading: Boolean = false,
    val requestLogin: Boolean = false
)

@HiltViewModel
class TrackDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val trackRepository: TrackRepository,
    private val favoriteRepository: FavoriteRepository,
    private val playlistRepository: PlaylistRepository,
    private val downloadRepository: DownloadRepository,
    private val sessionGate: SessionGate
) : ViewModel() {

    private val trackId: Int = checkNotNull(savedStateHandle["trackId"])
    private val _uiState = MutableStateFlow(TrackDetailUiState())
    val uiState: StateFlow<TrackDetailUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _uiState.value = TrackDetailUiState(loading = true)

            val detailDeferred = async { trackRepository.getTrackDetail(trackId).first() }
            val sourceDeferred = async { trackRepository.getTrackMusicSources(trackId).first() }
            val favoriteDeferred = async {
                if (!sessionGate.isAuthenticated()) {
                    ApiResult.Success(emptyMap())
                } else {
                    favoriteRepository.checkFavorites(listOf(trackId)).first()
                }
            }

            val detailResult = detailDeferred.await()
            val sourceResult = sourceDeferred.await()
            val favoriteResult = favoriteDeferred.await()

            var next = TrackDetailUiState(loading = false)
            when (detailResult) {
                is ApiResult.Success -> next = next.copy(track = detailResult.data)
                is ApiResult.Failure -> next = next.copy(error = detailResult.error.message)
            }
            when (sourceResult) {
                is ApiResult.Success -> next = next.copy(sources = sourceResult.data)
                is ApiResult.Failure -> if (next.error == null) next = next.copy(error = sourceResult.error.message)
            }
            when (favoriteResult) {
                is ApiResult.Success -> next = next.copy(favorited = favoriteResult.data[trackId] == true)
                is ApiResult.Failure -> Unit
            }
            _uiState.value = next
        }
    }

    fun toggleFavorite() {
        val track = _uiState.value.track ?: return
        if (!sessionGate.ensureAuthenticated("收藏功能")) {
            _uiState.value = _uiState.value.copy(requestLogin = true)
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(actionLoading = true, actionMessage = null)
            when (val result = favoriteRepository.toggle(track.id).first()) {
                is ApiResult.Success -> {
                    val nowFavorited = result.data
                    _uiState.value = _uiState.value.copy(
                        actionLoading = false,
                        favorited = nowFavorited,
                        actionMessage = if (nowFavorited) "已加入收藏" else "已取消收藏"
                    )
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(actionLoading = false, error = result.error.message)
                }
            }
        }
    }

    fun enqueueDownload() {
        val track = _uiState.value.track ?: return
        downloadRepository.enqueue(track)
        _uiState.value = _uiState.value.copy(actionMessage = "已加入下载队列")
    }

    fun openPlaylistPicker() {
        if (!sessionGate.ensureAuthenticated("歌单功能")) {
            _uiState.value = _uiState.value.copy(requestLogin = true)
            return
        }

        _uiState.value = _uiState.value.copy(picker = _uiState.value.picker.copy(visible = true, loading = true, error = null))
        viewModelScope.launch {
            when (val result = playlistRepository.getPlaylists().first()) {
                is ApiResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        picker = _uiState.value.picker.copy(loading = false, playlists = result.data, error = null)
                    )
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(
                        picker = _uiState.value.picker.copy(loading = false, error = result.error.message)
                    )
                }
            }
        }
    }

    fun closePlaylistPicker() {
        _uiState.value = _uiState.value.copy(picker = PlaylistPickerState())
    }

    fun updatePickerQuery(value: String) {
        _uiState.value = _uiState.value.copy(picker = _uiState.value.picker.copy(query = value))
    }

    fun updateNewPlaylistName(value: String) {
        _uiState.value = _uiState.value.copy(picker = _uiState.value.picker.copy(newPlaylistName = value))
    }

    fun createPlaylistAndAddCurrentTrack() {
        val name = _uiState.value.picker.newPlaylistName.trim()
        if (name.isBlank()) {
            _uiState.value = _uiState.value.copy(picker = _uiState.value.picker.copy(error = "请输入歌单名称"))
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(picker = _uiState.value.picker.copy(creating = true, error = null))
            when (val createResult = playlistRepository.createPlaylist(name, null).first()) {
                is ApiResult.Success -> addTrackToPlaylist(createResult.data.id)
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(
                        picker = _uiState.value.picker.copy(creating = false, error = createResult.error.message)
                    )
                }
            }
        }
    }

    fun addTrackToPlaylist(playlistId: Int) {
        viewModelScope.launch {
            when (val result = playlistRepository.addTrack(playlistId = playlistId, trackId = trackId).first()) {
                is ApiResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        picker = PlaylistPickerState(),
                        actionMessage = "已添加到歌单"
                    )
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(
                        picker = _uiState.value.picker.copy(creating = false, error = result.error.message)
                    )
                }
            }
        }
    }

    fun consumeLoginRequest() {
        _uiState.value = _uiState.value.copy(requestLogin = false)
    }
}
