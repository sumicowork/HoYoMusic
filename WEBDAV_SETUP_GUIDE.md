# WebDAV远程存储配置指南

## 概述

HoYoMusic现已支持WebDAV远程存储，所有上传的音频文件、封面图片和歌词文件都将存储在WebDAV服务器上，而不是本地文件系统。

## 优势

✅ **解耦存储和应用** - 应用服务器无需存储大文件
✅ **易于扩展** - 可使用任何WebDAV兼容的存储服务
✅ **备份和迁移** - 文件独立管理，便于备份和迁移
✅ **多实例部署** - 多个应用实例可共享同一存储
✅ **CDN加速** - 可配合CDN加速文件访问

## WebDAV服务器选择

### 1. 自建WebDAV服务器

#### Apache + mod_dav
```bash
# Ubuntu/Debian
sudo apt install apache2
sudo a2enmod dav dav_fs
```

#### Nginx + nginx-dav-ext-module
```bash
# 需要编译时加入dav模块
./configure --with-http_dav_module
```

#### 专用WebDAV服务器（推荐）
- **SFTPGo** - 现代化的文件服务器，支持WebDAV、SFTP、S3
- **Caddy** - 内置WebDAV支持
- **Docker容器**: `bytemark/webdav`

### 2. 云存储服务

- **坚果云** - 提供WebDAV接口（国内推荐）
- **Box.com** - 企业级云存储
- **Nextcloud** - 开源私有云
- **Seafile** - 国产开源云存储

## 快速部署WebDAV服务器

### 方案1: 使用Docker（最简单）

```bash
# 1. 拉取WebDAV Docker镜像
docker pull bytemark/webdav

# 2. 启动WebDAV服务器
docker run -d \
  --name hoyomusic-webdav \
  -p 8080:80 \
  -v /path/to/storage:/var/lib/dav \
  -e AUTH_TYPE=Basic \
  -e USERNAME=admin \
  -e PASSWORD=admin \
  bytemark/webdav

# 3. 测试连接
curl -u admin:admin http://localhost:8080/webdav/
```

### 方案2: 使用Caddy

```bash
# 1. 安装Caddy
sudo apt install caddy

# 2. 配置Caddyfile
cat > /etc/caddy/Caddyfile << EOF
:8080 {
    route /webdav/* {
        webdav {
            root /var/www/webdav
        }
        basicauth {
            admin JDJhJDE0JHo4... # 使用 caddy hash-password 生成
        }
    }
}
EOF

# 3. 创建存储目录
sudo mkdir -p /var/www/webdav
sudo chown caddy:caddy /var/www/webdav

# 4. 启动服务
sudo systemctl start caddy
```

### 方案3: 使用SFTPGo（推荐用于生产环境）

```bash
# 1. 下载安装
wget https://github.com/drakkan/sftpgo/releases/download/v2.5.0/sftpgo_v2.5.0_linux_amd64.tar.xz
tar xf sftpgo_v2.5.0_linux_amd64.tar.xz
cd sftpgo_v2.5.0_linux_amd64

# 2. 启动服务
./sftpgo serve

# 3. 访问管理界面
# http://localhost:8080/web/admin

# 4. 创建用户并启用WebDAV
```

## 配置HoYoMusic后端

### 1. 更新.env配置

```bash
# 复制示例配置
cp .env.example .env

# 编辑配置文件
nano .env
```

### 2. 填写WebDAV配置

```env
# WebDAV服务器地址
WEBDAV_URL=http://localhost:8080/webdav

# WebDAV认证信息
WEBDAV_USERNAME=admin
WEBDAV_PASSWORD=admin

# WebDAV基础路径（会自动创建此目录）
WEBDAV_BASE_PATH=/hoyomusic

# WebDAV公开访问URL
# 注意：前端将使用此URL访问文件
WEBDAV_PUBLIC_URL=http://localhost:8080/webdav/hoyomusic
```

### 3. 目录结构

WebDAV服务器上会自动创建以下目录结构：

```
/hoyomusic/
├── covers/     # 专辑封面图片
├── tracks/     # 音频文件（FLAC）
└── lyrics/     # 歌词文件（LRC）
```

## 公开访问配置

### 选项1: WebDAV公开访问（不推荐）

如果WebDAV服务器支持匿名访问：

```bash
# Caddy配置示例
:8080 {
    route /webdav/hoyomusic/* {
        webdav {
            root /var/www/webdav
        }
        # 不需要认证
    }
}
```

### 选项2: 使用代理（推荐）

在后端API中添加代理路由，隐藏WebDAV认证信息：

