package com.hoyomusic.mobile.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = Color(0xFF667EEA),
    onPrimary = Color(0xFFFFFFFF),
    secondary = Color(0xFF764BA2),
    background = Color(0xFFF5F5F5),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xE0000000),
    onBackground = Color(0xE0000000),
    surfaceVariant = Color(0xFFFAFAFA),
    outline = Color(0xFFD9D9D9),
    error = Color(0xFFBA1A1A)
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF667EEA),
    onPrimary = Color(0xFFFFFFFF),
    secondary = Color(0xFF764BA2),
    background = Color(0xFF141414),
    surface = Color(0xFF1F1F1F),
    onSurface = Color(0xD9FFFFFF),
    onBackground = Color(0xD9FFFFFF),
    surfaceVariant = Color(0xFF262626),
    outline = Color(0xFF434343),
    error = Color(0xFFFFB4AB)
)

@Composable
fun HoYoMusicTheme(
    darkTheme: Boolean = true,
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = Typography,
        content = content
    )
}

