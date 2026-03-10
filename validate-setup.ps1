# =============================================================
# ✅ VALIDADOR DE CONFIGURACION LOCAL - Kareh PRO
# =============================================================
# Ejecutar: .\validate-setup.ps1
# Verifica que el proyecto está listo para desarrollo

Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║        ✅ VALIDADOR DE CONFIGURACION LOCAL                 ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$errors = @()
$warnings = @()
$success = @()

# =============================================================
# 1. VERIFICAR ARCHIVOS CRÍTICOS
# =============================================================
Write-Host "[1] Verificando estructura del proyecto..." -ForegroundColor Blue

$archivos = @(
    "package.json",
    "server\package.json",
    "server\prisma\schema.prisma",
    "client\package.json",
    "client\vite.config.js",
    "server\server.js"
)

foreach ($archivo in $archivos) {
    if (Test-Path $archivo) {
        $success += "✅ Existe: $archivo"
    } else {
        $errors += "❌ No existe: $archivo"
    }
}

# =============================================================
# 2. VERIFICAR .env
# =============================================================
Write-Host "`n[2] Verificando configuración (.env)..." -ForegroundColor Blue

$envFile = "server\.env"

if (Test-Path $envFile) {
    $success += "✅ Existe: $envFile"
    
    # Leer variables
    $envContent = Get-Content $envFile -Raw
    
    # GOOGLE_CLIENT_ID
    if ($envContent -match "GOOGLE_CLIENT_ID=\S+") {
        if ($envContent -match "GOOGLE_CLIENT_ID=tu_google") {
            $warnings += "⚠️  GOOGLE_CLIENT_ID aún es placeholder"
        } else {
            $success += "✅ GOOGLE_CLIENT_ID configurado"
        }
    } else {
        $errors += "❌ GOOGLE_CLIENT_ID no está en .env"
    }
    
    # GOOGLE_CLIENT_SECRET
    if ($envContent -match "GOOGLE_CLIENT_SECRET=\S+") {
        if ($envContent -match "GOOGLE_CLIENT_SECRET=tu_google") {
            $warnings += "⚠️  GOOGLE_CLIENT_SECRET aún es placeholder"
        } else {
            $success += "✅ GOOGLE_CLIENT_SECRET configurado"
        }
    } else {
        $errors += "❌ GOOGLE_CLIENT_SECRET no está en .env"
    }
    
    # JWT_SECRET
    if ($envContent -match "JWT_SECRET=\S+") {
        $jwtValue = $envContent -match "JWT_SECRET=(.+)" | Out-Null
        $jwtMatch = $envContent | Select-String "JWT_SECRET=(.+)"
        $jwtValue = $jwtMatch.Matches.Groups[1].Value.Trim()
        
        if ($jwtValue -like "*tu_jwt*") {
            $warnings += "⚠️  JWT_SECRET aún es placeholder"
        } elseif ($jwtValue.Length -lt 32) {
            $warnings += "⚠️  JWT_SECRET muy corto (mínimo 32 caracteres, actual: $($jwtValue.Length))"
        } else {
            $success += "✅ JWT_SECRET válido ($($jwtValue.Length) caracteres)"
        }
    } else {
        $errors += "❌ JWT_SECRET no está en .env"
    }
    
    # DATABASE_URL
    if ($envContent -match "DATABASE_URL=") {
        $dbMatch = $envContent | Select-String "DATABASE_URL=(.+)"
        $dbValue = $dbMatch.Matches.Groups[1].Value.Trim()
        
        if ($dbValue -match "localhost|127.0.0.1") {
            $success += "✅ DATABASE_URL parece ser local"
        } elseif ($dbValue -match "tu_contraseña|postgres://") {
            $warnings += "⚠️  DATABASE_URL podría no estar correctamente configurada"
        } else {
            $success += "✅ DATABASE_URL configurada"
        }
    } else {
        $errors += "❌ DATABASE_URL no está en .env"
    }
    
    # NODE_ENV
    if ($envContent -match "NODE_ENV=development") {
        $success += "✅ NODE_ENV = development (correcto para local)"
    } elseif ($envContent -match "NODE_ENV=") {
        $warnings += "⚠️  NODE_ENV no es 'development'"
    } elseif ($envContent -notmatch "NODE_ENV=") {
        $warnings += "⚠️  NODE_ENV no configurado (por defecto: production)"
    }
    
} else {
    $errors += "❌ No existe: $envFile"
    $warnings += "⚠️  Ejecuta primero: .\setup-local.ps1"
}

