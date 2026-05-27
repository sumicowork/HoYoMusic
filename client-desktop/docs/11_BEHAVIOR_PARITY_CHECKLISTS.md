# 11 行为一致性检查清单

## A. 专辑详情
- [ ] 在发现页点击任意专辑卡片，进入 `album-detail`。
- [ ] 点击“返回上一页”，回到进入前 section（discover/albums/games）。
- [ ] 专辑无曲目时显示状态提示，不崩溃。

## B. 歌曲详情
- [ ] 在发现随机/热门曲目点击详情，进入 `track-detail`。
- [ ] 在曲库点击详情，进入 `track-detail`。
- [ ] 在收藏/歌单点击详情，进入 `track-detail`。
- [ ] 在专辑详情点击曲目详情，进入 `track-detail` 后返回应回 `album-detail`。

## C. 回退语义
- [ ] `track-detail` 点击“返回上一页”，回到来源 section。
- [ ] `album-detail` 点击“返回上一页”，回到来源 section。
- [ ] 登出后从详情返回，不应落到无权限 section。

## D. 构建与回归
- [ ] `dotnet build HoYoMusic.Desktop.sln -v minimal`
- [ ] `dotnet test HoYoMusic.Desktop.sln -v minimal`
- [ ] `powershell -ExecutionPolicy Bypass -File .\scripts\startup-smoke.ps1`


