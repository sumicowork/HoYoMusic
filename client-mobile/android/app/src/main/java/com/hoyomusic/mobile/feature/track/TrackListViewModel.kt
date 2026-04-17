package com.hoyomusic.mobile.feature.track

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hoyomusic.mobile.core.model.Track
import com.hoyomusic.mobile.core.model.TrackSearchParams
import com.hoyomusic.mobile.core.network.ApiResult
import com.hoyomusic.mobile.data.DownloadRepository
import com.hoyomusic.mobile.data.FavoriteRepository
import com.hoyomusic.mobile.data.PlaylistRepository
import com.hoyomusic.mobile.data.TrackRepository
import com.hoyomusic.mobile.feature.playlist.PlaylistPickerState
import com.hoyomusic.mobile.session.SessionGate
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

data class TrackListUiState(
    val items: List<Track> = emptyList(),
    val loading: Boolean = false,
    val loadingMore: Boolean = false,
    val page: Int = 1,
    val hasMore: Boolean = true,
    val search: String = "",
    val filter: TrackFilterUiState = TrackFilterUiState(),
    val showAdvancedFilter: Boolean = false,
    val favoriteIds: Set<Int> = emptySet(),
    val picker: PlaylistPickerState = PlaylistPickerState(),
    val pickerTrackId: Int? = null,
    val operatingTrackId: Int? = null,
    val requestLogin: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class TrackListViewModel @Inject constructor(
    private val trackRepository: TrackRepository,
    private val favoriteRepository: FavoriteRepository,
    private val playlistRepository: PlaylistRepository,
    private val downloadRepository: DownloadRepository,
    private val sessionGate: SessionGate
) : ViewModel() {
    private val _uiState = MutableStateFlow(TrackListUiState(loading = true))
    val uiState: StateFlow<TrackListUiState> = _uiState.asStateFlow()
    private var requestJob: Job? = null

    init {
        refresh()
    }

    fun updateSearch(value: String) {
        _uiState.value = _uiState.value.copy(search = value)
    }

    fun updateFilter(transform: (TrackFilterUiState) -> TrackFilterUiState) {
        _uiState.value = _uiState.value.copy(filter = transform(_uiState.value.filter))
    }

    fun toggleAdvancedFilter() {
        _uiState.value = _uiState.value.copy(showAdvancedFilter = !_uiState.value.showAdvancedFilter)
    }

    fun resetFilter() {
        _uiState.value = _uiState.value.copy(filter = TrackFilterUiState())
    }

    fun refresh() {
        requestJob?.cancel()
        requestJob = viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loading = true, page = 1, error = null)
            val params = _uiState.value.filter.toParams(
                search = _uiState.value.search,
                page = 1,
                limit = 20
            )
            when (val result = trackRepository.searchPublicTracks(params).first()) {
                is ApiResult.Success -> {
                    val tracks = result.data.tracks
                    val favoriteIds = fetchFavoriteIds(tracks)
                    _uiState.value = _uiState.value.copy(
                        loading = false,
                        items = tracks,
                        favoriteIds = favoriteIds,
                        hasMore = result.data.pagination.page < result.data.pagination.totalPages,
                        page = 1
                    )
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(loading = false, error = result.error.message)
                }
            }
        }
    }

    fun loadMore() {
        val state = _uiState.value
        if (state.loading || state.loadingMore || !state.hasMore) return

        viewModelScope.launch {
            _uiState.value = state.copy(loadingMore = true, error = null)
            val nextPage = state.page + 1
            val params = state.filter.toParams(
                search = state.search,
                page = nextPage,
                limit = 20
            )
            when (val result = trackRepository.searchPublicTracks(params).first()) {
                is ApiResult.Success -> {
                    val merged = state.items + result.data.tracks
                    val favoriteIds = fetchFavoriteIds(merged)
                    _uiState.value = _uiState.value.copy(
                        loadingMore = false,
                        page = nextPage,
                        items = merged,
                        favoriteIds = favoriteIds,
                        hasMore = nextPage < result.data.pagination.totalPages
                    )
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(loadingMore = false, error = result.error.message)
                }
            }
        }
    }

    fun toggleFavorite(track: Track) {
        if (!sessionGate.ensureAuthenticated("收藏功能")) {
            _uiState.value = _uiState.value.copy(requestLogin = true)
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(operatingTrackId = track.id, error = null)
            when (val result = favoriteRepository.toggle(track.id).first()) {
                is ApiResult.Success -> {
                    val newSet = _uiState.value.favoriteIds.toMutableSet()
                    if (result.data) {
                        newSet += track.id
                    } else {
                        newSet -= track.id
                    }
                    _uiState.value = _uiState.value.copy(
                        favoriteIds = newSet,
                        operatingTrackId = null
                    )
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(operatingTrackId = null, error = result.error.message)
                }
            }
        }
    }

    fun enqueueDownload(track: Track) {
        downloadRepository.enqueue(track)
    }

    fun openPlaylistPicker(trackId: Int) {
        if (!sessionGate.ensureAuthenticated("歌单功能")) {
            _uiState.value = _uiState.value.copy(requestLogin = true)
            return
        }

        _uiState.value = _uiState.value.copy(
            pickerTrackId = trackId,
            picker = _uiState.value.picker.copy(visible = true, loading = true, error = null)
        )

        viewModelScope.launch {
            when (val result = playlistRepository.getPlaylists().first()) {
                is ApiResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        picker = _uiState.value.picker.copy(
                            loading = false,
                            playlists = result.data,
                            error = null
                        )
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
        _uiState.value = _uiState.value.copy(
            pickerTrackId = null,
            picker = PlaylistPickerState()
        )
    }

    fun updatePickerQuery(value: String) {
        _uiState.value = _uiState.value.copy(picker = _uiState.value.picker.copy(query = value))
    }

    fun updateNewPlaylistName(value: String) {
        _uiState.value = _uiState.value.copy(picker = _uiState.value.picker.copy(newPlaylistName = value))
    }

    fun createPlaylistAndAddTrack() {
        val state = _uiState.value
        val trackId = state.pickerTrackId ?: return
        val name = state.picker.newPlaylistName.trim()
        if (name.isBlank()) {
            _uiState.value = state.copy(picker = state.picker.copy(error = "请输入歌单名称"))
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(picker = _uiState.value.picker.copy(creating = true, error = null))
            when (val createResult = playlistRepository.createPlaylist(name, null).first()) {
                is ApiResult.Success -> {
                    val playlist = createResult.data
                    when (val addResult = playlistRepository.addTrack(playlist.id, trackId).first()) {
                        is ApiResult.Success -> {
                            _uiState.value = _uiState.value.copy(
                                picker = PlaylistPickerState(),
                                pickerTrackId = null
                            )
                        }
                        is ApiResult.Failure -> {
                            _uiState.value = _uiState.value.copy(
                                picker = _uiState.value.picker.copy(creating = false, error = addResult.error.message)
                            )
                        }
                    }
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(
                        picker = _uiState.value.picker.copy(creating = false, error = createResult.error.message)
                    )
                }
            }
        }
    }

    fun addTrackToPlaylist(playlistId: Int) {
        val trackId = _uiState.value.pickerTrackId ?: return
        viewModelScope.launch {
            when (val result = playlistRepository.addTrack(playlistId, trackId).first()) {
                is ApiResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        picker = PlaylistPickerState(),
                        pickerTrackId = null
                    )
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(
                        picker = _uiState.value.picker.copy(error = result.error.message)
                    )
                }
            }
        }
    }

    fun consumeLoginRequest() {
        _uiState.value = _uiState.value.copy(requestLogin = false)
    }

    private suspend fun fetchFavoriteIds(tracks: List<Track>): Set<Int> {
        if (!sessionGate.isAuthenticated() || tracks.isEmpty()) return emptySet()
        return when (val favoriteResult = favoriteRepository.checkFavorites(tracks.map { it.id }).first()) {
            is ApiResult.Success -> favoriteResult.data.filterValues { it }.keys
            is ApiResult.Failure -> emptySet()
        }
    }
}
