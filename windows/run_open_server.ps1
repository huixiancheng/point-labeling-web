param(
  [string]$DataRoot = "",
  [int]$Port = 8090
)

$ErrorActionPreference = "Stop"
$PackageRoot = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($DataRoot)) { $DataRoot = Join-Path $PackageRoot "..\clips" }
$DataRoot = [IO.Path]::GetFullPath($DataRoot)
$ServerExe = Join-Path $PackageRoot "point_labeler_server.exe"
$Assets = Join-Path $PackageRoot "assets"
$WebRoot = Join-Path $PackageRoot "web"
$LogPath = Join-Path $PackageRoot "..\logs\server-foreground.log"

foreach ($path in @($ServerExe, $Assets, $WebRoot, $DataRoot)) {
  if (-not (Test-Path -LiteralPath $path)) { throw "Path does not exist: $path" }
}
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $LogPath) | Out-Null
Write-Host "Open http://localhost:$Port/"
& $ServerExe --root $DataRoot --assets $Assets --web-root $WebRoot --log $LogPath --host 127.0.0.1 --port $Port
exit $LASTEXITCODE
