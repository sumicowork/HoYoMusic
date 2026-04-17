package com.hoyomusic.mobile.ui.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

private val GlassShape = RoundedCornerShape(16.dp)
private val AuroraPrimary = Color(0xFF667EEA)
private val AuroraSecondary = Color(0xFF764BA2)
private val AuroraTertiary = Color(0xFFF093FB)
private val AuroraBlue = Color(0xFF4FACFE)

@Composable
fun GlassBackground(content: @Composable BoxScope.() -> Unit) {
    val bg = Brush.linearGradient(
        listOf(
            Color(0xFF0F0C29),
            Color(0xFF302B63),
            Color(0xFF24243E)
        )
    )
    val glowA = Brush.radialGradient(
        colors = listOf(AuroraPrimary.copy(alpha = 0.22f), Color.Transparent),
        radius = 900f,
        center = androidx.compose.ui.geometry.Offset(120f, -80f)
    )
    val glowB = Brush.radialGradient(
        colors = listOf(AuroraSecondary.copy(alpha = 0.20f), Color.Transparent),
        radius = 760f,
        center = androidx.compose.ui.geometry.Offset(980f, 1680f)
    )
    val glowC = Brush.radialGradient(
        colors = listOf(AuroraTertiary.copy(alpha = 0.10f), Color.Transparent),
        radius = 640f,
        center = androidx.compose.ui.geometry.Offset(580f, 820f)
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(bg)
            .background(glowA)
            .background(glowB)
            .background(glowC)
            .padding(12.dp),
        content = content
    )
}

@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(14.dp),
    content: @Composable () -> Unit
) {
    val cardBorder = Brush.linearGradient(
        listOf(
            Color.White.copy(alpha = 0.42f),
            AuroraBlue.copy(alpha = 0.35f),
            AuroraSecondary.copy(alpha = 0.32f)
        )
    )
    Card(
        modifier = modifier
            .clip(GlassShape)
            .border(1.dp, cardBorder, GlassShape),
        colors = CardDefaults.cardColors(
            containerColor = Color.White.copy(alpha = 0.10f)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
        shape = GlassShape,
        content = {
            Box(modifier = Modifier.padding(contentPadding)) {
                content()
            }
        }
    )
}

@Composable
fun GlassPrimaryButton(
    text: String,
    onClick: () -> Unit,
    enabled: Boolean = true,
    modifier: Modifier = Modifier
) {
    val gradient = Brush.linearGradient(listOf(AuroraPrimary, AuroraSecondary))
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(gradient),
        colors = ButtonDefaults.buttonColors(
            containerColor = Color.Transparent,
            contentColor = MaterialTheme.colorScheme.onPrimary
        ),
        shape = RoundedCornerShape(14.dp)
    ) {
        Text(text)
    }
}

@Composable
fun GlassGhostButton(
    text: String,
    onClick: () -> Unit,
    enabled: Boolean = true,
    modifier: Modifier = Modifier
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier,
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = Color.White.copy(alpha = 0.16f),
            contentColor = MaterialTheme.colorScheme.onSurface
        )
    ) {
        Text(text)
    }
}

@Composable
fun GlassSectionTitle(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        modifier = modifier.fillMaxWidth(),
        style = MaterialTheme.typography.titleLarge,
        fontWeight = FontWeight.Bold,
        color = Color(0xFFE6E9FF)
    )
}

@Composable
fun GlassStatChips(vararg values: String) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        values.forEach { value ->
            GlassCard(contentPadding = PaddingValues(horizontal = 10.dp, vertical = 5.dp)) {
                Text(value, style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}


