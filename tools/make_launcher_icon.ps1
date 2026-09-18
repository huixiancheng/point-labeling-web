param(
  [string]$InputPath = (Join-Path $PSScriptRoot "..\windows\assets\point_labeler_icon.png"),
  [string]$OutputPath = (Join-Path $PSScriptRoot "..\windows\assets\point_labeler_icon.ico")
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$outputDirectory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$source = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $InputPath).Path)
$sizes = @(256, 48, 32, 16)
$frames = New-Object System.Collections.Generic.List[byte[]]

try {
  foreach ($size in $sizes) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.DrawImage($source, 0, 0, $size, $size)
      $stream = New-Object System.IO.MemoryStream
      try {
        $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
        $frames.Add($stream.ToArray())
      }
      finally { $stream.Dispose() }
    }
    finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  }
}
finally { $source.Dispose() }

$output = [System.IO.File]::Open($OutputPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
$writer = New-Object System.IO.BinaryWriter($output)
try {
  $writer.Write([UInt16]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]$frames.Count)
  $offset = 6 + (16 * $frames.Count)
  for ($index = 0; $index -lt $frames.Count; $index++) {
    $size = $sizes[$index]
    $dimensionByte = if ($size -ge 256) { 0 } else { $size }
    $writer.Write([Byte]$dimensionByte)
    $writer.Write([Byte]$dimensionByte)
    $writer.Write([Byte]0)
    $writer.Write([Byte]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]32)
    $writer.Write([UInt32]$frames[$index].Length)
    $writer.Write([UInt32]$offset)
    $offset += $frames[$index].Length
  }
  foreach ($frame in $frames) { $writer.Write($frame) }
}
finally {
  $writer.Dispose()
  $output.Dispose()
}

Write-Host "Launcher icon written: $OutputPath"
