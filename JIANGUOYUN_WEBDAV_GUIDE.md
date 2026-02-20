# 使用坚果云作为WebDAV存储 - 配置指南

## 🥜 坚果云简介

坚果云是国内知名的云存储服务，支持WebDAV协议，非常适合作为HoYoMusic的远程存储方案。

### 优势
- ✅ 国内访问速度快
- ✅ 稳定可靠
- ✅ 支持WebDAV标准协议
- ✅ 有免费版本可用
- ✅ 配置简单

---

## 📝 配置步骤

### 步骤1: 注册坚果云账号

1. 访问 https://www.jianguoyun.com/
2. 注册账号（可以使用邮箱或手机号）
3. 登录到坚果云

### 步骤2: 获取WebDAV应用密码

⚠️ **重要**: 坚果云WebDAV使用的是**应用密码**，不是登录密码！

1. 登录坚果云网页版
2. 点击右上角头像 → **账户信息**
3. 在左侧菜单找到 **安全选项**
4. 找到 **第三方应用管理**
5. 点击 **添加应用密码**
6. 输入应用名称（如：HoYoMusic）
7. 点击生成
8. **复制并保存应用密码**（只显示一次！）

### 步骤3: 配置HoYoMusic后端

编辑 `backend/.env` 文件：

```env
# 坚果云WebDAV配置
WEBDAV_URL=https://dav.jianguoyun.com/dav
WEBDAV_USERNAME=your_email@example.com
WEBDAV_PASSWORD=your_app_password_here
WEBDAV_BASE_PATH=/hoyomusic
WEBDAV_PUBLIC_URL=https://dav.jianguoyun.com/dav/hoyomusic
```

**替换配置**:
- `your_email@example.com` → 你的坚果云账号（邮箱）
- `your_app_password_here` → 步骤2中生成的应用密码

### 步骤4: 测试连接

```powershell
# 启动后端
cd backend
npm run dev

# 应该看到:
# 🔗 Testing WebDAV connection...
# WebDAV connection successful
# 📁 Initializing WebDAV directories...
```

---

## 🧪 验证配置

### 方法1: 使用curl测试

```powershell
# 测试连接
curl -u "your_email@example.com:your_app_password" https://dav.jianguoyun.com/dav/

# 应该返回目录列表（XML格式）
```

### 方法2: 在坚果云客户端查看

1. 打开坚果云客户端或网页版
2. 应该能看到 `/hoyomusic` 文件夹
3. 下面有三个子文件夹：
   - `/hoyomusic/covers` - 封面图片
   - `/hoyomusic/tracks` - 音频文件
   - `/hoyomusic/lyrics` - 歌词文件

### 方法3: 上传测试文件

1. 登录管理后台
2. 上传一首FLAC文件
3. 在坚果云中查看 `/hoyomusic/tracks/` 目录
4. 应该能看到上传的音频文件

---

## 📊 存储配额

### 免费版
- **空间**: 1GB
- **月上传流量**: 1GB
- **月下载流量**: 3GB

**建议**: 
- 适合小型项目或测试使用
- 约可存储 10-20 首高质量FLAC音乐

### 专业版
- **空间**: 42GB 起
- **月上传流量**: 42GB
- **月下载流量**: 142GB

**建议**: 
- 适合生产环境
- 可存储 400+ 首高质量FLAC音乐

### 升级方案
如果空间不足，可以：
1. 升级到专业版
2. 使用多个坚果云账号
3. 配合其他存储服务使用

---

## ⚙️ 高级配置

### 配置同步客户端

如果想在本地也能访问文件：

1. 下载坚果云客户端
2. 安装并登录
3. 选择性同步 `/hoyomusic` 文件夹
4. 文件会自动同步到本地

**注意**: 同步会占用本地存储空间

### 配置备份

使用rclone定期备份：

```powershell
# 1. 安装rclone
# 下载: https://rclone.org/downloads/

# 2. 配置坚果云远程
rclone config
# 选择: WebDAV
# URL: https://dav.jianguoyun.com/dav
# Vendor: 选择 Other
# User: 你的邮箱
# Pass: 应用密码

# 3. 测试连接
rclone ls jianguoyun:hoyomusic

# 4. 备份到本地
rclone sync jianguoyun:hoyomusic C:\Backups\HoYoMusic

# 5. 或备份到另一个云存储
rclone sync jianguoyun:hoyomusic onedrive:HoYoMusic_Backup
```

---

## 🔧 常见问题

