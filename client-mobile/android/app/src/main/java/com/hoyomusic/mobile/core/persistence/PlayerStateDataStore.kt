package com.hoyomusic.mobile.core.persistence

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.edit
import com.hoyomusic.mobile.core.player.PlayerPersistentState
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.first

@Singleton
class PlayerStateDataStore @Inject constructor(
    private val dataStore: DataStore<Preferences>
) {
    private val playModeKey = stringPreferencesKey("player_play_mode")
    private val volumeKey = floatPreferencesKey("player_volume")
    private val currentTrackIdKey = stringPreferencesKey("player_current_track_id")
    private val progressKey = longPreferencesKey("player_progress")
    private val queueKey = stringPreferencesKey("player_queue_ids")

    suspend fun save(state: PlayerPersistentState) {
        dataStore.edit { prefs ->
            prefs[playModeKey] = state.playMode
            prefs[volumeKey] = state.volume
            prefs[currentTrackIdKey] = state.currentTrackId?.toString().orEmpty()
            prefs[progressKey] = state.progressMs
            prefs[queueKey] = state.queueTrackIds.joinToString(",")
        }
    }

    suspend fun load(): PlayerPersistentState {
        val prefs = dataStore.data.first()
        val queueIds = prefs[queueKey]?.split(',')?.mapNotNull { it.toIntOrNull() } ?: emptyList()
        return PlayerPersistentState(
            playMode = prefs[playModeKey] ?: "SEQUENCE",
            volume = prefs[volumeKey] ?: 1f,
            currentTrackId = prefs[currentTrackIdKey]?.toIntOrNull(),
            progressMs = prefs[progressKey] ?: 0L,
            queueTrackIds = queueIds
        )
    }
}

