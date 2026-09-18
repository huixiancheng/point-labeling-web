param(
  [string]$DataRoot = "",
  [int]$Port = 8090
)

$ErrorActionPreference = "Stop"
$PackageRoot = $PSScriptRoot
$ServiceName = "PointLabelerOpen"
$DisplayName = "Point Labeler Open Format Service"
if ([string]::IsNullOrWhiteSpace($DataRoot)) { $DataRoot = Join-Path $PackageRoot "..\clips" }
$DataRoot = [IO.Path]::GetFullPath($DataRoot)
$ServerExe = [IO.Path]::GetFullPath((Join-Path $PackageRoot "point_labeler_server.exe"))
$Assets = [IO.Path]::GetFullPath((Join-Path $PackageRoot "assets"))
$WebRoot = [IO.Path]::GetFullPath((Join-Path $PackageRoot "web"))
$LogRoot = Join-Path $env:ProgramData "PointLabelerOpen"
$LogPath = Join-Path $LogRoot "server.log"
foreach ($path in @($ServerExe, $Assets, $WebRoot, $DataRoot)) {
  if (-not (Test-Path -LiteralPath $path)) { throw "Path does not exist: $path" }
}
New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null

& sc.exe query $ServiceName *> $null
if ($LASTEXITCODE -eq 0) {
  & sc.exe stop $ServiceName *> $null
  Start-Sleep -Seconds 1
  & sc.exe delete $ServiceName *> $null
  Start-Sleep -Seconds 1
}
$command = '"{0}" --service --root "{1}" --assets "{2}" --web-root "{3}" --log "{4}" --host 127.0.0.1 --port {5}' -f $ServerExe, $DataRoot, $Assets, $WebRoot, $LogPath, $Port
& sc.exe create $ServiceName "binPath= $command" "start= auto" "DisplayName= $DisplayName" "obj= LocalSystem"
if ($LASTEXITCODE -ne 0) { throw "Creating the Windows Service failed; run elevated." }
& sc.exe description $ServiceName "Open SemanticKITTI/KITTI point-labeling service."
& sc.exe failure $ServiceName reset= 86400 actions= restart/5000/restart/10000/restart/30000 | Out-Null
Start-Service -Name $ServiceName
Write-Host "Service started: $ServiceName"
Write-Host "Open http://localhost:$Port/"