### 问题1: 认证失败

```
401 Unauthorized
```

**原因**: 使用了登录密码而非应用密码

**解决**: 
1. 重新生成应用密码
2. 确保使用应用密码而非登录密码
3. 检查用户名是否正确（应该是邮箱）

### 问题2: 无法访问文件

```
403 Forbidden
```

**可能原因**:
1. 应用密码已过期或被删除
2. 账号权限不足
3. 超出流量配额

**解决**:
1. 重新生成应用密码
2. 检查账号状态
3. 升级套餐或等待下月

### 问题3: 上传失败

```
507 Insufficient Storage
```

**原因**: 存储空间不足

**解决**:
1. 删除不需要的文件
2. 升级到更大容量套餐
3. 使用另一个存储服务

### 问题4: 速度慢

**优化建议**:
1. 坚果云国内服务器，应该速度较快
2. 检查网络连接
3. 避免高峰期上传大文件
4. 考虑使用CDN加速

### 问题5: CORS跨域问题

如果前端无法直接访问文件，在 `trackController.ts` 中启用代理模式：

```typescript
// 方案2: 代理模式（推荐）
const axios = require('axios');
const response = await axios.get(filePath, {
  responseType: 'stream',
  auth: {
    username: process.env.WEBDAV_USERNAME,
    password: process.env.WEBDAV_PASSWORD
  }
});
res.set(response.headers);
response.data.pipe(res);
```

---

## 🔒 安全建议

1. ✅ **使用应用密码**: 永远不要直接使用登录密码
2. ✅ **定期更换密码**: 每3-6个月更换一次应用密码
3. ✅ **限制权限**: 为不同应用创建不同的应用密码
4. ✅ **启用二步验证**: 在坚果云账户设置中启用
5. ✅ **定期备份**: 使用rclone或其他工具定期备份数据
6. ✅ **监控使用**: 定期检查流量和存储使用情况

---

## 📱 移动端访问

坚果云支持移动端：

### iOS/Android
1. 下载坚果云App
2. 登录账户
3. 浏览 `/hoyomusic` 文件夹
4. 可以预览音乐和图片

---

## 💡 最佳实践

### 1. 合理组织文件

HoYoMusic会自动创建以下结构：
```
/hoyomusic/
  ├── covers/    # 专辑封面
  ├── tracks/    # 音频文件
  └── lyrics/    # 歌词文件
```

**建议**: 不要手动修改这些文件，让应用自动管理

### 2. 监控配额

定期检查：
- 已用空间
- 月流量使用情况
- 避免超出限制

### 3. 定期清理

删除不需要的：
- 旧版本文件
- 测试文件
- 重复文件

### 4. 备份策略

推荐使用 **3-2-1 备份策略**：
- **3** 份副本
- **2** 种不同介质（坚果云 + 本地硬盘）
- **1** 份异地备份（OneDrive/Google Drive）

---

## 🎯 性能优化

### 1. 使用CDN

如果坚果云访问速度慢，可以配合CDN使用：
1. 将常访问的文件同步到CDN
2. 修改 `WEBDAV_PUBLIC_URL` 指向CDN

### 2. 缓存策略

在后端添加缓存：
```typescript
// 缓存常用文件
const cache = new Map();
if (cache.has(fileUrl)) {
  return cache.get(fileUrl);
}
```

### 3. 压缩图片

封面图片在上传前压缩：
- 使用WebP格式
- 限制分辨率（如800x800）
- 减少文件大小

---

## 📞 获取帮助

### 坚果云支持
- 官方文档: https://help.jianguoyun.com/
- 客服邮箱: support@jianguoyun.com
- WebDAV帮助: https://help.jianguoyun.com/?p=2064

### HoYoMusic支持
- 查看 `WEBDAV_SETUP_GUIDE.md` 完整文档
- 查看 `WEBDAV_QUICK_START.md` 快速开始
- GitHub Issues

---

## ✅ 检查清单

配置完成后，确认以下项目：

- [ ] 已注册坚果云账号
- [ ] 已生成并保存应用密码
- [ ] 已配置 `.env` 文件
- [ ] 后端成功连接到坚果云
- [ ] 可以看到自动创建的目录
- [ ] 成功上传测试文件
- [ ] 可以在坚果云中看到文件
- [ ] 前端可以播放音乐
- [ ] 已设置备份计划

---

**使用坚果云作为WebDAV存储，让HoYoMusic稳定可靠地运行！** 🥜🎵

