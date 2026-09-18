param(
  [string]$QtPrefix = "",
  [string]$OutputDir = "",
  [string]$Generator = "",
  [string]$Platform = "x64"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($OutputDir)) {
  # Keep generated release output separate from package_open, which is the
  # local 300-frame regression fixture and may contain user test data.
  $OutputDir = Join-Path $PSScriptRoot "release_open"
}
$BuildDir = Join-Path $PSScriptRoot "build_open_windows"
$LauncherSource = Join-Path $PSScriptRoot "launcher\PointLabelerLauncher.cs"
$LauncherIcon = Join-Path $PSScriptRoot "assets\point_labeler_icon.ico"
$LauncherExe = Join-Path $BuildDir "PointLabelerLauncher.exe"
$VersionFile = Join-Path $ProjectRoot "VERSION"
$ChangelogFile = Join-Path $ProjectRoot "CHANGELOG.md"

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) { throw "Required command not found: $Name" }
}

if (-not (Test-Path -LiteralPath $LauncherSource -PathType Leaf)) {
  throw "Launcher source was not found: $LauncherSource"
}
if (-not (Test-Path -LiteralPath $LauncherIcon -PathType Leaf)) {
  throw "Launcher icon was not found: $LauncherIcon"
}
if (-not (Test-Path -LiteralPath $VersionFile -PathType Leaf)) {
  throw "Version file was not found: $VersionFile"
}
if (-not (Test-Path -LiteralPath $ChangelogFile -PathType Leaf)) {
  throw "Changelog file was not found: $ChangelogFile"
}
$CscPath = $null
$CscCommand = Get-Command csc.exe -ErrorAction SilentlyContinue
if ($null -ne $CscCommand) {
  $CscPath = $CscCommand.Source
} else {
  foreach ($candidate in @(
      (Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"),
      (Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe")
    )) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { $CscPath = $candidate; break }
  }
}
if ([string]::IsNullOrWhiteSpace($CscPath)) {
  throw "csc.exe was not found; install the .NET Framework developer tools"
}

Require-Command "cmake"

$NpmCommand = Get-Command npm -ErrorAction SilentlyContinue
$PnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
if ($null -eq $NpmCommand -and $null -eq $PnpmCommand) {
  throw "Neither npm nor pnpm was found; install Node.js/npm or pnpm first"
}

Push-Location (Join-Path $ProjectRoot "frontend")
try {
  if ($null -ne $NpmCommand) {
    & $NpmCommand.Source ci
  } else {
    & $PnpmCommand.Source install --frozen-lockfile --ignore-scripts
  }
  if ($LASTEXITCODE -ne 0) { throw "Frontend dependency install failed" }
  if ($null -ne $NpmCommand) {
    & $NpmCommand.Source run build
  } else {
    & $PnpmCommand.Source run build
  }
  if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }
} finally { Pop-Location }

New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null
$LauncherCscArgs = @(
  "/nologo", "/target:winexe", "/optimize+", "/platform:anycpu",
  "/r:System.Windows.Forms.dll", "/r:System.Drawing.dll", "/out:$LauncherExe"
)
if (Test-Path -LiteralPath $LauncherIcon -PathType Leaf) {
  $LauncherCscArgs += "/win32icon:$LauncherIcon"
}
$LauncherCscArgs += $LauncherSource
& $CscPath @LauncherCscArgs
if ($LASTEXITCODE -ne 0) { throw "Launcher build failed" }

$CmakeArgs = @("-S", (Join-Path $ProjectRoot "server"), "-B", $BuildDir)
if (-not [string]::IsNullOrWhiteSpace($Generator)) { $CmakeArgs += @("-G", $Generator) }
if ([string]::IsNullOrWhiteSpace($Generator) -or $Generator -match "Visual Studio") {
  $CmakeArgs += @("-A", $Platform)
}
if (-not [string]::IsNullOrWhiteSpace($QtPrefix)) { $CmakeArgs += "-DCMAKE_PREFIX_PATH=$QtPrefix" }
& cmake @CmakeArgs
if ($LASTEXITCODE -ne 0) { throw "CMake configure failed" }
& cmake --build $BuildDir --config Release --target point_labeler_server
if ($LASTEXITCODE -ne 0) { throw "Backend build failed" }

