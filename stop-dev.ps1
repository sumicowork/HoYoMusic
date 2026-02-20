# HoYoMusic 服务停止脚本

Write-Host "========================================" -ForegroundColor Red
Write-Host "   HoYoMusic 停止所有服务" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""

# 查找并停止Node.js进程（后端和前端）
Write-Host "[停止] 正在查找Node.js进程..." -ForegroundColor Yellow

$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    Write-Host "[发现] 找到 $($nodeProcesses.Count) 个Node.js进程" -ForegroundColor Yellow

    foreach ($process in $nodeProcesses) {
        try {
            # 检查进程命令行参数，确认是否为开发服务器
            $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $($process.Id)" -ErrorAction SilentlyContinue

            if ($processInfo -and ($processInfo.CommandLine -like "*npm*dev*" -or $processInfo.CommandLine -like "*vite*" -or $processInfo.CommandLine -like "*nodemon*")) {
                Write-Host "[停止] 正在停止进程 (PID: $($process.Id))..." -ForegroundColor Magenta
                Stop-Process -Id $process.Id -Force
                Write-Host "[成功] 已停止进程 (PID: $($process.Id))" -ForegroundColor Green
            }
        } catch {
            Write-Host "[警告] 无法停止进程 (PID: $($process.Id)): $_" -ForegroundColor Yellow
        }
    }

    Write-Host ""
    Write-Host "[成功] 所有开发服务已停止" -ForegroundColor Green
} else {
    Write-Host "[信息] 未找到运行中的Node.js进程" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

