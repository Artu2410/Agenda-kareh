# Validador de Email OTP Config
# Uso: .\check-env.ps1

Write-Host "`n🔍 Validador de Configuracion Email OTP" -ForegroundColor Cyan
Write-Host ("═" * 60) -ForegroundColor Cyan

$envFile = "server\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "`nNo se encuentra: $envFile`n" -ForegroundColor Red
    exit 1
}

$errors = @()
$warnings = @()
$success = @()

# Leer cada variable
$gmailUser = (Select-String -Path $envFile -Pattern "^GMAIL_USER=" | ForEach-Object { $_.Line -replace ".*=\s*(.*)$",'$1' })
$gmailPass = (Select-String -Path $envFile -Pattern "^GMAIL_APP_PASSWORD=" | ForEach-Object { $_.Line -replace ".*=\s*(.*)$",'$1' })
$jwtSecret = (Select-String -Path $envFile -Pattern "^JWT_SECRET=" | ForEach-Object { $_.Line -replace ".*=\s*(.*)$",'$1' })
$authEmail = (Select-String -Path $envFile -Pattern "^AUTHORIZED_EMAIL=" | ForEach-Object { $_.Line -replace ".*=\s*(.*)$",'$1' })

# Validar GMAIL_USER
if ($gmailUser) {
    $success += "OK: GMAIL_USER: $gmailUser"
} else {
    $errors += "ERROR: GMAIL_USER no configurado"
}

# Validar GMAIL_APP_PASSWORD
if (-not $gmailPass) {
    $errors += "ERROR: GMAIL_APP_PASSWORD no configurado"
} elseif ($gmailPass -like "*tu_contraseña*") {
    $errors += "ERROR: GMAIL_APP_PASSWORD es placeholder"
} elseif ($gmailPass.Length -lt 14) {
    $errors += "ERROR: GMAIL_APP_PASSWORD muy corta"
} else {
    $len = $gmailPass.Length
    $success += "OK: GMAIL_APP_PASSWORD $len caracteres"
}

# Validar JWT_SECRET
if (-not $jwtSecret) {
    $errors += "ERROR: JWT_SECRET no configurado"
} elseif ($jwtSecret -like "*tu_jwt_secret*") {
    $errors += "ERROR: JWT_SECRET es placeholder"
} elseif ($jwtSecret.Length -lt 32) {
    $errors += "ERROR: JWT_SECRET muy corto (min 32)"
} else {
    $len = $jwtSecret.Length
    $success += "OK: JWT_SECRET $len caracteres"
}

# Validar AUTHORIZED_EMAIL
if ($authEmail) {
    $success += "OK: AUTHORIZED_EMAIL: $authEmail"
} else {
    $warnings += "WARN: AUTHORIZED_EMAIL no configurado"
}

# Mostrar resultados
Write-Host "`n=== VALIDACION DE CONFIGURACION ===" -ForegroundColor Cyan
Write-Host "`nValidas:`n" -ForegroundColor Green
$success | ForEach-Object { Write-Host "  $_" }

if ($warnings.Count -gt 0) {
    Write-Host "`nAdvertencias:`n" -ForegroundColor Yellow
    $warnings | ForEach-Object { Write-Host "  $_" }
}

if ($errors.Count -gt 0) {
    Write-Host "`nERROES - DEBES CORREGIR:`n" -ForegroundColor Red
    $errors | ForEach-Object { Write-Host "  $_" }
    Write-Host "`nLee: DIAGNOSTICO_ERROR_500.md para instrucciones`n" -ForegroundColor Cyan
    exit 1
}

Write-Host "`n=== CONFIGURACION VALIDA ===" -ForegroundColor Green
Write-Host "`nProximos pasos:"
Write-Host "  1. Reinicia: node server.js"
Write-Host "  2. Abre: http://localhost:5173"
Write-Host "  3. Email: centrokareh at gmail.com"
Write-Host ""