```typescript
// 在trackController.ts的streamTrack函数中已实现
// 用户访问 /api/tracks/:id/stream
// 后端代理到 WebDAV服务器（带认证）
```

### 选项3: 使用CDN

1. 将WebDAV文件同步到CDN
2. 设置`WEBDAV_PUBLIC_URL`为CDN地址

```env
WEBDAV_PUBLIC_URL=https://cdn.example.com/hoyomusic
```

## 启动应用

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev

# 3. 查看启动日志
# 应该看到：
# 🔗 Testing WebDAV connection...
# WebDAV connection successful
# 📁 Initializing WebDAV directories...
# Created WebDAV directory: /hoyomusic
# ...
# ☁️  WebDAV storage configured and ready
```

## 测试WebDAV配置

### 测试连接

```bash
# 使用curl测试
curl -u admin:admin http://localhost:8080/webdav/

# 应该返回目录列表（XML格式）
```

### 测试上传

```bash
# 上传测试文件
echo "test" > test.txt
curl -u admin:admin -T test.txt http://localhost:8080/webdav/test.txt

# 验证文件
curl -u admin:admin http://localhost:8080/webdav/test.txt
```

### 测试HoYoMusic上传

1. 启动后端服务
2. 登录管理后台
3. 上传一首FLAC文件
4. 检查WebDAV服务器上是否有文件

```bash
# 列出上传的文件
curl -u admin:admin http://localhost:8080/webdav/hoyomusic/tracks/
```

## 迁移现有数据

如果已有本地uploads目录的数据，需要迁移：

### 1. 上传文件到WebDAV

```bash
# 使用cadaver（WebDAV客户端）
sudo apt install cadaver
cadaver http://localhost:8080/webdav/

# 或使用rclone
rclone copy uploads/ webdav:hoyomusic/
```

### 2. 更新数据库路径

```sql
-- 更新tracks表的file_path
UPDATE tracks 
SET file_path = REPLACE(file_path, '/tracks/', 'http://localhost:8080/webdav/hoyomusic/tracks/')
WHERE file_path LIKE '/tracks/%';

-- 更新cover_path
UPDATE tracks 
SET cover_path = REPLACE(cover_path, '/covers/', 'http://localhost:8080/webdav/hoyomusic/covers/')
WHERE cover_path LIKE '/covers/%';

UPDATE albums 
SET cover_path = REPLACE(cover_path, '/covers/', 'http://localhost:8080/webdav/hoyomusic/covers/')
WHERE cover_path LIKE '/covers/%';
```

## 性能优化

### 1. 启用缓存

```bash
# Nginx配置
location /webdav/ {
    proxy_cache my_cache;
    proxy_cache_valid 200 1h;
    proxy_cache_valid 404 1m;
}
```

### 2. 启用压缩

```bash
# 对于封面图片等，启用gzip
gzip on;
gzip_types image/jpeg image/png;
```

### 3. 使用CDN

配合Cloudflare、阿里云CDN等服务加速访问。

## 安全建议

1. ✅ 使用强密码
2. ✅ 启用HTTPS（生产环境必须）
3. ✅ 限制WebDAV访问IP（如果可能）
4. ✅ 定期备份WebDAV数据
5. ✅ 使用代理模式，不直接暴露WebDAV URL

## 故障排查

### 连接失败

```
❌ WebDAV connection failed
```

**检查项**:
- WebDAV服务器是否运行
- URL、用户名、密码是否正确
- 防火墙是否开放端口

### 上传失败

```
Error uploading file to WebDAV
```

**检查项**:
- WebDAV存储空间是否足够
- 是否有写入权限
- 文件大小是否超过限制

### 无法访问文件

**检查项**:
- `WEBDAV_PUBLIC_URL`是否正确
- 文件是否真实存在
- WebDAV是否支持公开访问

## 支持的WebDAV客户端

后端使用的是`webdav` npm包，兼容RFC 4918标准的WebDAV服务器。

测试通过的服务器：
- ✅ Apache mod_dav
- ✅ Nginx with dav module
- ✅ Caddy
- ✅ SFTPGo
- ✅ Nextcloud
- ✅ 坚果云

## 相关文档

- [WebDAV RFC 4918](https://tools.ietf.org/html/rfc4918)
- [webdav npm包文档](https://github.com/perry-mitchell/webdav-client)
- [Caddy WebDAV模块](https://caddyserver.com/docs/caddyfile/directives/webdav)

---

**文档版本**: 1.0
**更新日期**: 2026-02-15
**作者**: GitHub Copilot

