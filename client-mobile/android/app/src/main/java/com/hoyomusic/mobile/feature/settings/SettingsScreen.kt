package com.hoyomusic.mobile.feature.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.hoyomusic.mobile.ui.theme.GlassBackground
import com.hoyomusic.mobile.ui.theme.GlassCard
import com.hoyomusic.mobile.ui.theme.GlassGhostButton
import com.hoyomusic.mobile.ui.theme.GlassPrimaryButton
import com.hoyomusic.mobile.ui.theme.GlassSectionTitle

@Composable
fun SettingsScreen(onOpenLogin: () -> Unit, viewModel: SettingsViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsState()

    GlassBackground {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(8.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
        GlassSectionTitle("设置")
        GlassCard(modifier = Modifier.fillMaxWidth()) {
            Text("API 基地址: ${state.apiBaseUrl}")
            Text("Visitor ID: ${state.visitorId}")
            Text("在线状态: ${if (state.online) "在线" else "离线"}")
            Text("Token: ${if (state.hasToken) "已登录" else "匿名"}")
            Text("会话状态: ${state.sessionStatus}")
        }

        GlassCard(modifier = Modifier.fillMaxWidth()) {
            Text("Debug: 网络日志")
            Switch(checked = state.networkLogEnabled, onCheckedChange = viewModel::setNetworkLogEnabled)
            Text("Debug: 强制离线")
            Switch(checked = state.forceOffline, onCheckedChange = viewModel::setForceOffline)
            Text("Debug: 低流量模式")
            Switch(checked = state.lowDataMode, onCheckedChange = viewModel::setLowDataMode)
        }

        GlassGhostButton(text = "清空调试设置", onClick = viewModel::clearDebugSettings)
        GlassGhostButton(text = "退出登录", onClick = viewModel::logout)
        GlassPrimaryButton(text = "登录", onClick = onOpenLogin)
        }
    }
}

