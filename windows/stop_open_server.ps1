$ErrorActionPreference = "Stop"
$ServerExe = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "point_labeler_server.exe"))
if (-not (Test-Path -LiteralPath $ServerExe -PathType Leaf)) { Write-Error "Server executable not found: $ServerExe"; exit 2 }

$target = $ServerExe.TrimEnd('\').ToLowerInvariant()
$processes = @(Get-CimInstance Win32_Process -Filter "Name = 'point_labeler_server.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.ExecutablePath -and ([IO.Path]::GetFullPath($_.ExecutablePath).TrimEnd('\').ToLowerInvariant() -eq $target) })
if ($processes.Count -eq 0) { Write-Output "No running open point-labeler server found for this package."; exit 0 }
foreach ($process in $processes) {
  Stop-Process -Id ([int]$process.ProcessId) -Force -ErrorAction Stop
  Write-Output "Stopped point_labeler_server.exe (PID $($process.ProcessId))."
}
exit 0
