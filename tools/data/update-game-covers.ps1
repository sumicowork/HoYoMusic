# 游戏图标数据库更新脚本
# 使用方法: .\update-game-covers.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  游戏图标数据库更新脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 获取数据库连接信息
Write-Host "请输入数据库连接信息:" -ForegroundColor Yellow
$dbHost = Read-Host "数据库地址 (默认: localhost)"
if ([string]::IsNullOrWhiteSpace($dbHost)) { $dbHost = "localhost" }

$dbPort = Read-Host "端口 (默认: 5432)"
if ([string]::IsNullOrWhiteSpace($dbPort)) { $dbPort = "5432" }

$dbName = Read-Host "数据库名称 (默认: hoyomusic)"
if ([string]::IsNullOrWhiteSpace($dbName)) { $dbName = "hoyomusic" }

$dbUser = Read-Host "用户名 (默认: postgres)"
if ([string]::IsNullOrWhiteSpace($dbUser)) { $dbUser = "postgres" }

$dbPassword = Read-Host "密码" -AsSecureString
$dbPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword))

Write-Host ""
Write-Host "正在连接数据库..." -ForegroundColor Yellow

# 设置环境变量
$env:PGPASSWORD = $dbPasswordPlain

# 执行 SQL 脚本
try {
    $sqlFile = Join-Path $PSScriptRoot "backend\update_game_covers.sql"

    if (-not (Test-Path $sqlFile)) {
        Write-Host "❌ 错误: 找不到 SQL 文件: $sqlFile" -ForegroundColor Red
        exit 1
    }

    Write-Host "正在执行 SQL 脚本..." -ForegroundColor Yellow

    # 使用 psql 执行脚本
    $result = & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $sqlFile 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ 数据库更新成功！" -ForegroundColor Green
        Write-Host ""
        Write-Host "已更新的游戏封面路径:" -ForegroundColor Cyan
        Write-Host "  - 原神: /games/genshin.png" -ForegroundColor White
        Write-Host "  - 崩坏：星穹铁道: /games/starrail.png" -ForegroundColor White
        Write-Host "  - 绝区零: /games/zzz.png" -ForegroundColor White
        Write-Host ""
        Write-Host "下一步:" -ForegroundColor Yellow
        Write-Host "  1. 启动后端: cd backend && npm run dev" -ForegroundColor White
        Write-Host "  2. 启动前端: cd frontend && npm run dev" -ForegroundColor White
        Write-Host "  3. 访问 http://localhost:5173 查看效果" -ForegroundColor White
    } else {
        Write-Host ""
        Write-Host "❌ 数据库更新失败！" -ForegroundColor Red
        Write-Host "错误信息:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red

        Write-Host ""
        Write-Host "可能的原因:" -ForegroundColor Yellow
        Write-Host "  1. 数据库连接信息错误" -ForegroundColor White
        Write-Host "  2. psql 命令未安装或不在 PATH 中" -ForegroundColor White
        Write-Host "  3. 数据库中不存在 games 表" -ForegroundColor White
        Write-Host ""
        Write-Host "手动执行方法:" -ForegroundColor Yellow
        Write-Host "  打开数据库管理工具，执行 backend/update_game_covers.sql 中的 SQL 语句" -ForegroundColor White
    }
} catch {
    Write-Host ""
    Write-Host "❌ 发生错误: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "提示: 如果没有安装 psql，请使用数据库管理工具手动执行 SQL 脚本" -ForegroundColor Yellow
} finally {
    # 清除密码环境变量
    $env:PGPASSWORD = ""
}

Write-Host ""
Write-Host "按任意键退出..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