$ServerExe = Join-Path $BuildDir "Release\point_labeler_server.exe"
if (-not (Test-Path -LiteralPath $ServerExe)) {
  $ServerExe = (Get-ChildItem -LiteralPath $BuildDir -Filter point_labeler_server.exe -Recurse | Select-Object -First 1).FullName
}
if ([string]::IsNullOrWhiteSpace($ServerExe) -or -not (Test-Path -LiteralPath $ServerExe)) { throw "point_labeler_server.exe was not found" }

if (Test-Path -LiteralPath $OutputDir) {
  foreach ($protectedName in @("clips", "logs")) {
    $protectedPath = Join-Path $OutputDir $protectedName
    if (Test-Path -LiteralPath $protectedPath -PathType Container) {
      $protectedItems = @(Get-ChildItem -LiteralPath $protectedPath -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -ne "README.txt" })
      if ($protectedItems.Count -gt 0) {
        throw "Refusing to clean '$OutputDir': $protectedName contains data. Choose a new -OutputDir so clips and logs cannot be removed."
      }
    }
  }
  Remove-Item -LiteralPath $OutputDir -Recurse -Force
}
$AppDir = Join-Path $OutputDir "app"
$AssetsDir = Join-Path $AppDir "assets"
$WebDir = Join-Path $AppDir "web"
$ClipsDir = Join-Path $OutputDir "clips"
$LogsDir = Join-Path $OutputDir "logs"
$UpdateDir = Join-Path $OutputDir "update"
New-Item -ItemType Directory -Force -Path $AppDir, $AssetsDir, $WebDir, $ClipsDir, $LogsDir, $UpdateDir | Out-Null
@{
  (Join-Path $ClipsDir "README.txt") = "Place SemanticKITTI or KITTI data under this directory. The launcher scans it recursively.`r`n"
  (Join-Path $LogsDir "README.txt") = "Runtime and foreground diagnostic logs are written here.`r`n"
  (Join-Path $UpdateDir "README.txt") = "Put a new app directory here as update\\app, then choose Update in the launcher.`r`n"
}.GetEnumerator() | ForEach-Object {
  if (-not (Test-Path -LiteralPath $_.Key)) {
    Set-Content -LiteralPath $_.Key -Value $_.Value -Encoding UTF8
  }
}

Copy-Item -LiteralPath $ServerExe -Destination (Join-Path $AppDir "point_labeler_server.exe") -Force
Copy-Item -LiteralPath $LauncherExe -Destination (Join-Path $OutputDir "PointLabelerLauncher.exe") -Force
Copy-Item -Path (Join-Path $ProjectRoot "server\assets\*") -Destination $AssetsDir -Recurse -Force
Copy-Item -Path (Join-Path $ProjectRoot "frontend\dist\*") -Destination $WebDir -Recurse -Force
$PackageDocs = @(
  (Join-Path $PSScriptRoot "README_WINDOWS.md"),
  (Join-Path $PSScriptRoot "README_PACKAGE.txt"),
  (Join-Path $ProjectRoot "LICENSE"),
  (Join-Path $ProjectRoot "NOTICE"),
  (Join-Path $ProjectRoot "THIRD_PARTY_NOTICES.md"),
  $VersionFile,
  $ChangelogFile
)
Copy-Item -LiteralPath $PackageDocs -Destination $OutputDir -Force

$DeployTool = $null
if (-not [string]::IsNullOrWhiteSpace($QtPrefix)) {
  $CandidateDeployTool = Join-Path $QtPrefix "bin\windeployqt.exe"
  if (Test-Path -LiteralPath $CandidateDeployTool) { $DeployTool = $CandidateDeployTool }
}
if ($null -eq $DeployTool) { $DeployTool = (Get-Command windeployqt -ErrorAction SilentlyContinue).Source }
if ($null -eq $DeployTool) { throw "windeployqt was not found; set -QtPrefix or add it to PATH" }

