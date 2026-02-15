# 🚀 HoYoMusic MVP - 部署检查清单

## ✅ 开发完成清单

### 后端开发 (Backend)
- [x] Express + TypeScript 项目初始化
- [x] PostgreSQL 数据库架构设计 (schema.sql)
- [x] 数据库连接池配置
- [x] JWT + Passport 身份认证
- [x] 用户登录 API
- [x] FLAC 文件上传 (Multer)
- [x] 音频元数据提取 (music-metadata)
- [x] 封面图片自动提取
- [x] 音乐列表查询 API (分页)
- [x] 音乐详情查询 API
- [x] 流式播放 API (HTTP Range)
- [x] 音乐下载 API
- [x] 错误处理中间件
- [x] 数据库初始化脚本
- [x] 环境变量配置

### 前端开发 (Frontend)
- [x] React + TypeScript + Vite 项目初始化
- [x] Ant Design UI 集成
- [x] Zustand 状态管理
- [x] Axios API 客户端
- [x] 登录页面
- [x] 音乐库列表页面
- [x] 受保护路由组件
- [x] Howler.js 音频播放器
- [x] 持久化底部播放器
- [x] 播放控制 (播放/暂停/上一曲/下一曲)
- [x] 进度条与拖动
- [x] 音量控制
- [x] 文件上传功能
- [x] 封面显示
- [x] 音质信息展示

### 文档与配置
- [x] PRD.md (产品需求文档)
- [x] README.md (项目说明)
- [x] SETUP_GUIDE.md (详细设置指南)
- [x] PROJECT_SUMMARY.md (项目总结)
- [x] .gitignore (版本控制配置)
- [x] 环境变量示例文件
- [x] TypeScript 配置
- [x] 环境检查脚本

---

## 📋 启动前检查清单

### 环境准备
- [ ] Node.js 18+ 已安装
- [ ] PostgreSQL 14+ 已安装并运行
- [ ] Git 已安装 (可选)

### 数据库设置
- [ ] PostgreSQL 服务已启动
- [ ] 数据库 `hoyomusic` 已创建
- [ ] 后端 `.env` 文件已配置
- [ ] 数据库密码已正确设置
- [ ] 数据库初始化脚本已运行 (`npm run setup`)

### 后端配置
- [ ] backend/node_modules 已安装
- [ ] backend/.env 文件存在
- [ ] JWT_SECRET 已设置
- [ ] uploads 目录已创建
- [ ] 端口 3000 未被占用

### 前端配置
- [ ] frontend/node_modules 已安装
- [ ] frontend/.env 文件存在 (可选)
- [ ] API_URL 配置正确
- [ ] 端口 5173 未被占用

---

## 🔧 首次启动步骤

### 1. 创建数据库
```powershell
psql -U postgres -c "CREATE DATABASE hoyomusic;"
```

### 2. 配置后端
```powershell
cd backend
# 编辑 .env 文件，设置 DB_PASSWORD
code .env  # 或使用其他编辑器
```

### 3. 安装依赖（已完成）
```powershell
# Backend
cd backend
npm install  # ✅ 已完成

# Frontend
cd ../frontend
npm install  # ✅ 已完成
```

### 4. 初始化数据库
```powershell
cd backend
npm run setup
```

**预期输出：**
```
🔧 Setting up HoYoMusic database...
✅ Database setup complete!
📝 Admin credentials:
   Username: admin
   Password: admin123
⚠️  Please change the password in production!
```

### 5. 启动服务

**终端 1 - 后端:**
```powershell
cd backend
npm run dev
```

**预期输出：**
```
🎵 HoYoMusic Backend Server running on port 3000
🌐 API URL: http://localhost:3000
```

**终端 2 - 前端:**
```powershell
cd frontend
npm run dev
```

