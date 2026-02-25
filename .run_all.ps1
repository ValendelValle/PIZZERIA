$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'

Write-Output '== Preparacion backend =='
Push-Location $backend
python manage.py migrate --noinput | Out-Host
python manage.py seed_data | Out-Host
Pop-Location

Write-Output '== Preparacion frontend =='
Push-Location $frontend
if (!(Test-Path 'node_modules')) { npm install | Out-Host }
npm run build | Out-Host
Pop-Location

$logDir = Join-Path $root '.runlogs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$summary = Join-Path $logDir 'run_all.summary.log'
Set-Content -Path $summary -Value '' -NoNewline

function Log-Line([string]$msg) {
  Add-Content -Path $summary -Value ($msg + [Environment]::NewLine)
}

Log-Line '== Preparacion backend =='
$backendOut = Join-Path $logDir 'backend.session.out.log'
$backendErr = Join-Path $logDir 'backend.session.err.log'
$frontendOut = Join-Path $logDir 'frontend.session.out.log'
$frontendErr = Join-Path $logDir 'frontend.session.err.log'

Write-Output '== Levantando servicios =='
Log-Line '== Levantando servicios =='
$backendProc = Start-Process -FilePath python -ArgumentList 'manage.py runserver 127.0.0.1:8000 --noreload' -WorkingDirectory $backend -PassThru -RedirectStandardOutput $backendOut -RedirectStandardError $backendErr
$frontendProc = Start-Process -FilePath npm.cmd -ArgumentList 'run preview -- --host 127.0.0.1 --port 5173' -WorkingDirectory $frontend -PassThru -RedirectStandardOutput $frontendOut -RedirectStandardError $frontendErr

function Wait-Url($url, $timeoutSec = 30) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -UseBasicParsing $url -TimeoutSec 3
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { return $r }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  throw "Timeout esperando $url"
}

try {
  $r1 = Wait-Url 'http://127.0.0.1:8000/api/health/' 40
  $r2 = Wait-Url 'http://127.0.0.1:5173/' 40
  $r3 = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:8000/api/catalogo/' -TimeoutSec 10

  Write-Output '== Verificaciones =='
  Write-Output ("Backend health: " + $r1.StatusCode)
  Write-Output ("Frontend home: " + $r2.StatusCode)
  $json = $r3.Content | ConvertFrom-Json
  Write-Output ("Catalogo mesas: " + $json.mesas.Count)
  Write-Output ("Catalogo pizzas: " + $json.productos.pizza.Count)
  Write-Output ("Catalogo bebidas: " + $json.productos.bebida.Count)
  Write-Output 'EJECUCION COMPLETA OK'
  Log-Line ("Backend health: " + $r1.StatusCode)
  Log-Line ("Frontend home: " + $r2.StatusCode)
  Log-Line ("Catalogo mesas: " + $json.mesas.Count)
  Log-Line ("Catalogo pizzas: " + $json.productos.pizza.Count)
  Log-Line ("Catalogo bebidas: " + $json.productos.bebida.Count)
  Log-Line 'EJECUCION COMPLETA OK'
}
finally {
  if ($backendProc -and !$backendProc.HasExited) { Stop-Process -Id $backendProc.Id -Force }
  if ($frontendProc -and !$frontendProc.HasExited) { Stop-Process -Id $frontendProc.Id -Force }
  Write-Output 'Servicios detenidos al finalizar la validacion automatica.'
  Log-Line 'Servicios detenidos al finalizar la validacion automatica.'
}
