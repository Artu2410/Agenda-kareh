# ⚡ QUICK START - Desarrollo Local en 5 minutos

> **Versión corta** de [SETUP_LOCAL.md](./SETUP_LOCAL.md). Lee eso si necesitas más detalles.

## 📋 Requisitos Previos

- ✅ Node.js v24+ → [Descargar](https://nodejs.org/)
- ✅ PostgreSQL instalado y ejecutándose → [Descargar](https://www.postgresql.org/download/)
- ✅ El proyecto ya clonado en `d:\kareh-pro\Agenda-kareh`

---

## 🚀 En 4 Pasos

### Paso 1️⃣: Preparar Base de Datos (2 min)

Abre **pgAdmin** o **psql** y ejecuta:

```sql
CREATE DATABASE kareh_db;
CREATE USER kareh_user WITH PASSWORD 'contraseña123';
GRANT ALL PRIVILEGES ON DATABASE kareh_db TO kareh_user;
```

> 💾 Guarda: usuario `kareh_user`, contraseña `contraseña123`

---

### Paso 2️⃣: Instalar Todo (3 min)

Abre **PowerShell** en la raíz del proyecto:

```powershell
# Ejecuta este script
.\setup-local.ps1
```

> Esto instala todas las dependencias automáticamente

---

### Paso 3️⃣: Configurar Variables de Entorno (1 min)

Abre `server\.env` y completa:

```env
GOOGLE_CLIENT_ID=abc123def456
GOOGLE_CLIENT_SECRET=xyz789klm012
JWT_SECRET=esta_es_una_clave_super_larga_de_al_menos_32_caracteres_1234567890
DATABASE_URL=postgresql://kareh_user:contraseña123@localhost:5432/kareh_db
AUTHORIZED_EMAIL=tu_email@gmail.com
PORT=5000
NODE_ENV=development
```

> ⚠️ **Obtén `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`** de:
> [Google Cloud Console](https://console.cloud.google.com) → Credenciales

---

### Paso 4️⃣: Sincronizar Base de Datos (1 min)

Abre PowerShell en la carpeta `server/`:

```powershell
cd server
npx prisma migrate deploy
# O si es primera vez:
# npx prisma db push
```

> Esto crea las tablas en tu base de datos local

---

## ▶️ Ejecutar la App

Abre **2 terminales PowerShell** en la raíz del proyecto:

**Terminal 1 - Backend:**
```powershell
cd server
npm run dev
```

Deberías ver: `✅ Servidor en puerto 5000`

**Terminal 2 - Frontend:**
```powershell
cd client
npm run dev
```

Deberías ver: `✅ Local: http://localhost:5173`

---

## ✅ Listo

Abre tu navegador:

```
http://localhost:5173
```

🎉 **¡Usa la aplicación localmente!**

---

## 🔍 Validar Configuración

Si hay problemas, ejecuta este validador:

```powershell
.\validate-setup.ps1
```

Esto verifica si todo está correcto.

---

## 📝 Comandos Útiles

| Comando | Qué hace |
|---------|----------|
| `npm install` (en cada carpeta) | Instala dependencias |
| `npx prisma migrate dev` | Crea nueva migración de BD |
| `npx prisma studio` | Abre interfaz visual de BD |
| `npm run build` (en client) | Compila para producción |
| `npm run lint` (en client) | Verifica código |

---

## ⚠️ Soluciones Rápidas

| Problema | Solución |
|----------|----------|
| ❌ `Port 5000 already in use` | Cambia `PORT=5001` en `.env` |
| ❌ `Cannot find database` | Verifica `DATABASE_URL` en `.env` |
| ❌ `CORS error` | Espera, la configuración ya está lista |
| ❌ `Module not found` | Ejecuta `npm install` en esa carpeta |

---

## 🚀 Trabajar Diariamente

Cada día que trabajes:

```powershell
# Opción 1: Manual (dos terminales)
cd server && npm run dev        # Terminal 1
cd client && npm run dev        # Terminal 2

# Opción 2: Automático (una línea)
.\start-dev.ps1
```

---

## 📤 Subir a GitHub

Tus cambios locales **no afectarán** el despliegue:

```powershell
git add .
git commit -m "Tu mensaje"
git push origin main
```

✅ Vercel actualizará automáticamente

---

## 📚 Más Detalles

- [SETUP_LOCAL.md](./SETUP_LOCAL.md) - Guía completa
- [Prisma Docs](https://www.prisma.io/docs/)
- [Express Docs](https://expressjs.com/)
- [React Docs](https://react.dev/)

---

**¿Necesitas ayuda?** Revisa [SETUP_LOCAL.md](./SETUP_LOCAL.md) o ejecuta `.\validate-setup.ps1`