**预期输出：**
```
VITE v6.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### 6. 验证部署

- [ ] 访问 http://localhost:3000/api/health 返回成功
- [ ] 访问 http://localhost:5173 显示登录页面
- [ ] 使用 admin/admin123 能成功登录
- [ ] 能看到音乐库页面（即使是空的）

---

## 🧪 功能测试清单

### 认证测试
- [ ] 登录成功 (admin/admin123)
- [ ] 错误密码显示错误提示
- [ ] 登出功能正常
- [ ] 未登录时自动跳转到登录页

### 上传测试
- [ ] 能选择 FLAC 文件
- [ ] 单个文件上传成功
- [ ] 批量文件上传成功（2-5个文件）
- [ ] 上传后列表自动刷新
- [ ] 封面正确显示
- [ ] 元数据正确提取（标题、艺术家、专辑）

### 播放测试
- [ ] 点击 Play 按钮后播放器出现
- [ ] 音乐能正常播放
- [ ] 播放/暂停按钮工作正常
- [ ] 进度条实时更新
- [ ] 拖动进度条能跳转
- [ ] 音量控制正常
- [ ] 上一曲/下一曲按钮工作

### 下载测试
- [ ] 点击下载按钮能下载文件
- [ ] 下载的文件是正确的 FLAC 格式
- [ ] 文件名正确

### UI 测试
- [ ] 列表分页正常
- [ ] 封面图片正常显示
- [ ] 音质信息显示正确
- [ ] 响应式布局正常
- [ ] 没有明显的 UI 错误

---

## 🐛 常见问题快速修复

### 问题：数据库连接失败
```powershell
# 检查 PostgreSQL 服务
Get-Service postgresql*

# 如果未运行，启动服务
Start-Service postgresql-x64-14  # 根据实际版本调整
```

### 问题：端口被占用
```powershell
# 查看占用端口的进程
netstat -ano | findstr :3000
netstat -ano | findstr :5173

# 终止进程（PID 是上面命令显示的最后一列）
taskkill /F /PID <进程ID>
```

### 问题：npm 依赖问题
```powershell
# 清理并重装
cd backend  # 或 frontend
rm -r node_modules
rm package-lock.json
npm install
```

### 问题：TypeScript 编译错误
```powershell
# 后端
cd backend
npx tsc --noEmit  # 检查类型错误

# 前端
cd frontend
npx tsc --noEmit
```

---

## 📊 性能验证

### 后端性能
- [ ] API 响应时间 < 200ms
- [ ] 文件上传速度正常
- [ ] 流式播放无卡顿
- [ ] 数据库查询高效

### 前端性能
- [ ] 页面加载速度 < 3s
- [ ] 列表滚动流畅
- [ ] 播放器响应及时
- [ ] 无内存泄漏

---

## 🔒 安全检查

- [ ] JWT_SECRET 已修改（生产环境）
- [ ] 管理员密码已修改（生产环境）
- [ ] 数据库密码足够强
- [ ] .env 文件在 .gitignore 中
- [ ] uploads 目录在 .gitignore 中
- [ ] 敏感信息未提交到版本控制

---

## 📝 部署笔记

### 开发环境
- 后端: http://localhost:3000
- 前端: http://localhost:5173
- 数据库: localhost:5432

### 生产环境建议
- 使用 Nginx 反向代理
- 启用 HTTPS
- 使用 PM2 管理 Node.js 进程
- 配置数据库备份
- 设置日志轮转
- 使用环境变量管理配置

---

## 🎯 下一步行动

### 立即可做
1. [ ] 运行环境检查脚本
2. [ ] 按照步骤启动项目
3. [ ] 上传一些测试音乐
4. [ ] 体验所有功能

### 短期计划（1-2周）
1. [ ] 实现歌词功能
2. [ ] 添加搜索功能
3. [ ] 实现播放列表

### 中期计划（1个月）
1. [ ] 完成 Phase 2 所有功能
2. [ ] UI/UX 优化
3. [ ] 性能调优

---

## ✨ 恭喜！

如果所有检查项都已完成，您的 HoYoMusic MVP 已经成功部署！

**现在开始享受高品质音乐吧！🎵**

---

*检查清单版本: 1.0*
*最后更新: 2026-02-08*

