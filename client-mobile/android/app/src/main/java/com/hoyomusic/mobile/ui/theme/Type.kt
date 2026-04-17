package com.hoyomusic.mobile.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

val Typography = Typography(
	headlineSmall = TextStyle(
		fontFamily = FontFamily.Serif,
		fontSize = 24.sp,
		fontWeight = FontWeight.Bold,
		lineHeight = 30.sp
	),
	titleLarge = TextStyle(
		fontFamily = FontFamily.Serif,
		fontSize = 20.sp,
		fontWeight = FontWeight.SemiBold,
		lineHeight = 26.sp
	),
	titleMedium = TextStyle(
		fontFamily = FontFamily.SansSerif,
		fontSize = 18.sp,
		fontWeight = FontWeight.SemiBold,
		lineHeight = 24.sp
	),
	titleSmall = TextStyle(
		fontFamily = FontFamily.SansSerif,
		fontSize = 16.sp,
		fontWeight = FontWeight.Medium,
		lineHeight = 22.sp
	),
	bodyMedium = TextStyle(
		fontFamily = FontFamily.SansSerif,
		fontSize = 14.sp,
		lineHeight = 20.sp
	),
	bodySmall = TextStyle(
		fontFamily = FontFamily.SansSerif,
		fontSize = 12.sp,
		lineHeight = 18.sp
	),
	labelSmall = TextStyle(
		fontFamily = FontFamily.SansSerif,
		fontSize = 11.sp,
		fontWeight = FontWeight.Medium,
		lineHeight = 14.sp
	)
)

