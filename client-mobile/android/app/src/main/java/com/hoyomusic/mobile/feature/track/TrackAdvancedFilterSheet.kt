package com.hoyomusic.mobile.feature.track

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun TrackAdvancedFilterSheet(
    state: TrackFilterUiState,
    onStateChange: (TrackFilterUiState) -> Unit,
    onApply: () -> Unit,
    onReset: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = state.artist,
            onValueChange = { onStateChange(state.copy(artist = it)) },
            label = { Text("艺人关键词") }
        )
        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = state.gameIdsRaw,
            onValueChange = { onStateChange(state.copy(gameIdsRaw = it)) },
            label = { Text("游戏ID(逗号分隔)") }
        )
        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = state.tagIdsRaw,
            onValueChange = { onStateChange(state.copy(tagIdsRaw = it)) },
            label = { Text("标签ID(逗号分隔)") }
        )
        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = state.yearFrom,
            onValueChange = { onStateChange(state.copy(yearFrom = it)) },
            label = { Text("年份从") }
        )
        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = state.yearTo,
            onValueChange = { onStateChange(state.copy(yearTo = it)) },
            label = { Text("年份到") }
        )
        Button(onClick = onApply) { Text("应用筛选") }
        Button(onClick = onReset) { Text("重置筛选") }
    }
}

