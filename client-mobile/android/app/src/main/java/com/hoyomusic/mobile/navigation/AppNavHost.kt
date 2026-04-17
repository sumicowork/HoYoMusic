package com.hoyomusic.mobile.navigation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.graphics.Color
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.hoyomusic.mobile.core.common.CoverUrlResolver
import com.hoyomusic.mobile.core.common.NetworkStatusMonitor
import com.hoyomusic.mobile.core.common.UiMessageBus
import com.hoyomusic.mobile.feature.auth.LoginRoute
import com.hoyomusic.mobile.feature.home.HomeScreenRoute
import com.hoyomusic.mobile.feature.player.MiniPlayerBar
import com.hoyomusic.mobile.feature.player.PlayerRoute
import com.hoyomusic.mobile.feature.player.PlayerViewModel
import com.hoyomusic.mobile.feature.settings.SettingsScreen
import com.hoyomusic.mobile.feature.track.TrackDetailRoute
import com.hoyomusic.mobile.feature.track.TrackListRoute
import com.hoyomusic.mobile.feature.download.DownloadCenterRoute
import com.hoyomusic.mobile.feature.favorite.FavoriteRoute
import com.hoyomusic.mobile.feature.playlist.PlaylistDetailRoute
import com.hoyomusic.mobile.feature.playlist.PlaylistListRoute
import androidx.compose.ui.unit.dp

@Composable
fun AppNavHost(
    playerViewModel: PlayerViewModel,
    coverUrlResolver: CoverUrlResolver,
    messageBus: UiMessageBus,
    networkStatusMonitor: NetworkStatusMonitor
) {
    val navController = rememberNavController()
    val playerState by playerViewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val online by networkStatusMonitor.isOnline.collectAsState()
    val navigateLogin: () -> Unit = { navController.navigate(AppRoutes.LOGIN) }

    LaunchedEffect(Unit) {
        messageBus.messages.collect { msg ->
            snackbarHostState.showSnackbar(msg.text)
        }
    }

    LaunchedEffect(online) {
        if (!online) {
            snackbarHostState.showSnackbar("当前网络不可用")
        }
    }

    Scaffold(
        containerColor = Color.Transparent,
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
        bottomBar = {
            MiniPlayerBar(
                state = playerState,
                onOpenPlayer = { navController.navigate(AppRoutes.PLAYER) },
                onTogglePlayPause = playerViewModel::togglePlayPause,
                onNext = playerViewModel::playNext
            )
        }
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = AppRoutes.HOME,
            modifier = Modifier.padding(padding)
        ) {
            composable(AppRoutes.HOME) {
                HomeScreenRoute(
                    onOpenTrackList = { navController.navigate(AppRoutes.TRACK_LIST) },
                    onOpenTrackDetail = { navController.navigate(AppRoutes.trackDetail(it)) },
                    onOpenPlayer = { navController.navigate(AppRoutes.PLAYER) },
                    onOpenSettings = { navController.navigate(AppRoutes.SETTINGS) },
                    onOpenFavorites = { navController.navigate(AppRoutes.FAVORITES) },
                    onOpenPlaylists = { navController.navigate(AppRoutes.PLAYLISTS) },
                    onOpenDownloads = { navController.navigate(AppRoutes.DOWNLOAD_CENTER) },
                    onPlayTrack = { track, playlist ->
                        playerViewModel.setQueue(playlist = playlist, startTrack = track, autoPlay = true)
                        navController.navigate(AppRoutes.PLAYER)
                    }
                )
            }

            composable(AppRoutes.TRACK_LIST) {
                TrackListRoute(
                    onTrackClick = { navController.navigate(AppRoutes.trackDetail(it)) },
                    onRequireLogin = navigateLogin,
                    onPlay = { track, list ->
                        playerViewModel.setQueue(playlist = list, startTrack = track, autoPlay = true)
                        navController.navigate(AppRoutes.PLAYER)
                    }
                )
            }

            composable(
                route = AppRoutes.TRACK_DETAIL,
                arguments = listOf(navArgument("trackId") { type = NavType.IntType })
            ) {
                TrackDetailRoute(
                    onPlay = { track ->
                        playerViewModel.playTrack(track)
                        navController.navigate(AppRoutes.PLAYER)
                    },
                    onRequireLogin = navigateLogin,
                    coverUrlResolver = coverUrlResolver
                )
            }

            composable(AppRoutes.PLAYER) {
                PlayerRoute(viewModel = playerViewModel)
            }

            composable(AppRoutes.SETTINGS) {
                SettingsScreen(onOpenLogin = { navController.navigate(AppRoutes.LOGIN) })
            }

            composable(AppRoutes.LOGIN) {
                LoginRoute(onLoginSuccess = { navController.popBackStack() })
            }

            composable("unavailable") {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("功能暂不可用")
                }
            }

            composable(AppRoutes.FAVORITES) {
                FavoriteRoute(
                    onOpenTrackDetail = { navController.navigate(AppRoutes.trackDetail(it)) },
                    onRequireLogin = navigateLogin,
                    onPlay = { track, playlist ->
                        playerViewModel.setQueue(playlist = playlist, startTrack = track, autoPlay = true)
                        navController.navigate(AppRoutes.PLAYER)
                    }
                )
            }

            composable(AppRoutes.PLAYLISTS) {
                PlaylistListRoute(
                    onOpenPlaylist = { navController.navigate(AppRoutes.playlistDetail(it)) },
                    onRequireLogin = navigateLogin
                )
            }

            composable(
                route = AppRoutes.PLAYLIST_DETAIL,
                arguments = listOf(navArgument("playlistId") { type = NavType.IntType })
            ) {
                PlaylistDetailRoute(
                    onOpenTrackDetail = { navController.navigate(AppRoutes.trackDetail(it)) },
                    onRequireLogin = navigateLogin,
                    onPlayTrack = { track, playlist ->
                        playerViewModel.setQueue(playlist = playlist, startTrack = track, autoPlay = true)
                        navController.navigate(AppRoutes.PLAYER)
                    }
                )
            }

            composable(AppRoutes.DOWNLOAD_CENTER) {
                DownloadCenterRoute()
            }
        }
    }
}
