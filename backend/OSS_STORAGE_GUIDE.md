# 阿里云 OSS 存储配置指南

## 概述

HoYoMusic 现已支持三种存储模式：

| 模式 | 值 | 适用场景 |
|------|-----|---------|
| 本地存储 | `local` | 开发调试 |
| 阿里云 OSS | `oss` | **生产推荐** — 高可用、CDN 加速 |
| WebDAV | `webdav` | 自建 WebDAV 服务器 |

---

## 快速开始

### 第一步：创建阿里云 OSS Bucket

1. 登录 [阿里云控制台](https://oss.console.aliyun.com/)
2. 创建 Bucket：
   - **地域**：选择离用户最近的地域（如 `华东1·杭州`）
   - **读写权限**：`公共读`（音频/封面需公开访问）
   - **存储类型**：标准存储
3. 记录 Bucket 名称和所在地域 Region ID（如 `oss-cn-hangzhou`）

### 第二步：创建 RAM 子账号（推荐）

> **安全建议**：永远不要使用主账号 AccessKey，请创建专用 RAM 子账号。

1. 打开 [RAM 访问控制](https://ram.console.aliyun.com/)
2. 创建用户 → 勾选 **OpenAPI 调用访问**
3. 复制生成的 AccessKey ID 和 AccessKey Secret（仅显示一次）
4. 为该用户添加权限：`AliyunOSSFullAccess` 或自定义策略（见下方）

#### 推荐的最小权限策略

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "oss:PutObject",
        "oss:GetObject",
        "oss:DeleteObject",
        "oss:HeadObject",
        "oss:ListObjects"
      ],
      "Resource": [
        "acs:oss:*:*:your-bucket-name",
        "acs:oss:*:*:your-bucket-name/*"
      ]
    }
  ]
}
```

将 `your-bucket-name` 替换为实际 Bucket 名称。

### 第三步：配置环境变量

编辑 `backend/.env`：

```ini
# 切换为 OSS 模式
STORAGE_MODE=oss

# OSS 地域（必填）
OSS_REGION=oss-cn-hangzhou

# RAM 子账号凭据（必填）
OSS_ACCESS_KEY_ID=LTAI5tXxxxxxxxxxxxxxxxxx
OSS_ACCESS_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Bucket 名称（必填）
OSS_BUCKET=hoyomusic-prod

# 是否使用 HTTPS（推荐 true）
OSS_SECURE=true

# OSS 内路径前缀
OSS_BASE_PATH=hoyomusic
```

### 第四步：重启后端服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build && npm start
```

启动成功后，控制台会显示：

```
[OSS] Client initialized. Region: oss-cn-hangzhou, Bucket: hoyomusic-prod
[OSS] Connection test successful
[OSS] Base path prefix: hoyomusic
☁️  Aliyun OSS storage configured and ready
```

---

## 高级配置

### 绑定自定义 CDN 域名（可选，强烈推荐）

使用 CDN 可大幅降低 FLAC 文件的传输延迟和 OSS 出流量费用。

1. 在 OSS Bucket → **传输管理** → **绑定自定义域名** 中添加你的域名
2. 或通过阿里云 CDN 创建加速域名，源站选择 OSS Bucket
3. 在 `.env` 中配置：

```ini
OSS_CDN_DOMAIN=cdn.yourdomain.com
```

配置后，所有文件 URL 将变为：`https://cdn.yourdomain.com/hoyomusic/tracks/...`

### 使用内网传输（ECS 同地域，降低费用）

如果后端服务器（ECS）与 OSS Bucket 在同一地域，使用内网传输可以免流量费：

```ini
OSS_ENDPOINT=oss-cn-hangzhou-internal.aliyuncs.com
```

> **注意**：内网 Endpoint 仅能在 ECS 内部访问，本地开发请勿配置此项。

---

## OSS 文件目录结构

