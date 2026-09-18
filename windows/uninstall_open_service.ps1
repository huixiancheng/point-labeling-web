param([string]$ServiceName = "PointLabelerOpen")
$ErrorActionPreference = "Stop"
& sc.exe query $ServiceName *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "Service not found: $ServiceName"; exit 0 }
& sc.exe stop $ServiceName *> $null
Start-Sleep -Seconds 1
& sc.exe delete $ServiceName *> $null
Write-Host "Service removed: $ServiceName"
