package com.hoyomusic.mobile.core.persistence

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.hoyomusic.mobile.core.download.DownloadStatus
import com.hoyomusic.mobile.core.download.DownloadTask
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.first

@Singleton
class DownloadStateDataStore @Inject constructor(
    private val dataStore: DataStore<Preferences>
) {
    private val key = stringPreferencesKey("download_tasks")

    suspend fun save(tasks: List<DownloadTask>) {
        val serialized = tasks.joinToString("||") {
            listOf(
                it.trackId.toString(),
                it.title,
                it.url,
                it.status.name,
                it.progress.toString(),
                it.filePath.orEmpty(),
                it.errorMessage.orEmpty(),
                it.retryCount.toString()
            ).joinToString("::")
        }
        dataStore.edit { it[key] = serialized }
    }

    suspend fun load(): List<DownloadTask> {
        val raw = dataStore.data.first()[key].orEmpty()
        if (raw.isBlank()) return emptyList()
        return raw.split("||").mapNotNull { row ->
            val p = row.split("::")
            if (p.size < 8) return@mapNotNull null
            DownloadTask(
                trackId = p[0].toIntOrNull() ?: return@mapNotNull null,
                title = p[1],
                url = p[2],
                status = runCatching { DownloadStatus.valueOf(p[3]) }.getOrElse { DownloadStatus.QUEUED },
                progress = p[4].toIntOrNull() ?: 0,
                filePath = p[5].ifBlank { null },
                errorMessage = p[6].ifBlank { null },
                retryCount = p[7].toIntOrNull() ?: 0
            )
        }
    }
}

