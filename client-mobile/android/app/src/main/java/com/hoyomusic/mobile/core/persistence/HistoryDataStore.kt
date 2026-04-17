package com.hoyomusic.mobile.core.persistence

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.hoyomusic.mobile.core.player.PlaybackHistoryItem
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.first

@Singleton
class HistoryDataStore @Inject constructor(
    private val dataStore: DataStore<Preferences>
) {
    private val key = stringPreferencesKey("playback_history")

    suspend fun append(item: PlaybackHistoryItem) {
        val current = load().toMutableList()
        current.add(0, item)
        val trimmed = current.take(100)
        val payload = trimmed.joinToString("||") { "${it.trackId}::${it.title}::${it.artist}::${it.playedAt}" }
        dataStore.edit { it[key] = payload }
    }

    suspend fun load(): List<PlaybackHistoryItem> {
        val raw = dataStore.data.first()[key].orEmpty()
        if (raw.isBlank()) return emptyList()
        return raw.split("||").mapNotNull { row ->
            val parts = row.split("::")
            if (parts.size != 4) return@mapNotNull null
            PlaybackHistoryItem(
                trackId = parts[0].toIntOrNull() ?: return@mapNotNull null,
                title = parts[1],
                artist = parts[2],
                playedAt = parts[3].toLongOrNull() ?: 0L
            )
        }
    }
}

