# 🎵 HoYoMusic - 5 分钟快速启动指南

> 最快速度让 HoYoMusic 运行起来！

---

## ⚡ 超快速启动（已有 PostgreSQL）

如果您已经安装了 PostgreSQL 并且它正在运行，执行以下命令：

```powershell
# 第 1 步：创建数据库（只需一次）
psql -U postgres -c "CREATE DATABASE hoyomusic;"

# 第 2 步：配置数据库密码
cd backend
notepad .env
# 修改这一行：DB_PASSWORD=你的PostgreSQL密码

# 第 3 步：初始化数据库（只需一次）
npm run setup

# 第 4 步：启动后端
npm run dev
```

**打开新终端：**

```powershell
# 第 5 步：启动前端
cd frontend
npm run dev
```

**第 6 步：** 打开浏览器访问 http://localhost:5173  
**登录：** admin / admin123

---

## 🐘 如果还没安装 PostgreSQL

### Windows 快速安装

1. **下载 PostgreSQL**
   - 访问: https://www.postgresql.org/download/windows/
   - 下载 PostgreSQL 14 或更高版本

2. **安装步骤**
   ```
   ✓ 点击安装程序
   ✓ 使用默认安装路径
   ✓ 端口选择 5432（默认）
   ✓ 设置 postgres 用户密码（请记住！）
   ✓ 安装完成后自动启动服务
   ```

3. **验证安装**
   ```powershell
   psql --version
   # 应该显示: psql (PostgreSQL) 14.x
   ```

4. **然后返回上面的"超快速启动"步骤**

---

## 🎯 完整启动流程（带解释）

### 1️⃣ 准备环境

**检查 Node.js：**
```powershell
node --version
# 应该显示 v18.x 或更高
```

**检查 PostgreSQL：**
```powershell
psql --version
# 应该显示 PostgreSQL 14.x 或更高
```

### 2️⃣ 创建数据库

```powershell
# 连接到 PostgreSQL
psql -U postgres

# 输入密码后，在 psql 提示符中：
CREATE DATABASE hoyomusic;

# 验证数据库已创建
\l

# 退出
\q
```

### 3️⃣ 配置后端

```powershell
cd C:\Users\sumi\WebstormProjects\HoYoMusic\backend

# 打开 .env 文件
notepad .env
```

**修改以下配置：**
```env
DB_PASSWORD=你在安装PostgreSQL时设置的密码
```

保存并关闭文件。

### 4️⃣ 初始化数据库

```powershell
# 确保在 backend 目录
npm run setup
```

**预期输出：**
```
🔧 Setting up HoYoMusic database...
✅ Database setup complete!
📝 Admin credentials:
   Username: admin
   Password: admin123
```

### 5️⃣ 启动后端服务器

```powershell
# 在 backend 目录
npm run dev
```

**预期输出：**
```
🎵 HoYoMusic Backend Server running on port 3000
🌐 API URL: http://localhost:3000
```

**保持这个终端运行！**

### 6️⃣ 启动前端（新终端）

打开一个**新的 PowerShell 窗口**：

```powershell
cd C:\Users\sumi\WebstormProjects\HoYoMusic\frontend

npm run dev
```

**预期输出：**
```
  VITE v6.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

**保持这个终端也运行！**

### 7️⃣ 开始使用

1. **打开浏览器** → http://localhost:5173

2. **登录：**
   - 用户名：`admin`
   - 密码：`admin123`

3. **上传音乐：**
   - 点击右上角 "Upload FLAC Files"
   - 选择您的 FLAC 音乐文件
   - 等待上传完成

4. **播放音乐：**
   - 在列表中找到歌曲
   - 点击 "Play" 按钮
   - 底部会出现播放器
   - 享受音乐！🎵

---

## 🆘 常见问题快速解决

### ❌ 错误：数据库连接失败

**问题表现：**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**解决方案：**
```powershell
# 检查 PostgreSQL 服务是否运行
Get-Service postgresql*

# 如果状态不是 Running，启动它：
Start-Service postgresql-x64-14
```

### ❌ 错误：密码认证失败

**问题表现：**
```
Error: password authentication failed
```

**解决方案：**
```powershell
# 检查 backend/.env 文件中的密码
notepad backend\.env

# 确保 DB_PASSWORD 与您的 PostgreSQL 密码一致
```

### ❌ 错误：端口被占用

**问题表现：**
```
Error: Port 3000 is already in use
```

**解决方案：**
```powershell
# 查找占用端口的进程
netstat -ano | findstr :3000

# 结束该进程（PID 是最后一列的数字）
taskkill /F /PID <进程ID>

# 或者修改端口
notepad backend\.env
# 改成: PORT=3001
```

### ❌ 错误：数据库不存在

**问题表现：**
```
Error: database "hoyomusic" does not exist
```

**解决方案：**
```powershell
# 重新创建数据库
psql -U postgres -c "CREATE DATABASE hoyomusic;"
```

### ❌ 前端连接不上后端

**解决方案：**
1. 确保后端正在运行（终端 1）
2. 访问 http://localhost:3000/api/health
3. 应该看到：`{"success":true,"message":"HoYoMusic API is running"}`
4. 如果看不到，重启后端

---

## 📱 浏览器兼容性

✅ **支持的浏览器：**
- Chrome 56+
- Firefox 51+
- Edge 79+
- Safari 14.1+

❌ **不支持：**
- Internet Explorer（任何版本）
- 旧版浏览器

---

## 🎓 下一步学习

恭喜！如果您已经成功启动，可以：

1. **阅读完整文档**
   - `SETUP_GUIDE.md` - 详细使用指南
   - `PROJECT_SUMMARY.md` - 项目架构说明
   - `PRD.md` - 完整功能规划

2. **尝试所有功能**
   - 上传多个音乐文件
   - 播放和切换歌曲
   - 调整音量和进度
   - 下载音乐

3. **开始开发新功能**
   - 查看 Phase 2 计划
   - 选择一个功能实现
   - 贡献您的代码

---

## 🎉 成功启动的标志

如果您看到以下内容，说明一切正常：

✅ **后端终端显示：**
```
🎵 HoYoMusic Backend Server running on port 3000
```

✅ **前端终端显示：**
```
➜  Local:   http://localhost:5173/
```

✅ **浏览器显示：**
- 精美的登录页面
- 能够成功登录
- 看到音乐库界面

---

## 💡 小贴士

- 💾 **数据持久化**：上传的音乐会保存在 `backend/uploads/` 目录
- 🔄 **重启服务**：Ctrl+C 停止，然后重新运行 `npm run dev`
- 🗑️ **清空数据**：参考 `SETUP_GUIDE.md` 的数据库清空命令
- 📝 **查看日志**：后端终端会显示所有 API 请求

---

## 🚀 开始您的音乐之旅！

现在您已经准备好了，开始享受 HoYoMusic 带来的高品质音乐体验吧！

**Happy Coding! 🎵**

---

*需要帮助？查看 `SETUP_GUIDE.md` 获取更多详细信息*

