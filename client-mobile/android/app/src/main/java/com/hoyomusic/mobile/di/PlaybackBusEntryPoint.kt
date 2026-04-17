package com.hoyomusic.mobile.di

import com.hoyomusic.mobile.core.player.PlaybackCommandBus
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface PlaybackBusEntryPoint {
    fun bus(): PlaybackCommandBus
}

