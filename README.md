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
cp .env.example .env
# Update the .env file with your database credentials and other settings.
npx prisma migrate dev
npm run dev
```

The backend will be running on `http://localhost:5000`.

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
-   `npm run prisma:generate`: Generates Prisma client using the backend-local Prisma version.
-   `npm run prisma:migrate:deploy`: Applies pending migrations using the backend-local Prisma version.
-   `npm run prisma:migrate:status`: Shows migration status using the backend-local Prisma version.

### Prisma migrations from repo root

If you are standing at the repository root, do not run plain `npx prisma ...` because npm can download the latest Prisma CLI and ignore the backend version pinned in `/server`.

Use these commands instead:

```bash
npm run server:prisma:generate
npm run server:prisma:deploy
npm run server:prisma:status
```

These commands run Prisma from `/server`, which is currently pinned to `5.22.0`.

### Render + Neon

If you deploy the backend on Render and your Neon `DATABASE_URL` points to a host containing `-pooler`, keep that URL for the running app but also define `DIRECT_URL` with the direct Neon host (without `-pooler`).

Prisma Migrate should use `DIRECT_URL`, while the app can continue using `DATABASE_URL`.

### Client (`/client`)

-   `npm run dev`: Starts the client in development mode.
-   `npm run build`: Builds the client for production.
-   `npm run preview`: Previews the production build locally.
