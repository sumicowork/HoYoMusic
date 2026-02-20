# WebDAV存储快速开始指南

## 🚀 快速配置（使用远程WebDAV服务器）

### 步骤1: 准备WebDAV服务器

**HoYoMusic使用远程WebDAV服务器存储文件**，你需要：

#### 选项A: 使用现有WebDAV服务 ✅ 推荐
- **坚果云** (https://www.jianguoyun.com/) - 国内推荐，有WebDAV接口
- **Nextcloud** - 自建私有云
- **阿里云OSS** - 支持WebDAV协议
- **自己的WebDAV服务器** - 任何支持WebDAV的服务器

#### 选项B: 本地测试用Docker（仅开发测试）
```powershell
# 仅用于本地开发测试
docker run -d `
  --name webdav-test `
  -p 8080:80 `
  -v C:\webdav-data:/var/lib/dav `
  -e USERNAME=admin `
  -e PASSWORD=admin123 `
  bytemark/webdav
```

### 步骤2: 配置后端连接到远程WebDAV

### 步骤2: 配置后端连接到远程WebDAV

```powershell
# 1. 进入后端目录
cd C:\Users\sumi\WebstormProjects\HoYoMusic\backend

# 2. 编辑.env文件
notepad .env
```

#### 配置示例1: 使用远程服务器（生产环境）
```.env
# WebDAV远程服务器配置
WEBDAV_URL=https://your-webdav-server.com/dav
WEBDAV_USERNAME=your_username
WEBDAV_PASSWORD=your_password
WEBDAV_BASE_PATH=/hoyomusic
WEBDAV_PUBLIC_URL=https://your-webdav-server.com/dav/hoyomusic
```

#### 配置示例2: 使用坚果云（推荐国内用户）
```.env
# 坚果云WebDAV配置
# 服务器地址: https://dav.jianguoyun.com/dav/
WEBDAV_URL=https://dav.jianguoyun.com/dav
WEBDAV_USERNAME=your_email@example.com
WEBDAV_PASSWORD=your_app_password
WEBDAV_BASE_PATH=/hoyomusic
WEBDAV_PUBLIC_URL=https://dav.jianguoyun.com/dav/hoyomusic
```

#### 配置示例3: 使用Nextcloud
```.env
# Nextcloud WebDAV配置
WEBDAV_URL=https://your-nextcloud.com/remote.php/dav/files/username
WEBDAV_USERNAME=your_username
WEBDAV_PASSWORD=your_password
WEBDAV_BASE_PATH=/hoyomusic
WEBDAV_PUBLIC_URL=https://your-nextcloud.com/remote.php/dav/files/username/hoyomusic
```

#### 配置示例4: 本地测试（仅开发）
```.env
# 本地Docker测试
WEBDAV_URL=http://localhost:8080/webdav
WEBDAV_USERNAME=admin
WEBDAV_PASSWORD=admin123
WEBDAV_BASE_PATH=/hoyomusic
WEBDAV_PUBLIC_URL=http://localhost:8080/webdav/hoyomusic
```

**重要说明**：
- ⚠️ 生产环境必须使用HTTPS
- 🔐 使用强密码保护WebDAV账户
- 🌐 确保WEBDAV_PUBLIC_URL可以被前端访问

### 步骤3: 安装依赖并启动

```powershell
# 1. 安装新依赖
npm install

# 2. 启动开发服务器
npm run dev
```

### 步骤4: 验证

查看控制台输出应包含：

```
🔗 Testing WebDAV connection...
WebDAV connection successful
📁 Initializing WebDAV directories...
Created WebDAV directory: /hoyomusic
Created WebDAV directory: /hoyomusic/covers
Created WebDAV directory: /hoyomusic/tracks
Created WebDAV directory: /hoyomusic/lyrics
WebDAV directories initialized successfully
🎵 HoYoMusic Backend Server running on port 3000
☁️  WebDAV storage configured and ready
```

## ✅ 测试上传

1. 打开管理后台: http://localhost:5173/admin
2. 登录
3. 上传一首FLAC文件
4. 验证文件已上传到WebDAV

### 验证文件上传成功

#### 方法1: 使用WebDAV客户端
- **Windows**: 打开"此电脑"，添加网络位置
- **Mac**: 在Finder中连接到服务器
- **Linux**: 使用`cadaver`或文件管理器

#### 方法2: 使用curl命令
```powershell
# 查看远程WebDAV服务器上的文件
curl -u username:password https://your-webdav-server.com/dav/hoyomusic/tracks/

# 如果使用坚果云
curl -u your_email@example.com:app_password https://dav.jianguoyun.com/dav/hoyomusic/tracks/
```

#### 方法3: 查看服务器日志
查看后端控制台日志，应该显示上传成功的消息。

## 🔧 常见问题

### 问题1: WebDAV连接失败

```
❌ WebDAV connection failed
```

**排查步骤**:
1. 检查WebDAV服务器地址是否正确
2. 验证用户名和密码
3. 确认服务器是否在线
4. 检查网络连接和防火墙设置
5. 验证HTTPS证书是否有效

```powershell
# 测试WebDAV连接
curl -u username:password https://your-webdav-server.com/dav/

# 应该返回目录列表或200状态码
```

### 问题2: 上传成功但无法播放

**原因**: WEBDAV_PUBLIC_URL配置不正确或无法公开访问

**解决方案**:
1. 检查`WEBDAV_PUBLIC_URL`是否可以从前端访问
2. 确认WebDAV服务器允许跨域访问(CORS)
3. 如果WebDAV需要认证，考虑使用代理模式

在`trackController.ts`中启用代理模式（已注释）：
```typescript
// 方案2: 代理模式
const axios = require('axios');
const response = await axios.get(filePath, {
  responseType: 'stream',
  auth: {
    username: webdavConfig.username,
    password: webdavConfig.password
  }
});
res.set(response.headers);
response.data.pipe(res);
```

### 问题3: 认证失败

**检查**:
- 坚果云需要使用**应用密码**，不是登录密码
- Nextcloud需要正确的用户名和密码
- 某些服务器可能需要特殊的认证方式

### 问题4: 存储空间不足

**解决**:
- 检查WebDAV服务器的存储配额
- 清理不需要的文件
- 升级存储计划

### 问题5: 上传速度慢

**优化建议**:
- 使用更快的网络连接
- 选择地理位置更近的服务器
- 增加`MAX_FILE_SIZE`限制可能影响超时

## 📁 数据位置

文件存储在**远程WebDAV服务器**上：

- **坚果云**: 在你的坚果云账户中的`/hoyomusic`目录
- **Nextcloud**: 在你的Nextcloud个人文件夹中
- **自建服务器**: 取决于你的WebDAV服务器配置

**查看文件**:
- 使用WebDAV客户端连接到服务器
- 使用Web界面（如坚果云、Nextcloud有Web界面）
- 使用文件管理器的网络位置功能

## 🔄 数据备份

### 重要！定期备份WebDAV数据

```powershell
# 使用rclone备份（推荐）
# 1. 安装rclone: https://rclone.org/
# 2. 配置WebDAV远程
rclone config

# 3. 备份到本地
rclone sync webdav:hoyomusic C:\Backups\HoYoMusic

# 4. 或备份到另一个云存储
rclone sync webdav:hoyomusic onedrive:HoYoMusic_Backup
```

## 🛑 数据清理

### 清理数据库中的记录但保留WebDAV文件

如果只想清空数据库但保留WebDAV上的文件：

```sql
-- 只清理数据库
DELETE FROM tracks;
DELETE FROM albums;
-- WebDAV文件保持不变
```

### 完全清理（删除数据库和WebDAV文件）

⚠️ **危险操作！数据无法恢复！**

1. 清空数据库
2. 手动删除WebDAV服务器上的文件
3. 或者重新初始化目录：
```powershell
# 连接到WebDAV并删除hoyomusic目录
# 重启应用时会自动重新创建
```

## 🎯 下一步

- [ ] 配置HTTPS（生产环境）
- [ ] 设置备份计划
- [ ] 配置CDN加速
- [ ] 参考完整文档: `WEBDAV_SETUP_GUIDE.md`

---

**就这么简单！现在你的HoYoMusic已经使用WebDAV远程存储了！** 🎉






