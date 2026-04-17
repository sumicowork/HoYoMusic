[CmdletBinding()]
param(
    [switch]$SkipBuild,
    [switch]$SkipTest,
    [int]$LaunchWaitSeconds = 12
)

$ErrorActionPreference = 'Stop'

$repoRoot = "C:\Users\sumi\WebstormProjects\HoYoMusic\client-desktop"
$appProject = Join-Path $repoRoot "src\HoYoMusic.Desktop.App\HoYoMusic.Desktop.App.csproj"
$solutionPath = Join-Path $repoRoot "HoYoMusic.Desktop.sln"
$startupLog = Join-Path $env:TEMP "HoYoMusic.Desktop.startup.log"
$stdoutLog = Join-Path $env:TEMP "HoYoMusic.Desktop.startup-smoke.stdout.log"
$stderrLog = Join-Path $env:TEMP "HoYoMusic.Desktop.startup-smoke.stderr.log"

Write-Host "[startup-smoke] repo: $repoRoot"
Set-Location $repoRoot

if (-not $SkipBuild) {
    Write-Host "[startup-smoke] dotnet build"
    dotnet build $solutionPath
}

if (-not $SkipTest) {
    Write-Host "[startup-smoke] dotnet test"
    dotnet test $solutionPath
}

if (Test-Path $startupLog) {
    Remove-Item $startupLog -Force
}

if (Test-Path $stdoutLog) {
    Remove-Item $stdoutLog -Force
}

if (Test-Path $stderrLog) {
    Remove-Item $stderrLog -Force
}

$runArgs = @(
    "run",
    "--project",
    $appProject
)

Write-Host "[startup-smoke] launch app: dotnet $($runArgs -join ' ')"
$process = Start-Process -FilePath "dotnet" -ArgumentList $runArgs -PassThru -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog

try {
    Start-Sleep -Seconds $LaunchWaitSeconds

    if ($process.HasExited) {
        $stdout = if (Test-Path $stdoutLog) { Get-Content $stdoutLog -Raw } else { "" }
        $stderr = if (Test-Path $stderrLog) { Get-Content $stderrLog -Raw } else { "" }
        throw "Desktop app exited too early (exit=$($process.ExitCode)).`nSTDOUT:`n$stdout`nSTDERR:`n$stderr"
    }

    if (Test-Path $startupLog) {
        $logText = Get-Content $startupLog -Raw
        throw "Desktop startup log was generated, startup likely failed.`n$startupLog`n$logText"
    }

    Write-Host "[startup-smoke] PASS: app stayed alive for $LaunchWaitSeconds seconds without startup crash log."
}
finally {
    if (-not $process.HasExited) {
        Stop-Process -Id $process.Id -Force
    }
}
