# 🚀 Guía de Configuración para Desarrollo Local

> **Importante**: Esta guía permite trabajar localmente sin afectar el despliegue en Vercel

## 📋 Prerrequisitos

- **Node.js** v24.12.0 o superior ([descargar](https://nodejs.org/))
- **PostgreSQL** instalado localmente ([descargar](https://www.postgresql.org/download/))
- **Git** configurado
- Un editor de código (VS Code recomendado)

---

## 1️⃣ Configurar Base de Datos Local

### Paso 1: Crear base de datos en PostgreSQL

Abre PostgreSQL (pgAdmin o terminal) y ejecuta:

```sql
CREATE DATABASE kareh_db;
CREATE USER kareh_user WITH PASSWORD 'tu_contraseña_fuerte';
ALTER ROLE kareh_user SET client_encoding TO 'utf8';
ALTER ROLE kareh_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE kareh_user SET default_transaction_deferrable TO on;
ALTER ROLE kareh_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE kareh_db TO kareh_user;
```

> 💡 **Nota**: Recuerda la contraseña que uses, la necesitarás en el paso siguiente

---

## 2️⃣ Configurar Variables de Entorno (Server)

### Paso 1: Crear archivo `.env` en `server/`

```bash
cd server
# Copia el archivo de ejemplo
cp .env.example .env
```

### Paso 2: Editar el archivo `server/.env`

Abre `server/.env` y completa estos campos:

```env
# 🔑 GOOGLE OAUTH 2.0
# Instrucciones en: https://console.cloud.google.com
GOOGLE_CLIENT_ID=tu_google_client_id_aqui
GOOGLE_CLIENT_SECRET=tu_google_client_secret_aqui

# 🔐 JWT Secret (genera una cadena aleatoria de +32 caracteres)
JWT_SECRET=tu_jwt_secret_super_seguro_aqui_min_32_caracteres_generado_aleatoriamente

# 💾 BASE DE DATOS LOCAL
DATABASE_URL="postgresql://kareh_user:tu_contraseña_fuerte@localhost:5432/kareh_db"

# 📧 EMAIL AUTORIZADO
AUTHORIZED_EMAIL=tu_email@gmail.com

# ⚙️ CONFIGURACIÓN LOCAL
PORT=5000
NODE_ENV=development
```

> ⚠️ **Importante**: No subas este archivo a GitHub. Está en `.gitignore`

---

## 3️⃣ Instalar Dependencias

### Paso 1: Raíz del proyecto
```bash
cd d:\kareh-pro\Agenda-kareh
npm install
```

### Paso 2: Backend (Server)
```bash
cd server
npm install
npx prisma generate
```

### Paso 3: Frontend (Client)
```bash
cd ../client
npm install
```

---

## 4️⃣ Sincronizar Base de Datos con Prisma

```bash
cd server

# Opción A: Si es la primera vez (crea todo)
npx prisma migrate deploy

# Opción B: Si deseas ver cambios en tiempo real
npx prisma db push
```

> ✅ Esto sincronizará el schema de `prisma/schema.prisma` con tu base de datos local

---

## 5️⃣ Iniciar el Proyecto en Desarrollo Local

Abre **dos terminales** (PowerShell o WSL):

### Terminal 1: Backend
```bash
cd d:\kareh-pro\Agenda-kareh\server
npm run dev
```

**Deberías ver**: 
```
    ▶ Servidor ejecutándose en puerto 5000
    📡 GET /api/health
```

### Terminal 2: Frontend
```bash
cd d:\kareh-pro\Agenda-kareh\client
npm run dev
```

**Deberías ver**:
```
    ➜  Local:   http://localhost:5173/
    ➜  Press q to quit
```

---

## 6️⃣ Acceder a la Aplicación Local

Abre tu navegador y ve a:
```
http://localhost:5173
```

✅ **¡Listo!** Tu aplicación está corriendo localmente

---

## 📱 Configurar Google OAuth para Local

Para que el login funcione en local, necesitas agregar URLs de Google Cloud Console:

### En Google Cloud Console (`console.cloud.google.com`):

1. Ve a **Credenciales** → Tu proyecto
2. Busca tu **OAuth 2.0 ID de Cliente**
3. Haz clic en **Editar**
4. En **Orígenes de JavaScript autorizados** agrega:
   ```
   http://localhost:5173
   http://localhost:5000
   ```
5. En **URIs de redirección autorizados** agrega:
   ```
   http://localhost:5000/api/auth/callback
   http://localhost:5173/auth/callback
   ```
6. Haz clic en **Guardar**

> 💡 **Nota**: El servidor ya tiene CORS configurado para `localhost:5173`, así que todo funcionará

---

## 🐛 Solucionar Problemas Comunes

### ❌ "Error: connect ECONNREFUSED 127.0.0.1:5432"
**Causas posibles:**
- PostgreSQL no está en ejecución
- La contraseña en `DATABASE_URL` es incorrecta
- El usuario `kareh_user` no fue creado

**Solución:**
```bash
# En Windows
# Busca PostgreSQL en Servicios y verifica que esté iniciado
# O reinicia: net start postgresql-x64-16
```

### ❌ "CORS error" en navegador
**Solución:**
- Abre DevTools (F12)
- La URL del servidor debe ser `http://localhost:5000`
- En `server.js` ya está permitido `http://localhost:5173`

### ❌ "npm: command not found"
**Solución:**
- Instala Node.js desde [nodejs.org](https://nodejs.org/)
- Reinicia PowerShell o CMD
- Verifica: `node --version` y `npm --version`

### ❌ Base de datos sin tablas
**Solución:**
```bash
cd server
npx prisma migrate deploy
```

---

## 🔄 Flujo de Trabajo Diario

Cada vez que trabajes localmente:

```bash
# 1. Abre terminal en server/
cd server
npm run dev

# 2. Abre otra terminal en client/
cd client
npm run dev

# 3. Accede a http://localhost:5173

# 4. Para detener: Presiona Ctrl+C en cada terminal
```

---

## 📤 Push a GitHub sin afectar despliegue

### Lo que **SÍ** debes hacer:
```bash
git add .
git commit -m "Tu mensaje de cambios"
git push origin main
```

### Lo que **NO** subirás (están en `.gitignore`):
- `server/.env` ← Variables locales
- `node_modules/` ← Se instalan del `package.json`
- `.DS_Store` ← Archivos del sistema

### Vercel actualizará automáticamente cuando hagas push a `main`

---

## 🚀 Desplegar a Producción (Vercel)

Cuando esté todo listo:

1. Push a GitHub: `git push origin main`
2. Vercel reconstruye automáticamente
3. **No olvides** configurar las variables de entorno en Vercel:
   - Dashboard de Vercel → Settings → Environment Variables
   - Agrega: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `DATABASE_URL` (URL de producción)

---

## ✅ Checklist Final

- [ ] PostgreSQL instalado y ejecutándose
- [ ] `server/.env` creado con todas las variables
- [ ] `npm install` ejecutado en root, server/ y client/
- [ ] `npx prisma migrate deploy` ejecutado
- [ ] Terminal 1: `npm run dev` en `server/`
- [ ] Terminal 2: `npm run dev` en `client/`
- [ ] Navegador abierto en `http://localhost:5173`
- [ ] Login con Google funciona

---

## 📚 Documentación Útil

- [Prisma ORM](https://www.prisma.io/docs/)
- [Express.js](https://expressjs.com/)
- [React Docs](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [PostgreSQL](https://www.postgresql.org/docs/)

---

**¡Listo para desarrollar localmente!** 🎉
