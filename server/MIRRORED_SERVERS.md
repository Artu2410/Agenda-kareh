# Servidores espejo locales

## Archivos

Cada PC ejecuta el backend con su propio `UPLOADS_DIR` local. Syncthing replica esa carpeta entre las dos PCs; la aplicación no debe escribir directamente en una carpeta remota.

Para recuperar temporalmente los archivos existentes en `Backup_AWS_Kareh`, el `.env` local puede apuntar a `../Backup_AWS_Kareh/kareh-uploads` cuando el proceso se inicia con `server/` como directorio de trabajo. No se debe subir ese directorio al repositorio.

Configurar en cada máquina:

```dotenv
UPLOADS_DIR=./uploads
PUBLIC_SERVER_URL=http://<tailscale-ip-de-esta-pc>:5000
```

`PUBLIC_SERVER_URL` debe apuntar a la PC que atiende la solicitud. Las claves guardadas en PostgreSQL son relativas, por ejemplo `/uploads/clinical-history/<patient-id>/<file>`, por lo que no contienen dominios ni IPs.

Recomendaciones para Syncthing:

- Compartir solamente `uploads/` entre las dos PCs.
- Mantener el mismo path lógico y permisos de lectura/escritura para el usuario del proceso Node.
- No sincronizar `.env`, `node_modules`, `logs` ni la carpeta `prisma`.
- Usar versionado de archivos en Syncthing para recuperar eliminaciones o conflictos.
- Evitar editar o eliminar manualmente archivos mientras una carga está en curso.

## PostgreSQL

No ejecutar dos PostgreSQL independientes como primarios con la misma base. Eso produce conflictos de escritura y no es una réplica segura.

Opciones recomendadas, de menor a mayor complejidad:

1. Usar una única base PostgreSQL administrada o un servidor PostgreSQL central accesible por Tailscale desde ambas PCs. Ambas instancias del backend usan el mismo `DATABASE_URL`.
2. Para alta disponibilidad real, usar replicación física PostgreSQL primaria-en-espera con un único primario, WAL archiving, `repmgr` o Patroni, y un endpoint de failover. La aplicación debe cambiar a ese endpoint, no alternar URLs manualmente.
3. Para una contingencia simple, mantener backups automáticos y probar restauraciones. No usar exportaciones periódicas como si fueran replicación en tiempo real.

Las migraciones Prisma deben ejecutarse una sola vez contra el primario:

```bash
npm run prisma:migrate:deploy --workspace server
```

Antes de desplegar cada PC, verificar que `DATABASE_URL` apunta al mismo primario y que el esquema está actualizado. Syncthing replica archivos, no datos transaccionales de PostgreSQL.
