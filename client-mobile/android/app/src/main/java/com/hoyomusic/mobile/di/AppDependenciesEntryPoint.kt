package com.hoyomusic.mobile.di

import com.hoyomusic.mobile.core.common.CoverUrlResolver
import com.hoyomusic.mobile.core.common.NetworkStatusMonitor
import com.hoyomusic.mobile.core.common.UiMessageBus
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface AppDependenciesEntryPoint {
    fun coverUrlResolver(): CoverUrlResolver
    fun uiMessageBus(): UiMessageBus
    fun networkStatusMonitor(): NetworkStatusMonitor
}

