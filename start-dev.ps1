# HoYoMusic 一键启动脚本
# 同时启动前端和后端开发服务器

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   HoYoMusic 开发环境启动中..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 获取脚本所在目录
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# 检查Node.js是否安装
Write-Host "[检查] 检测Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "[成功] Node.js版本: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[错误] 未检测到Node.js，请先安装Node.js" -ForegroundColor Red
    Write-Host "下载地址: https://nodejs.org/" -ForegroundColor Yellow
    pause
    exit 1
}

# 检查PostgreSQL是否运行
Write-Host "[检查] 检测PostgreSQL..." -ForegroundColor Yellow
$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if ($pgService -and $pgService.Status -eq "Running") {
    Write-Host "[成功] PostgreSQL服务运行中" -ForegroundColor Green
} else {
    Write-Host "[警告] PostgreSQL服务未运行，请确保数据库已启动" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   开始启动服务..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 启动后端
Write-Host "[后端] 启动后端服务..." -ForegroundColor Magenta
$backendPath = Join-Path $scriptPath "backend"

if (Test-Path $backendPath) {
    # 检查后端依赖
    $backendNodeModules = Join-Path $backendPath "node_modules"
    if (-not (Test-Path $backendNodeModules)) {
        Write-Host "[后端] 首次运行，正在安装依赖..." -ForegroundColor Yellow
        Set-Location $backendPath
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[错误] 后端依赖安装失败" -ForegroundColor Red
            pause
            exit 1
        }
    }

    # 启动后端（新窗口）
    Set-Location $backendPath
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '后端服务 - http://localhost:3000' -ForegroundColor Green; npm run dev"
    Write-Host "[成功] 后端服务已在新窗口启动 (端口: 3000)" -ForegroundColor Green
} else {
    Write-Host "[错误] 后端目录不存在: $backendPath" -ForegroundColor Red
    pause
    exit 1
}

Start-Sleep -Seconds 2

# 启动前端
Write-Host "[前端] 启动前端服务..." -ForegroundColor Magenta
$frontendPath = Join-Path $scriptPath "frontend"

if (Test-Path $frontendPath) {
    # 检查前端依赖
    $frontendNodeModules = Join-Path $frontendPath "node_modules"
    if (-not (Test-Path $frontendNodeModules)) {
        Write-Host "[前端] 首次运行，正在安装依赖..." -ForegroundColor Yellow
        Set-Location $frontendPath
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[错误] 前端依赖安装失败" -ForegroundColor Red
            pause
            exit 1
        }
    }

    # 启动前端（新窗口）
    Set-Location $frontendPath
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '前端服务 - http://localhost:5173' -ForegroundColor Green; npm run dev"
    Write-Host "[成功] 前端服务已在新窗口启动 (端口: 5173)" -ForegroundColor Green
} else {
    Write-Host "[错误] 前端目录不存在: $frontendPath" -ForegroundColor Red
    pause
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   启动完成！" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "后端服务: " -NoNewline
Write-Host "http://localhost:3000" -ForegroundColor Green
Write-Host "前端服务: " -NoNewline
Write-Host "http://localhost:5173" -ForegroundColor Green
Write-Host ""
Write-Host "提示: 关闭此窗口不会停止服务，请手动关闭前后端窗口" -ForegroundColor Yellow
Write-Host ""

# 等待5秒后自动打开浏览器
Write-Host "5秒后将自动打开浏览器..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

# 打开浏览器
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

