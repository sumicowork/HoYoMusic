package com.hoyomusic.mobile

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.platform.LocalContext
import androidx.hilt.navigation.compose.hiltViewModel
import dagger.hilt.android.EntryPointAccessors
import com.hoyomusic.mobile.di.AppDependenciesEntryPoint
import com.hoyomusic.mobile.feature.player.PlayerViewModel
import com.hoyomusic.mobile.navigation.AppNavHost
import com.hoyomusic.mobile.ui.theme.HoYoMusicTheme

@Composable
fun HoYoMusicApp() {
    val context = LocalContext.current
    val dependencies = EntryPointAccessors.fromApplication(context.applicationContext, AppDependenciesEntryPoint::class.java)
    val bootstrapViewModel: AppBootstrapViewModel = hiltViewModel()
    val playerViewModel: PlayerViewModel = hiltViewModel()

    LaunchedEffect(Unit) {
        bootstrapViewModel.bootstrap()
    }

    HoYoMusicTheme {
        Surface(color = MaterialTheme.colorScheme.background) {
            AppNavHost(
                playerViewModel = playerViewModel,
                coverUrlResolver = dependencies.coverUrlResolver(),
                messageBus = dependencies.uiMessageBus(),
                networkStatusMonitor = dependencies.networkStatusMonitor()
            )
        }
    }
}

