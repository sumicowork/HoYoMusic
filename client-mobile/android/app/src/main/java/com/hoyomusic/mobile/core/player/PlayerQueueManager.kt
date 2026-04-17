package com.hoyomusic.mobile.core.player

import com.hoyomusic.mobile.core.model.Track
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlayerQueueManager @Inject constructor() {

    fun insertNext(playlist: List<Track>, currentTrackId: Int?, track: Track): List<Track> {
        if (playlist.any { it.id == track.id }) return playlist
        val currentIndex = playlist.indexOfFirst { it.id == currentTrackId }
        if (currentIndex == -1) return playlist + track
        val mutable = playlist.toMutableList()
        mutable.add(currentIndex + 1, track)
        return mutable
    }

    fun move(playlist: List<Track>, fromIndex: Int, toIndex: Int): List<Track> {
        if (fromIndex !in playlist.indices || toIndex !in playlist.indices) return playlist
        if (fromIndex == toIndex) return playlist
        val mutable = playlist.toMutableList()
        val item = mutable.removeAt(fromIndex)
        mutable.add(toIndex, item)
        return mutable
    }

    fun reorderByIds(playlist: List<Track>, trackIds: List<Int>): List<Track> {
        if (trackIds.isEmpty()) return playlist
        val map = playlist.associateBy { it.id }
        val ordered = trackIds.mapNotNull { map[it] }.toMutableList()
        val remaining = playlist.filterNot { trackIds.contains(it.id) }
        ordered.addAll(remaining)
        return ordered
    }

    fun nextIndex(playlist: List<Track>, currentIndex: Int, mode: PlayMode): Int? {
        if (playlist.isEmpty() || currentIndex !in playlist.indices) return null
        return when (mode) {
            PlayMode.SINGLE -> currentIndex
            PlayMode.SHUFFLE -> {
                if (playlist.size == 1) currentIndex
                else {
                    var randomIndex: Int
                    do {
                        randomIndex = (playlist.indices).random()
                    } while (randomIndex == currentIndex)
                    randomIndex
                }
            }
            PlayMode.LOOP -> (currentIndex + 1) % playlist.size
            PlayMode.SEQUENCE -> if (currentIndex < playlist.lastIndex) currentIndex + 1 else null
        }
    }

    fun previousIndex(playlist: List<Track>, currentIndex: Int, mode: PlayMode): Int? {
        if (playlist.isEmpty() || currentIndex !in playlist.indices) return null
        return when (mode) {
            PlayMode.SINGLE -> currentIndex
            PlayMode.SHUFFLE -> {
                if (playlist.size == 1) currentIndex
                else {
                    var randomIndex: Int
                    do {
                        randomIndex = (playlist.indices).random()
                    } while (randomIndex == currentIndex)
                    randomIndex
                }
            }
            PlayMode.LOOP -> if (currentIndex == 0) playlist.lastIndex else currentIndex - 1
            PlayMode.SEQUENCE -> if (currentIndex > 0) currentIndex - 1 else null
        }
    }
}

