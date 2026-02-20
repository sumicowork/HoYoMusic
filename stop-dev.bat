@echo off
chcp 65001 > nul
title HoYoMusic 停止服务
color 0C

echo ========================================
echo    HoYoMusic 停止所有服务
echo ========================================
echo.

echo [停止] 正在查找Node.js进程...

:: 停止所有Node.js进程
tasklist /FI "IMAGENAME eq node.exe" 2>NUL | find /I /N "node.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [发现] 找到Node.js进程，正在停止...
    taskkill /F /IM node.exe > nul 2>&1
    echo [成功] 所有Node.js服务已停止
) else (
    echo [信息] 未找到运行中的Node.js进程
)

echo.
echo 按任意键退出...
pause > nul

