@echo off
chcp 65001 > nul
title HoYoMusic 开发环境启动

color 0B
echo ========================================
echo    HoYoMusic 开发环境启动中...
echo ========================================
echo.

:: 检查Node.js
echo [检查] 检测Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    color 0C
    echo [错误] 未检测到Node.js，请先安装Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)
echo [成功] Node.js已安装
echo.

:: 检查后端依赖
echo [后端] 检查后端依赖...
if not exist "backend\node_modules" (
    echo [后端] 首次运行，正在安装依赖...
    cd backend
    call npm install
    if errorlevel 1 (
        color 0C
        echo [错误] 后端依赖安装失败
        pause
        exit /b 1
    )
    cd ..
)

:: 检查前端依赖
echo [前端] 检查前端依赖...
if not exist "frontend\node_modules" (
    echo [前端] 首次运行，正在安装依赖...
    cd frontend
    call npm install
    if errorlevel 1 (
        color 0C
        echo [错误] 前端依赖安装失败
        pause
        exit /b 1
    )
    cd ..
)

echo.
echo ========================================
echo    开始启动服务...
echo ========================================
echo.

:: 启动后端（新窗口）
echo [后端] 启动后端服务 (端口: 3000)...
start "HoYoMusic Backend" cmd /k "cd /d %~dp0backend && color 0D && echo 后端服务 - http://localhost:3000 && npm run dev"

:: 等待2秒
timeout /t 2 /nobreak > nul

:: 启动前端（新窗口）
echo [前端] 启动前端服务 (端口: 5173)...
start "HoYoMusic Frontend" cmd /k "cd /d %~dp0frontend && color 0A && echo 前端服务 - http://localhost:5173 && npm run dev"

echo.
echo ========================================
echo    启动完成！
echo ========================================
echo.
echo 后端服务: http://localhost:3000
echo 前端服务: http://localhost:5173
echo.
echo 提示: 已在新窗口启动服务
echo 关闭窗口可停止对应服务
echo.

:: 等待5秒后自动打开浏览器
echo 5秒后将自动打开浏览器...
timeout /t 5 /nobreak > nul

:: 打开浏览器
start http://localhost:5173

echo.
echo 按任意键退出此窗口...
pause > nul

