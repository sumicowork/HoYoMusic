# HoYoMusic Android (Phase 0)

This module provides the Android native bootstrap app for HoYoMusic.

## Included in current implementation
- Kotlin + Jetpack Compose + Hilt project skeleton
- Retrofit + OkHttp network layer with API envelope parsing and error mapping
- `x-visitor-id` interceptor and auth token/session intercept flow
- Health endpoint: `GET /api/health`
- Public tracks endpoint: `GET /api/public/tracks`
- Public detail/random/top/music-sources endpoints
- Public playback reporting endpoint: `POST /api/public/tracks/:id/play`
- Multi-page navigation: Home / Track List / Track Detail / Player / Login / Settings
- Shared player state with Media3 ExoPlayer
- Play modes: sequence / loop / shuffle / single
- Queue management: add/remove/clear, previous/next behavior parity
- Playback foreground service with notification transport controls
- MediaSession + media button receiver integration
- Audio focus handling + becoming noisy auto-pause
- Playback failure circuit breaker and next-track fallback
- Playback stream preloading and diagnostics fields
- Cover URL resolver aligned with web path rules
- Home screen with health, latest, random, top sections
- Track list pagination + advanced search filters + sort controls
- Track detail screen with music sources and play action
- Mini player + full player screens
- Network online/offline monitor and global message bus scaffold
- OkHttp disk cache policy, offline cache interceptor, auth no-cache interceptor
- Retry policy with backoff for GET 408/429/503
- Debug settings toggles (network log/force offline/low data mode) + logout action
- Unit tests for mapper/queue/search params/failure tracker

## Configure Base URL (optional)
Add this line to `client-mobile/android/local.properties` to override API base URL for debug builds:

```
HOYOMUSIC_API_BASE_URL=https://music.hoyodb.com/api/
```

## Run
Open `client-mobile/android` in Android Studio, sync Gradle, and run the `app` configuration.

## Quick API smoke checks (PowerShell)

```powershell
Invoke-RestMethod -Uri "https://music.hoyodb.com/api/health" -Method Get
Invoke-RestMethod -Uri "https://music.hoyodb.com/api/public/tracks?page=1&limit=3" -Method Get
Invoke-RestMethod -Uri "https://music.hoyodb.com/api/public/tracks/random?count=2" -Method Get
Invoke-RestMethod -Uri "https://music.hoyodb.com/api/public/top-tracks?limit=2" -Method Get
Invoke-RestMethod -Uri "https://music.hoyodb.com/api/public/tracks/2990/music-sources" -Method Get
```

