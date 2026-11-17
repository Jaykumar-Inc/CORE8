$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$portableNode = Join-Path $projectRoot '.tools\node-v22.16.0-win-x64'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    if (-not (Test-Path -LiteralPath (Join-Path $portableNode 'node.exe'))) {
        throw 'Install Node.js LTS 22.12+ first. See INSTALLATION.md.'
    }
    $env:PATH = $portableNode + ';' + $env:PATH
}
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules'))) {
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
& npm.cmd run dev
exit $LASTEXITCODE