```
<OSS_BUCKET>/
└── hoyomusic/              ← OSS_BASE_PATH
    ├── tracks/             ← FLAC 音频文件
    │   ├── <uuid>.flac
    │   └── ...
    ├── covers/             ← 专辑封面图片
    │   ├── <uuid>.jpg
    │   └── ...
    └── lyrics/             ← LRC 歌词文件
        ├── <uuid>.lrc
        └── ...
```

---

## 与静态导出（export-static）配合使用

OSS 模式与静态导出脚本完全兼容，且比本地模式更简单——**无需手动指定 CDN_BASE_URL**，所有 URL 已直接存储在数据库中。

### OSS 模式导出

```bash
# 方式一：直接使用 .env 中的 STORAGE_MODE=oss
npm run export-static

# 方式二：临时指定（不修改 .env）
STORAGE_MODE=oss npx ts-node scripts/export-static.ts
```

### 封面处理模式（COVER_MODE）

| 值 | 行为 |
|----|------|
| `inline`（默认）| 从 OSS 下载封面图片到 `frontend/public/data/covers/`，前端访问 `/data/covers/xxx.jpg` |
| `cdn` | 封面 URL 直接写入 JSON（OSS URL 或 CDN URL），前端直接请求 OSS/CDN |

```bash
# 推荐：inline 模式（封面随静态站部署，不依赖 OSS 跨域）
STORAGE_MODE=oss npm run export-static

# cdn 模式（封面仍从 OSS/CDN 加载，减少静态站体积）
STORAGE_MODE=oss COVER_MODE=cdn npm run export-static
```

### 本地存储模式导出（原有方式不变）

```bash
CDN_BASE_URL=https://cdn.example.com/tracks npm run export-static
```

### 导出内容说明

| 数据 | 处理方式 |
|------|---------|
| 音频 URL（`audio_url`）| OSS 模式：直接使用数据库中的 OSS URL；本地模式：拼接 CDN_BASE_URL |
| 封面图（`cover_path`）| inline：下载到本地 `/data/covers/`；cdn：直接写 OSS/CDN URL |
| 歌词（`lyrics`）| OSS 模式：通过 HTTPS 从 OSS 下载内嵌到 JSON；本地：读取本地文件 |
| Credits/Tags | 纯数据库数据，与存储模式无关 |

---

## Bucket 访问控制建议

| 内容 | 权限设置 |
|------|---------|
| `covers/` | 公共读 |
| `lyrics/` | 公共读 |
| `tracks/` (FLAC) | 公共读 或 私有+签名URL |

若 FLAC 文件需要保护（付费内容），可将 `tracks/` 设为私有，后端通过 `ossService.getSignedUrl()` 生成限时访问链接。

---

## 常见问题

### 上传报 `AccessDenied`

- 检查 AccessKey 是否正确
- 检查 RAM 用户是否有 `oss:PutObject` 权限
- 检查 Bucket 名称和 Region 是否匹配

### 文件上传成功但前端无法访问

- 确认 Bucket 读写权限设为 **公共读**
- 如使用 CDN，检查 CDN 域名 CNAME 解析是否生效
- 检查 `OSS_SECURE` 与实际访问协议是否一致

### 启动时 `OSS configuration is incomplete`

- 确认 `OSS_ACCESS_KEY_ID`、`OSS_ACCESS_KEY_SECRET`、`OSS_BUCKET` 三个变量均已填写
- 确认 `.env` 文件在 `backend/` 目录下

### 本地开发如何测试 OSS？

直接在本地 `.env` 中配置真实 OSS 信息即可，或使用阿里云提供的 [OSS 本地模拟工具](https://help.aliyun.com/document_detail/209852.html)。

---

## 存储费用参考（仅供参考，以官网为准）

| 项目 | 标准存储（华东1） |
|------|----------------|
| 存储费用 | ¥0.12 / GB / 月 |
| 外网流出 | ¥0.50 / GB |
| CDN 回源 | ¥0.15 / GB |
| CDN 下行 | ¥0.24 / GB 起 |

> 推荐开启 CDN 加速，可显著降低出流量费用并提升访问速度。


