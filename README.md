# Kareh-Pro

Kareh-Pro is a web application for managing patient appointments and clinical histories.

## Project Structure

The project is a monorepo with two main parts:

-   `/client`: A React frontend application.
-   `/server`: A Node.js (Express) backend API.

## Tech Stack

-   **Frontend:** React, Vite, Tailwind CSS
-   **Backend:** Node.js, Express, Prisma
-   **Database:** PostgreSQL

## Prerequisites

-   Node.js (v18 or later recommended)
-   npm
-   PostgreSQL

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd kareh-pro
```

### 2. Setup the Backend

```bash
cd server
npm install
copy .env.example .env
# Update the .env file with your database credentials and other settings.
npx prisma migrate dev
npm run dev
```

The backend will be running on `http://localhost:5000`.

Before logging in, configure at least one bootstrap user with `AUTHORIZED_EMAIL` or `AUTH_BOOTSTRAP_USERS` in `server/.env`.

### 3. Setup the Frontend

```bash
cd client
npm install
npm run dev
```

The frontend will be running on `http://localhost:5173`.

## Available Scripts

### Server (`/server`)

-   `npm run dev`: Starts the server in development mode.
-   `npm start`: Starts the server in production mode.
-   `npm run prisma:generate`: Regenerates the Prisma client.
-   `npm run prisma:migrate:deploy`: Applies pending Prisma migrations.
-   `npm run check:auth`: Validates auth and OTP environment settings.
-   `npm run check:db`: Verifies database connectivity and core tables.
-   `npm run check:whatsapp`: Verifies WhatsApp integration environment variables.

### Client (`/client`)

-   `npm run dev`: Starts the client in development mode.
-   `npm run build`: Builds the client for production.
-   `npm run preview`: Previews the production build locally.

## Ops Runbooks

-   Staging: [ops/STAGING_RUNBOOK.md](/d:/Agenda-kareh/ops/STAGING_RUNBOOK.md:1)
-   Manual QA: [ops/MANUAL_QA_CHECKLIST.md](/d:/Agenda-kareh/ops/MANUAL_QA_CHECKLIST.md:1)
-   Backups and restore: [ops/BACKUP_RESTORE_RUNBOOK.md](/d:/Agenda-kareh/ops/BACKUP_RESTORE_RUNBOOK.md:1)
-   Release readiness: [ops/RELEASE_READINESS.md](/d:/Agenda-kareh/ops/RELEASE_READINESS.md:1)
