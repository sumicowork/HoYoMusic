# 09 行为一致性矩阵（第一阶段）

| ID | Web 行为 | Desktop 对应 | 当前状态 | 本轮处理 |
|---|---|---|---|---|
| BP-001 | 从发现进入专辑详情 | `OpenAlbumDetailAsync` | IN_PROGRESS | 已接入来源记录 + 返回上一页 |
| BP-002 | 从专辑详情进入歌曲详情 | `OpenAlbumTrackDetailAsync` | IN_PROGRESS | 已记录来源为 `album-detail` |
| BP-003 | 从曲库进入歌曲详情 | `OpenTrackDetailAsync` | IN_PROGRESS | 已接入来源记录 |
| BP-004 | 从发现随机/热门进入歌曲详情 | `OpenDiscoverTrackDetailAsync` | IN_PROGRESS | 已接入来源记录 |
| BP-005 | 歌曲详情返回上一步上下文 | 新增 `BackFromDetailCommand` | IN_PROGRESS | 已实现上下文返回策略 |
| BP-006 | 专辑详情返回来源列表 | 新增 `BackFromDetailCommand` | IN_PROGRESS | 已替换原硬编码返回按钮 |
| BP-007 | 详情页在登出后不跳转到受限页 | `ApplyLoggedOutStateAsync` | IN_PROGRESS | 已增加 detail back section 清理 |

## 备注
- 本表只覆盖“详情打开/返回”链路，作为用户当前阻塞问题的优先闭环。
- 后续将扩展到 auth gate、queue、search、admin 子流程。
