# Renderiza a MP4 (1920x1080, 30 fps) los proyectos de este repositorio con Chrome headless + ffmpeg.
# Reanudable: los tramos ya terminados se saltan. Un tramo colgado se reintenta.
#   Todas las maravillas que aún no tengan video:  powershell -ExecutionPolicy Bypass -File tools\render.ps1
#   Una sola:                                      powershell -ExecutionPolicy Bypass -File tools\render.ps1 -Project coloso
#   Rehacer aunque ya exista:                      ... -Project coloso -Force
param([string]$Project = '', [switch]$Force)
$ErrorActionPreference = 'Continue'
$repo   = Split-Path -Parent $PSScriptRoot
$chrome = @('C:\Program Files\Google\Chrome\Application\chrome.exe',
            "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
            'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe') | Where-Object { Test-Path $_ } | Select-Object -First 1
$port   = 8779
$chunk  = 15

if ($Project) { $projects = @(Join-Path $repo $Project) }
else { $projects = Get-ChildItem $repo -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'index.html') } | ForEach-Object { $_.FullName } }

foreach ($proj in $projects) {
  $pname  = Split-Path -Leaf $proj
  $export = Join-Path $proj 'export'
  $parts  = Join-Path $export 'partes'
  $log    = Join-Path $export 'render.log'
  $final  = Join-Path $export ($pname + '_1080p.mp4')
  if ((Test-Path $final) -and -not $Force) { Write-Host "[$pname] ya existe $final (usa -Force para rehacer)"; continue }
  if ($Force -and (Test-Path $parts)) { Remove-Item -Recurse -Force $parts }
  New-Item -ItemType Directory -Force $parts | Out-Null
  $m = Select-String -Path (Join-Path $proj 'js\chapters.js') -Pattern 'DURATION\s*=\s*([\d.]+)' | Select-Object -First 1
  $dur = [double]$m.Matches[0].Groups[1].Value
  function Log($msg) { $l = "$(Get-Date -Format 'HH:mm:ss') [$pname] $msg"; Write-Host $l; Add-Content -Path $log -Value $l -Encoding utf8 }
  Log "duracion $dur s"

  $server = Start-Process python -ArgumentList @("`"$repo\tools\rec_server.py`"", $port, "`"$proj`"") -WindowStyle Hidden -PassThru
  Start-Sleep 2
  $i = 0
  for ($from = 0; $from -lt $dur; $from += $chunk) {
    $to = [Math]::Min($dur, $from + $chunk)
    $name = ('partes/p{0:D2}.mp4' -f $i); $i++
    $file = Join-Path $export $name
    if (Test-Path "$file.done") { continue }
    for ($try = 1; $try -le 4; $try++) {
      Log "tramo $name ($from-$to s) intento $try"
      $prof = Join-Path $env:TEMP ('maravillas_chrome_' + [guid]::NewGuid().ToString('N'))
      $url = "http://127.0.0.1:$port/index.html?export=1&from=$from&to=$to&name=$name"
      $cargs = @('--headless=new', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11',
                 '--window-size=1920,1080', '--mute-audio', '--disable-background-timer-throttling',
                 '--disable-renderer-backgrounding', "--user-data-dir=`"$prof`"", $url)
      Start-Process $chrome -ArgumentList $cargs -WindowStyle Hidden | Out-Null
      $sw = [Diagnostics.Stopwatch]::StartNew()
      while (-not (Test-Path "$file.done") -and $sw.Elapsed.TotalMinutes -lt 4) { Start-Sleep 3 }
      Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*$prof*" } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
      if (-not (Test-Path "$file.done")) {
        # ffmpeg colgado de este tramo: liberar el archivo para el reintento
        Get-CimInstance Win32_Process -Filter "Name='ffmpeg.exe'" | Where-Object { $_.CommandLine -like "*$export*" } |
          ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
      }
      Remove-Item -Recurse -Force $prof -ErrorAction SilentlyContinue
      if (Test-Path "$file.done") { Log "ok en $([int]$sw.Elapsed.TotalSeconds) s"; break }
      Log "fallo, reintento"
    }
  }
  Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
  $missing = 0..($i - 1) | Where-Object { -not (Test-Path (Join-Path $parts ('p{0:D2}.mp4.done' -f $_))) }
  if ($missing) { Log "FALTAN TRAMOS: $($missing -join ', ') — vuelve a ejecutar el script"; continue }
  $list = Join-Path $parts 'lista.txt'
  Get-ChildItem $parts -Filter 'p*.mp4' | Sort-Object Name | ForEach-Object { "file '$($_.FullName)'" } | Set-Content -Path $list -Encoding ascii
  & ffmpeg -y -loglevel error -f concat -safe 0 -i $list -c copy -movflags +faststart $final
  Log "FIN: $final"
}
