package com.hoyomusic.mobile.core.common

import java.util.concurrent.atomic.AtomicLong
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

@Singleton
class UiMessageBus @Inject constructor() {
    private val counter = AtomicLong(0)
    private val _messages = MutableSharedFlow<UiMessage>(extraBufferCapacity = 16)
    val messages: SharedFlow<UiMessage> = _messages.asSharedFlow()

    fun push(text: String) {
        _messages.tryEmit(UiMessage(counter.incrementAndGet(), text))
    }
}

