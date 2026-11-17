param(
    [ValidateSet('Start', 'Stop', 'Status')]
    [string]$Action = 'Start'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$dashboardRoot = Join-Path $projectRoot 'apps\dashboard'
$runtimeRoot = Join-Path $projectRoot 'artifacts\server'
$stateFile = Join-Path $runtimeRoot 'process.json'
$stdoutFile = Join-Path $runtimeRoot 'stdout.log'
$stderrFile = Join-Path $runtimeRoot 'stderr.log'
$serverUrl = 'http://127.0.0.1:5173'

function Get-Core8Process {
    if (-not (Test-Path -LiteralPath $stateFile)) { return $null }
    try {
        $saved = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
        $serverProcess = Get-Process -Id ([int]$saved.processId) -ErrorAction SilentlyContinue
        if ($null -eq $serverProcess) { return $null }
        # PID reuse must never cause STOP to terminate another application.
        if ($serverProcess.StartTime.ToUniversalTime().Ticks.ToString() -ne $saved.startTicks) { return $null }
        if ($serverProcess.Path -ne $saved.nodePath) { return $null }
        return $serverProcess
    } catch {
        return $null
    }
}

function Find-Vite {
    foreach ($relative in @('apps\dashboard\node_modules\vite\bin\vite.js', 'node_modules\vite\bin\vite.js')) {
        $candidate = Join-Path $projectRoot $relative
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    return $null
}

$actionLock = $null
try {
    New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
    try {
        $actionLock = [System.IO.File]::Open(
            (Join-Path $runtimeRoot 'action.lock'),
            [System.IO.FileMode]::OpenOrCreate,
            [System.IO.FileAccess]::ReadWrite,
            [System.IO.FileShare]::None
        )
    } catch {
        throw 'Another CORE8 server action is running. Try again when it finishes.'
    }

    $existing = Get-Core8Process
    if ($Action -eq 'Stop') {
        if ($null -ne $existing) {
            Stop-Process -Id $existing.Id -ErrorAction Stop
            $existing.WaitForExit(5000) | Out-Null
            Write-Host 'CORE8 server stopped.' -ForegroundColor Green
        } else {
            Write-Host 'No CORE8 server started by these files is running.'
            Write-Host 'For a server started manually with npm run dev, press Ctrl+C in its terminal.'
        }
        if (Test-Path -LiteralPath $stateFile) { Remove-Item -LiteralPath $stateFile }
        return
    }

    if ($Action -eq 'Status') {
        if ($null -eq $existing) { Write-Host 'CORE8 server is stopped.' }
        else { Write-Host "CORE8 server is running (PID $($existing.Id)): $serverUrl" }
        return
    }

    if ($null -ne $existing) {
        Write-Host "CORE8 server is already running: $serverUrl" -ForegroundColor Green
        return
    }

    $nodeCommand = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue
    if ($null -ne $nodeCommand) {
        $nodePath = $nodeCommand.Source
    } else {
        $nodePath = Join-Path $projectRoot '.tools\node-v22.16.0-win-x64\node.exe'
        if (-not (Test-Path -LiteralPath $nodePath)) {
            throw 'Node.js is missing. Install Node.js LTS 22.12+ and reopen this file. See INSTALLATION.md.'
        }
    }
    $env:PATH = (Split-Path -Parent $nodePath) + ';' + $env:PATH
    $vitePath = Find-Vite
    if ($null -eq $vitePath) {
        Write-Host 'Installing CORE8 dependencies...'
        Push-Location -LiteralPath $projectRoot
        try {
            & npm.cmd ci
            if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check your internet connection.' }
        } finally {
            Pop-Location
        }
        $vitePath = Find-Vite
        if ($null -eq $vitePath) { throw 'Vite was not found after installation. See INSTALLATION.md.' }
    }

    # Run Vite directly so the recorded PID is the server, not an npm/cmd wrapper.
    # strictPort keeps the printed URL and STOP target deterministic.
    $serverProcess = Start-Process -FilePath $nodePath -ArgumentList @(
        ('"' + $vitePath + '"'), '--host', '127.0.0.1', '--port', '5173', '--strictPort'
    ) -WorkingDirectory $dashboardRoot -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
    @{
        processId = $serverProcess.Id
        startTicks = $serverProcess.StartTime.ToUniversalTime().Ticks.ToString()
        nodePath = $nodePath
        url = $serverUrl
    } | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8

    $ready = $false
    $deadline = [DateTime]::UtcNow.AddSeconds(20)
    while ([DateTime]::UtcNow -lt $deadline) {
        $serverProcess.Refresh()
        if ($serverProcess.HasExited) { break }
        try {
            $response = Invoke-WebRequest -Uri $serverUrl -UseBasicParsing -TimeoutSec 1
            if ($response.StatusCode -eq 200 -and $response.Content -match '<title>CORE8') {
                Start-Sleep -Milliseconds 300
                $serverProcess.Refresh()
                if (-not $serverProcess.HasExited) { $ready = $true; break }
            }
        } catch { }
        Start-Sleep -Milliseconds 200
    }

    if (-not $ready) {
        $ours = Get-Core8Process
        if ($null -ne $ours) { Stop-Process -Id $ours.Id }
        if (Test-Path -LiteralPath $stateFile) { Remove-Item -LiteralPath $stateFile }
        $details = if (Test-Path -LiteralPath $stderrFile) { Get-Content -LiteralPath $stderrFile -Raw } else { '' }
        throw "CORE8 could not start on port 5173. Close any existing server and try again.`n$details"
    }
    Write-Host 'CORE8 server started in the background.' -ForegroundColor Green
    Write-Host "Open $serverUrl in your browser."
    Write-Host 'Double-click STOP_SERVER.bat to stop it. You can close this window.'
    Write-Host "Logs: $runtimeRoot"
} catch {
    Write-Host "CORE8: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    if ($null -ne $actionLock) { $actionLock.Dispose() }
}
