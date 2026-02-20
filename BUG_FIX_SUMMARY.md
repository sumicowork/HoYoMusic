# Bug Fix Summary: 播放队列问题修复

## 问题描述

1. 点击单曲的"播放"按钮时会将整个专辑/页面的所有曲目加入播放队列，而不是只加入该单曲
2. 加入播放队列时会覆盖原有队列，而不是追加到队列末尾

## 解决方案

### 1. 新增 `playTrackOnly` 函数 (playerStore.ts)

在 `playerStore.ts` 中新增了 `playTrackOnly` 函数，该函数：
- 检查曲目是否已在队列中
- 如果不在队列中，将曲目追加到队列末尾（而不是替换整个队列）
- 立即播放该曲目

```typescript
playTrackOnly: (track) => {
  const state = get();
  // Check if track is already in playlist
  const exists = state.playlist.some((t) => t.id === track.id);
  if (!exists) {
    // Add to end of playlist
    set({ playlist: [...state.playlist, track] });
  }
  // Play the track
  if (state.howl) {
    state.howl.unload();
  }
  set({ currentTrack: track, isPlaying: true });
},
```

### 2. 更新所有单曲播放功能

修改了以下文件中的 `handlePlay` 函数，使用 `playTrackOnly` 替代原来的 `setPlaylist + play`：

#### 修改的文件列表：

1. **AlbumDetail.tsx** - 专辑详情页
   - 单曲播放按钮：使用 `playTrackOnly(track)`
   - "播放全部"按钮：保持使用 `setPlaylist(tracks) + play(tracks[0])`

2. **PublicLibrary.tsx** - 公开音乐库页面
   - 单曲播放按钮：使用 `playTrackOnly(track)`

3. **Library.tsx** - 用户音乐库页面
   - 单曲播放按钮：使用 `playTrackOnly(track)`

4. **Admin.tsx** - 管理员页面
   - 单曲播放按钮：使用 `playTrackOnly(track)`

5. **PlaylistDetail.tsx** - 播放列表详情页
   - 单曲播放按钮：使用 `playTrackOnly(track)`
   - "播放全部"按钮：保持使用 `setPlayerPlaylist(tracks) + play(tracks[0])`

6. **TagDetail.tsx** - 标签详情页
   - 单曲播放按钮：使用 `playTrackOnly(track)`
   - "播放全部"按钮：保持使用 `setPlaylist(tracks) + play(tracks[0])`

7. **ArtistDetail.tsx** - 艺术家详情页
   - 单曲播放按钮：使用 `playTrackOnly(track)`
   - "播放全部"按钮：保持使用 `setPlaylist(tracks) + play(tracks[0])`

8. **TrackDetail.tsx** - 单曲详情页
   - 播放按钮：使用 `playTrackOnly(track)`

## 行为变化

### 修复前：
- 点击任意曲目的播放按钮 → 替换整个队列为当前页面/专辑的所有曲目 → 播放点击的曲目

### 修复后：
- 点击曲目的"播放"按钮 → 仅将该曲目追加到队列末尾 → 播放该曲目
- 点击"播放全部"按钮 → 替换整个队列为所有曲目 → 从第一首开始播放

## 测试建议

1. 测试单曲播放：
   - 在专辑页面点击单个曲目的"播放"按钮
   - 检查播放队列是否只添加了该曲目
   - 检查之前队列中的曲目是否仍然存在

2. 测试播放全部：
   - 点击专辑的"播放全部"按钮
   - 检查播放队列是否被替换为该专辑的所有曲目

3. 测试队列追加：
   - 播放一首歌
   - 从不同专辑点击另一首歌的"播放"按钮
   - 检查播放队列中是否包含两首歌

## 兼容性

- 所有现有的"播放全部"功能保持不变
- 播放队列管理功能（清空、删除等）不受影响
- 播放模式（顺序、循环、随机等）不受影响

