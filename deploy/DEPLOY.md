# Deploying Qsmart Clinic

Install Node.js 18 or newer on the server, copy the project, and install production dependencies:

```bash
npm ci --omit=dev
```

Set `NODE_ENV=production`, configure `ALLOWED_ORIGIN`, and optionally set `QSMART_DB_PATH` in the service environment. The SQLite database directory must be writable by the service user and included in the backup plan.

Create the first staff account on the server with:

```bash
npm run create-staff
```

The command accepts credentials interactively and hashes the password before writing the account. Do not place staff passwords in source files or service configuration.

The included `qsmart-clinic.service` runs the Node server. The included Nginx configuration reverse-proxies HTTPS traffic to the local Node port.
