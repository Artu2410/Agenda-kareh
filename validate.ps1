# Validador simple de .env
Write-Host "`n=== VALIDADOR .ENV ===" -ForegroundColor Cyan

$envFile = "server\.env"
If (-not (Test-Path $envFile)) {
    Write-Host "ERROR: No existe $envFile" -ForegroundColor Red
    exit 1
}

$errors = 0
$ok = 0

# Leer GMAIL_USER
$line1 = Select-String -Path $envFile -Pattern "^GMAIL_USER=" | ForEach-Object { $_ }
if ($line1 -match "centrokareh") {
    Write-Host "OK: GMAIL_USER configurado" -ForegroundColor Green
    $ok++
} else {
    Write-Host "ERROR: GMAIL_USER no valido" -ForegroundColor Red
    $errors++
}

# Leer GMAIL_APP_PASSWORD
$line2 = Select-String -Path $envFile -Pattern "^GMAIL_APP_PASSWORD=" | ForEach-Object { $_ }
if ($line2 -like "*tu_contraseña*") {
    Write-Host "ERROR: GMAIL_APP_PASSWORD sigue siendo placeholder" -ForegroundColor Red
    $errors++
} elseif ($line2) {
    Write-Host "OK: GMAIL_APP_PASSWORD configurada" -ForegroundColor Green
    $ok++
} else {
    Write-Host "ERROR: GMAIL_APP_PASSWORD no existe" -ForegroundColor Red
    $errors++
}

# Leer JWT_SECRET
$line3 = Select-String -Path $envFile -Pattern "^JWT_SECRET=" | ForEach-Object { $_ }
if ($line3 -like "*tu_jwt_secret*") {
    Write-Host "ERROR: JWT_SECRET sigue siendo placeholder" -ForegroundColor Red
    $errors++
} elseif ($line3) {
    Write-Host "OK: JWT_SECRET configurado" -ForegroundColor Green
    $ok++
} else {
    Write-Host "ERROR: JWT_SECRET no existe" -ForegroundColor Red
    $errors++
}

Write-Host ""
if ($errors -gt 0) {
    Write-Host "Tienes $errors errores. Lee: DIAGNOSTICO_ERROR_500.md" -ForegroundColor Red
    exit 1
}

Write-Host "Configuracion valida: $ok items OK" -ForegroundColor Green
Write-Host ""
