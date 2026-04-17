package com.hoyomusic.mobile.feature.track

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp

@Composable
fun TrackSortControls(
    sortBy: String,
    sortDir: String,
    onSortByChange: (String) -> Unit,
    onSortDirChange: (String) -> Unit
) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(onClick = { onSortByChange("release_date") }) { Text(if (sortBy == "release_date") "按日期*" else "按日期") }
        Button(onClick = { onSortByChange("title") }) { Text(if (sortBy == "title") "按标题*" else "按标题") }
        Button(onClick = { onSortByChange("duration") }) { Text(if (sortBy == "duration") "按时长*" else "按时长") }
        Button(onClick = { onSortDirChange(if (sortDir == "DESC") "ASC" else "DESC") }) { Text(if (sortDir == "DESC") "降序" else "升序") }
    }
}

