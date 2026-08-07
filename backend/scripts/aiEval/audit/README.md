# 歌词/创作者审计脚本（跑完 AI 分析必跑）

- `audit_lyrics_vs_source.py`：318 首 has 的 lyrics_text ↔ 源 LRC 逐行比对
  - A 编造行 / B 时间戳偏差（±0.5s）/ C 漏行（标题行剥离=正常）
- `audit_credits_vs_source.py`：30692 条 track_credits ↔ 源 LRC credit 行比对
  - A 编造 name（匹配池=全文内容行）/ B role 异常（token 匹配，容忍斜杠/双语）/
    C 出品违规 / D 遗漏（kana/声部/对白标记行=非 credit）
- 数据源：`audit_has.json`（DB 拉取）+ `upload_manifest_clean.tsv`（映射）+ `D:/CreditDebug/QQ音乐下载`（源 LRC）
- 已知正确差异（勿当问题）：
  - 标题行剥离、出品/Music by/Co-produced by 不提取（铁律）
  - [kana:] 注音行、Women:/Men: 声部歌词、角色对白标记行（布洛尼亚：）→ 非 credit
  - 源 LRC 无冒号续行（录音棚多行延续）、无冒号"角色 名字"行（人声 王可鑫）→ AI 提取正确
