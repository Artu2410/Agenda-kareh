# =============================================================
# 🚀 INICIAR DESARROLLO LOCAL - Kareh PRO
# =============================================================
# Ejecutar: .\start-dev.ps1
# Inicia automáticamente Backend + Frontend

param(
    [switch]$ServerOnly,
    [switch]$ClientOnly
)

Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║       🚀 INICIANDO DESARROLLO LOCAL - Kareh PRO            ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$blue = "Cyan"
$green = "Green"
$yellow = "Yellow"

# Validar .env
if (-not (Test-Path "server\.env")) {
    Write-Host "❌ No encontrado: server\.env" -ForegroundColor Red
    Write-Host "   Ejecuta primero: .\setup-local.ps1`n" -ForegroundColor Yellow
    exit 1
}

# =============================================================
# INICIAR BACKEND (Terminal 1)
# =============================================================
if (-not $ClientOnly) {
    Write-Host "[Backend] 🔧 Iniciando servidor en puerto 5000..." -ForegroundColor $blue
    Write-Host "          Espera a ver: 'Servidor ejecutándose en puerto 5000'`n" -ForegroundColor $blue
    
    $backendJob = Start-Process powershell -ArgumentList {
        Set-Location "server"
        Write-Host "Servidor iniciando..." -ForegroundColor Cyan
        npm run dev
        Write-Host "✅ Servidor iniciado. Para detener: Presiona Ctrl+C" -ForegroundColor Green
        Read-Host "Presiona Enter para cerrar"
    } -PassThru
    
    Write-Host "   ✅ Backend iniciado (PID: $($backendJob.Id))" -ForegroundColor $green
    Start-Sleep -Seconds 2
}

# =============================================================
# INICIAR FRONTEND (Terminal 2)
# =============================================================
if (-not $ServerOnly) {
    Write-Host "`n[Frontend] 🎨 Iniciando cliente en puerto 5173..." -ForegroundColor $blue
    Write-Host "           Espera a ver: 'Local: http://localhost:5173'`n" -ForegroundColor $blue
    
    $clientJob = Start-Process powershell -ArgumentList {
        Set-Location "client"
        Write-Host "Cliente iniciando..." -ForegroundColor Cyan
        npm run dev
        Write-Host "✅ Cliente iniciado. Para detener: Presiona Ctrl+C" -ForegroundColor Green
        Read-Host "Presiona Enter para cerrar"
    } -PassThru
    
    Write-Host "   ✅ Frontend iniciado (PID: $($clientJob.Id))" -ForegroundColor $green
    Start-Sleep -Seconds 1
}

# =============================================================
# FIN
# =============================================================
Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor $green
Write-Host "║                   ✅ APLICACION EN EJECUCION              ║" -ForegroundColor $green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $green

Write-Host "`n📱 Abre en tu navegador: http://localhost:5173" -ForegroundColor $green
Write-Host "`n📊 Las terminales están arriba. Para detener: Ctrl+C en cada una" -ForegroundColor $yellow
Write-Host "`n💡 Tips:" -ForegroundColor $blue
Write-Host "   • Los cambios en src/ se refrescan automáticamente (Hot Reload)" -ForegroundColor $blue
Write-Host "   • Ver logs del servidor en terminal Backend" -ForegroundColor $blue
Write-Host "   • Ver logs del cliente en terminal Frontend" -ForegroundColor $blue

Write-Host "`n⏸️  Presiona Enter para cerrar (se mantendrán las terminales abiertas)..." -ForegroundColor $yellow
Read-Host ""

Write-Host "`n✋ Para terminar todo de una vez:" -ForegroundColor $yellow
Write-Host "   • Presiona Ctrl+C en cada terminal" -ForegroundColor $yellow
Write-Host "   • O cierra cada ventana manualmente`n" -ForegroundColor $yellow
