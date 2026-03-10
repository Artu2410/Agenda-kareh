# =============================================================
# 🚀 SETUP LOCAL AUTOMÁTICO - Kareh PRO
# =============================================================
# Ejecutar: .\setup-local.ps1
# Requisitos: Node.js, PostgreSQL, Git

Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║        🏥 KAREH PRO - CONFIGURACION LOCAL                  ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Colores
$green = "Green"
$red = "Red"
$yellow = "Yellow"
$blue = "Cyan"

# =============================================================
# 1️⃣ VERIFICAR REQUISITOS
# =============================================================
Write-Host "`n[1/5] ✓ Verificando requisitos..." -ForegroundColor $blue

$requisitos = @{
    "Node.js" = "node --version"
    "npm" = "npm --version"
    "git" = "git --version"
}

$prereqOk = $true
foreach ($req in $requisitos.Keys) {
    try {
        $output = & $requisitos[$req] 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ ${req}: $output" -ForegroundColor $green
        } else {
            Write-Host "  ❌ ${req}: No encontrado" -ForegroundColor $red
            $prereqOk = $false
        }
    } catch {
        Write-Host "  ❌ ${req}: No encontrado" -ForegroundColor $red
        $prereqOk = $false
    }
}

if (-not $prereqOk) {
    Write-Host "`n⚠️  Por favor, instala los requisitos faltantes:" -ForegroundColor $yellow
    Write-Host "   • Node.js desde https://nodejs.org/" -ForegroundColor $yellow
    Write-Host "   • PostgreSQL desde https://www.postgresql.org/download/" -ForegroundColor $yellow
    exit 1
}

# =============================================================
# 2️⃣ CREAR ARCHIVO .env
# =============================================================
Write-Host "`n[2/5] 📝 Configurando archivo .env..." -ForegroundColor $blue

$serverEnv = "server\.env"

if (Test-Path $serverEnv) {
    Write-Host "  ⚠️  $serverEnv ya existe. Se preservará." -ForegroundColor $yellow
} else {
    if (Test-Path "server\.env.example") {
        Copy-Item "server\.env.example" $serverEnv
        Write-Host "  ✅ Creado: $serverEnv (basado en .env.example)" -ForegroundColor $green
        
        Write-Host "`n  ⚠️  IMPORTANTE - Edita 'server\.env' y completa:" -ForegroundColor $yellow
        Write-Host "     • GOOGLE_CLIENT_ID" -ForegroundColor $yellow
        Write-Host "     • GOOGLE_CLIENT_SECRET" -ForegroundColor $yellow
        Write-Host "     • JWT_SECRET (genera aleatoria, +32 caracteres)" -ForegroundColor $yellow
        Write-Host "     • DATABASE_URL (tu PostgreSQL local)" -ForegroundColor $yellow
        Write-Host "     • AUTHORIZED_EMAIL" -ForegroundColor $yellow
    } else {
        Write-Host "  ❌ No se encontró server\.env.example" -ForegroundColor $red
    }
}

# =============================================================
# 3️⃣ INSTALAR DEPENDENCIAS
# =============================================================
Write-Host "`n[3/5] 📦 Instalando dependencias..." -ForegroundColor $blue

$dirs = @(".", "server", "client")

foreach ($dir in $dirs) {
    Write-Host "`n  📂 $dir/" -ForegroundColor $blue
    
    if (Test-Path "$dir\package.json") {
        Push-Location $dir
        
        Write-Host "    Instalando npm packages..." -NoNewline
        npm install 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host " ✅" -ForegroundColor $green
        } else {
            Write-Host " ❌" -ForegroundColor $red
        }
        
        Pop-Location
    } else {
        Write-Host "    ⚠️  No existe package.json" -ForegroundColor $yellow
    }
}

# =============================================================
# 4️⃣ GENERAR Y SINCRONIZAR PRISMA
# =============================================================
Write-Host "`n[4/5] 🗄️  Configurando base de datos..." -ForegroundColor $blue

if (Test-Path "server\prisma\schema.prisma") {
    Push-Location "server"
    
    Write-Host "  Generando cliente Prisma..." -NoNewline
    npx prisma generate 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " ✅" -ForegroundColor $green
    } else {
        Write-Host " ⚠️  (Verifica DATABASE_URL)" -ForegroundColor $yellow
    }
    
    Write-Host "  Nota: Para sincronizar BD, ejecuta manualmente:" -ForegroundColor $blue
    Write-Host "    cd server" -ForegroundColor $blue
    Write-Host "    npx prisma migrate deploy" -ForegroundColor $blue
    
    Pop-Location
} else {
    Write-Host "  ⚠️  schema.prisma no encontrado" -ForegroundColor $yellow
}

# =============================================================
# 5️⃣ MOSTRAR PASOS SIGUIENTES
# =============================================================
Write-Host "`n[5/5] 🎯 Próximos pasos..." -ForegroundColor $blue

Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor $green
Write-Host "║               ✅ CONFIGURACION COMPLETADA                 ║" -ForegroundColor $green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $green

Write-Host "`n📝 ANTES DE CONTINUAR - Edita 'server\.env':" -ForegroundColor $yellow
Write-Host "   1. Abre: server\.env" -ForegroundColor $white
Write-Host "   2. Completa: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET" -ForegroundColor $white
Write-Host "   3. Establece DATABASE_URL correctamente" -ForegroundColor $white

Write-Host "`n🗄️  PARA SINCRONIZAR BASE DE DATOS:" -ForegroundColor $blue
Write-Host "   1. Abre PowerShell en 'server/'" -ForegroundColor $white
Write-Host "   2. Ejecuta: npx prisma migrate deploy" -ForegroundColor $cyan
Write-Host "   (O si es primera vez: npx prisma db push)" -ForegroundColor $cyan

Write-Host "`n🚀 PARA INICIAR EN DESARROLLO - Abre 2 terminales:" -ForegroundColor $green

Write-Host "`n   Terminal 1 (Backend):" -ForegroundColor $blue
Write-Host "   $ cd server" -ForegroundColor $cyan
Write-Host "   $ npm run dev" -ForegroundColor $cyan

Write-Host "`n   Terminal 2 (Frontend):" -ForegroundColor $blue
Write-Host "   $ cd client" -ForegroundColor $cyan
Write-Host "   $ npm run dev" -ForegroundColor $cyan

Write-Host "`n   Luego abre: http://localhost:5173" -ForegroundColor $green

Write-Host "`n📖 Para más detalles, lee: SETUP_LOCAL.md`n" -ForegroundColor $blue

Write-Host "⚠️  Nota: '.env' está en .gitignore y nunca se subirá a GitHub`n" -ForegroundColor $yellow