# windeployqt can copy the MSVC CRT when VCINSTALLDIR is set. In a clean
# PowerShell session that variable is often absent, so locate the installed
# Visual Studio instance explicitly and also copy the exact x64 CRT DLLs into
# the package. This prevents a package that works only on the build machine.
$VsWhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
$VsInstall = $null
if (Test-Path -LiteralPath $VsWhere -PathType Leaf) {
  $VsInstall = (& $VsWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath | Select-Object -First 1).Trim()
}
if (-not [string]::IsNullOrWhiteSpace($VsInstall)) {
  $env:VCINSTALLDIR = Join-Path $VsInstall "VC\"
}
& $DeployTool --release --compiler-runtime --no-translations --no-system-d3d-compiler (Join-Path $AppDir "point_labeler_server.exe")
if ($LASTEXITCODE -ne 0) { throw "windeployqt failed" }

$RequiredRuntimeNames = @("msvcp140.dll", "vcruntime140.dll", "vcruntime140_1.dll")
$RuntimeCandidates = @()
if (-not [string]::IsNullOrWhiteSpace($VsInstall)) {
  $RuntimeRoot = Join-Path $VsInstall "VC\Redist\MSVC"
  if (Test-Path -LiteralPath $RuntimeRoot -PathType Container) {
    $RuntimeDirectories = @(Get-ChildItem -Path (Join-Path $RuntimeRoot "*\x64\Microsoft.VC*.CRT") -Directory -ErrorAction SilentlyContinue)
    $RuntimeCandidates = @($RuntimeDirectories | ForEach-Object {
      Get-ChildItem -LiteralPath $_.FullName -File -ErrorAction SilentlyContinue
    })
  }
}
foreach ($RuntimeName in $RequiredRuntimeNames) {
  $RuntimeFile = $RuntimeCandidates |
    Where-Object { $_.Name -ieq $RuntimeName } |
    Sort-Object FullName -Descending |
    Select-Object -First 1
  if ($null -eq $RuntimeFile) {
    throw "Required x64 MSVC runtime was not found: $RuntimeName. Install Visual Studio C++ tools or the VC++ Redistributable."
  }
  Copy-Item -LiteralPath $RuntimeFile.FullName -Destination (Join-Path $AppDir $RuntimeName) -Force
}
# The DLLs above are the self-contained runtime used by the server.  The
# installer copied by windeployqt is unnecessary for this no-install package
# and would add a large duplicate payload.
foreach ($RedistInstallerName in @("vc_redist.x64.exe", "vc_redist.x86.exe")) {
  $RedistInstaller = Join-Path $AppDir $RedistInstallerName
  if (Test-Path -LiteralPath $RedistInstaller -PathType Leaf) {
    Remove-Item -LiteralPath $RedistInstaller -Force
  }
}

$QtLicense = $null
if (-not [string]::IsNullOrWhiteSpace($QtPrefix)) {
  $QtLicenseCandidate = Join-Path $QtPrefix "..\..\Licenses\LICENSE"
  if (Test-Path -LiteralPath $QtLicenseCandidate -PathType Leaf) { $QtLicense = $QtLicenseCandidate }
}
if ($null -eq $QtLicense) {
  $QtLicenseCandidate = Join-Path $env:ProgramData "Qt\Licenses\LICENSE"
  if (Test-Path -LiteralPath $QtLicenseCandidate -PathType Leaf) { $QtLicense = $QtLicenseCandidate }
}
if ($null -eq $QtLicense) {
  throw "Qt license file was not found; preserve QT_LICENSE.txt with the Windows package."
}
Copy-Item -LiteralPath $QtLicense -Destination (Join-Path $OutputDir "QT_LICENSE.txt") -Force

$ProjectVersion = (Get-Content -LiteralPath $VersionFile -Raw).Trim()
if ([string]::IsNullOrWhiteSpace($ProjectVersion)) {
  throw "VERSION is empty: $VersionFile"
}

$BuildInfo = [ordered]@{
  product = "point-labeling-web"
  version = $ProjectVersion
  format = "SemanticKITTI/KITTI"
  labelSchema = "semantickitti_learning_20 or generic_semantic_20"
  builtAtUtc = [DateTime]::UtcNow.ToString("o")
  generator = if ([string]::IsNullOrWhiteSpace($Generator)) { "CMake default" } else { $Generator }
  platform = $Platform
  launcher = "PointLabelerLauncher.exe"
}
$BuildInfo | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $AppDir "build-info.json") -Encoding UTF8
Write-Host "Windows open-format package ready: $OutputDir"
