<#
.SYNOPSIS
  一键导出静态数据 + 构建静态前端

.DESCRIPTION
  1. 运行后端 export-static 脚本，从 PG 导出 JSON + 封面到 frontend/public/data/
  2. 运行前端 build:static 命令，构建纯静态 SPA 到 frontend/dist-static/

.PARAMETER CdnBaseUrl
  FLAC 音频文件的 CDN URL 前缀（必需）

.EXAMPLE
  .\scripts\publish-static.ps1 -CdnBaseUrl "https://cdn.example.com/tracks"
#>

param(
  [Parameter(Mandatory=$true)]
  [string]$CdnBaseUrl,

  [string]$CoverMode = "inline"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host ""
Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  HoYoMusic 静态站点生成" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Step 1: 导出静态数据
Write-Host "[1/2] 导出静态数据..." -ForegroundColor Yellow
$env:CDN_BASE_URL = $CdnBaseUrl
$env:COVER_MODE = $CoverMode
Set-Location "$root\backend"
npx ts-node scripts/export-static.ts
if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ 静态数据导出失败" -ForegroundColor Red
  exit 1
}

# Step 2: 构建静态前端
Write-Host ""
Write-Host "[2/2] 构建静态前端..." -ForegroundColor Yellow
Set-Location "$root\frontend"
npm run build:static
if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ 前端构建失败" -ForegroundColor Red
  exit 1
}

# 完成
$distDir = "$root\frontend\dist-static"
$distSize = (Get-ChildItem -Recurse -File $distDir | Measure-Object -Property Length -Sum).Sum
$distSizeMB = [math]::Round($distSize / 1MB, 2)

Write-Host ""
Write-Host "════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✅ 静态站点构建完成！" -ForegroundColor Green
Write-Host "  📂 产物目录: $distDir" -ForegroundColor Green
Write-Host "  📊 产物大小: $distSizeMB MB" -ForegroundColor Green
Write-Host "" -ForegroundColor Green
Write-Host "  部署方式:" -ForegroundColor Green
Write-Host "    • GitHub Pages: npx gh-pages -d frontend/dist-static" -ForegroundColor Green
Write-Host "    • Vercel/Netlify: 指向 frontend/dist-static 目录" -ForegroundColor Green
Write-Host "    • 本地预览: cd frontend && npx vite preview --outDir dist-static" -ForegroundColor Green
Write-Host "════════════════════════════════════════════" -ForegroundColor Green

Set-Location $root

