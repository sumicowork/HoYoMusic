package com.hoyomusic.mobile.core.player

enum class PlayMode {
    SEQUENCE,
    LOOP,
    SHUFFLE,
    SINGLE;

    fun next(): PlayMode {
        val values = entries
        val nextIndex = (ordinal + 1) % values.size
        return values[nextIndex]
    }
}