# =============================================================
# 3. VERIFICAR node_modules
# =============================================================
Write-Host "`n[3] Verificando dependencias instaladas..." -ForegroundColor Blue

$nodeModules = @(
    @{path = "node_modules"; name = "Root dependencies" },
    @{path = "server\node_modules"; name = "Server dependencies" },
    @{path = "client\node_modules"; name = "Client dependencies" }
)

foreach ($module in $nodeModules) {
    if (Test-Path $module.path) {
        $success += "✅ $($module.name) instaladas"
    } else {
        $warnings += "⚠️  $($module.name) NO instaladas - ejecuta: npm install"
    }
}

# =============================================================
# 4. VERIFICAR PUERTOS DISPONIBLES
# =============================================================
Write-Host "`n[4] Verificando puertos..." -ForegroundColor Blue

$puertos = @(
    @{puerto = 5000; nombre = "Backend (Express)" },
    @{puerto = 5173; nombre = "Frontend (Vite)" },
    @{puerto = 5432; nombre = "PostgreSQL" }
)

foreach ($puerto in $puertos) {
    $conexion = Test-NetConnection -ComputerName 127.0.0.1 -Port $puerto.puerto -WarningAction SilentlyContinue
    if ($conexion.TcpTestSucceeded) {
        $warnings += "⚠️  Puerto $($puerto.puerto) ($($puerto.nombre)) ya está en uso"
    } else {
        $success += "✅ Puerto $($puerto.puerto) ($($puerto.nombre)) disponible"
    }
}

# =============================================================
# 5. MOSTRAR RESULTADOS
# =============================================================
Write-Host "`n" + ("═" * 60) -ForegroundColor Cyan

if ($success.Count -gt 0) {
    Write-Host "`n✅ VALIDACIONES CORRECTAS:" -ForegroundColor Green
    foreach ($s in $success) {
        Write-Host "  $s"
    }
}

if ($warnings.Count -gt 0) {
    Write-Host "`n⚠️  ADVERTENCIAS:" -ForegroundColor Yellow
    foreach ($w in $warnings) {
        Write-Host "  $w"
    }
}

if ($errors.Count -gt 0) {
    Write-Host "`n❌ ERRORES - REQUIEREN ACCION:" -ForegroundColor Red
    foreach ($e in $errors) {
        Write-Host "  $e"
    }
    Write-Host "`n" 
    exit 1
}

# =============================================================
# 6. ESTADO FINAL
# =============================================================
Write-Host "`n" + ("═" * 60) -ForegroundColor Cyan

if ($errors.Count -eq 0 -and $warnings.Count -eq 0) {
    Write-Host "`n🎉 ¡LISTO PARA DESARROLLO LOCAL!`n" -ForegroundColor Green
    
    Write-Host "Próximos pasos:" -ForegroundColor Blue
    Write-Host "  1. Abre Terminal 1: cd server && npm run dev" -ForegroundColor Cyan
    Write-Host "  2. Abre Terminal 2: cd client && npm run dev" -ForegroundColor Cyan
    Write-Host "  3. Ve a: http://localhost:5173" -ForegroundColor Cyan
    
} elseif ($errors.Count -eq 0) {
    Write-Host "`n⚠️  CASI LISTO - Revisa las advertencias` -ForegroundColor Yellow
} else {
    Write-Host "`n❌ NO LISTO - Corrige los errores indicados arriba`n" -ForegroundColor Red
}

Write-Host "`nPara más información: Lee SETUP_LOCAL.md`n" -ForegroundColor Blue
