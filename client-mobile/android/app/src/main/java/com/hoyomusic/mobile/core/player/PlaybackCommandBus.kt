package com.hoyomusic.mobile.core.player

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

sealed interface PlaybackCommand {
    data object Play : PlaybackCommand
    data object Pause : PlaybackCommand
    data object Next : PlaybackCommand
    data object Prev : PlaybackCommand
    data object Stop : PlaybackCommand
}

@Singleton
class PlaybackCommandBus @Inject constructor() {
    private val _commands = MutableSharedFlow<PlaybackCommand>(extraBufferCapacity = 8)
    val commands: SharedFlow<PlaybackCommand> = _commands.asSharedFlow()

    fun emit(command: PlaybackCommand) {
        _commands.tryEmit(command)
    }
}

