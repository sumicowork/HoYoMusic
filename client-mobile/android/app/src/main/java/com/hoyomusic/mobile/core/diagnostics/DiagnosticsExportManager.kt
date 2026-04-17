package com.hoyomusic.mobile.core.diagnostics

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton
import com.squareup.moshi.Moshi

@Singleton
class DiagnosticsExportManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val snapshotBuilder: DiagnosticsSnapshotBuilder
) {
    fun export(): File {
        val file = File(context.filesDir, "diagnostics_snapshot.json")
        val json = Moshi.Builder().build().adapter(Map::class.java).toJson(snapshotBuilder.build())
        file.writeText(json)
        return file
    }
}

