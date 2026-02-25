$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

Write-Host "Preparando proyecto..." -ForegroundColor Cyan

Push-Location $backend
python manage.py migrate --noinput | Out-Host
python manage.py seed_data | Out-Host
Pop-Location

Push-Location $frontend
if (!(Test-Path "node_modules")) {
  npm install | Out-Host
}
Pop-Location

Write-Host "Abriendo backend en ventana nueva..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "cd '$backend'; python manage.py runserver 127.0.0.1:8000 --noreload"
)

Start-Sleep -Seconds 2

Write-Host "Abriendo frontend en ventana nueva..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "cd '$frontend'; npm run dev -- --host 127.0.0.1 --port 5173"
)

Start-Sleep -Seconds 3

Write-Host "Abriendo navegador..." -ForegroundColor Green
Start-Process "http://127.0.0.1:5173/"

Write-Host ""
Write-Host "Listo. Si algo no carga, espera 5-10 segundos y recarga el navegador." -ForegroundColor Green
