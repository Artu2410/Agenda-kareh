# Agenda Kareh

Sistema SaaS para la gestion clinica, agenda de turnos, pacientes, historias clinicas, caja y facturacion.

## Stack

- Frontend: React 19, Vite, Tailwind CSS, Vitest y React Testing Library.
- Backend: Node.js, Express, Prisma y PostgreSQL.
- Autenticacion: sesiones persistidas en PostgreSQL mediante Prisma Client.
- Base de datos: Neon PostgreSQL o PostgreSQL local.

## Requisitos

- Node.js 22.x.
- npm 10 o superior.
- PostgreSQL local o una URL valida de Neon.

## Instalacion

Desde la raiz del repositorio:

```bash
npm install
```

Copia `server/.env.example` a `server/.env` y completa los valores requeridos:

```dotenv
PORT=5000
NODE_ENV=development
JWT_SECRET=una-clave-local-de-al-menos-32-caracteres
DATABASE_URL="postgresql://usuario:password@host:5432/base?sslmode=require"
```

No subas `server/.env` ni credenciales de bases de datos al repositorio.

## Desarrollo local

Para iniciar frontend y backend juntos:

```bash
npm run dev
```

URLs locales:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

Tambien pueden iniciarse por separado:

```bash
npm run dev:client
npm run dev:server
```

## Prisma y base de datos

```bash
npm run prisma:generate --workspace server
npm run prisma:migrate:deploy --workspace server
```

Para crear una migracion durante el desarrollo:

```bash
npx prisma migrate dev --name nombre_del_cambio --schema server/prisma/schema.prisma
```

Verifica siempre `DATABASE_URL` antes de ejecutar migraciones. Una URL de Neon puede apuntar a datos reales.

## Pruebas y calidad

```bash
npm test
npm run test:client
npm run test:server
npm run lint --workspace client
npm run build
```

El backend usa Jest y Supertest. El frontend usa Vitest, JSDOM y React Testing Library.

## Arquitectura

```text
.
├── client/
│   └── src/
│       ├── features/       # Dominios y paginas principales
│       ├── shared/         # Layout y componentes compartidos
│       ├── components/     # Componentes de UI
│       ├── pages/          # Pantallas aun en migracion
│       └── services/       # HTTP, sesion y notificaciones
├── server/
│   ├── prisma/             # Schema y migraciones
│   ├── src/
│   │   ├── domain/         # Modulos por dominio
│   │   ├── controllers/    # Entrada HTTP y respuestas
│   │   ├── routes/         # Endpoints
│   │   ├── services/       # Logica transversal
│   │   └── middlewares/    # Seguridad y validacion
│   └── server.js           # Bootstrap de Express
└── scripts/dev.mjs         # Orquestador local
```

Dominios principales: autenticacion, agenda, pacientes, facturacion, caja, metricas y auditoria.

## Funcionalidades

- Agenda semanal y mensual con disponibilidad por profesional.
- Contadores de turnos, asistencias, inasistencias y pacientes unicos.
- Gestion de pacientes e historias clinicas.
- Documentacion de pacientes, incluida Credencial CUD.
- Numeracion secuencial de historias clinicas por fecha de alta.
- Caja con preservacion de fecha original al editar movimientos.
- Facturacion, metricas, auditoria y control de acceso por roles.

## Seguridad y datos

- Las sesiones se almacenan en PostgreSQL mediante Prisma.
- Las peticiones mutables requieren proteccion CSRF.
- Los endpoints administrativos aplican control de roles.
- No se deben registrar tokens, contrasenas o cadenas de conexion.

## Flujo recomendado

1. Configura `server/.env`.
2. Genera Prisma y verifica la conexion a la base.
3. Ejecuta `npm run dev`.
4. Ejecuta las pruebas, lint y build antes de publicar cambios.
