# Qsmart Clinic

Qsmart Clinic is an Express-based digital token application. The existing patient appointment, token, waiting hall, and staff queue UI remains browser-based. Authentication uses SQLite users and server-side sessions.

## Authentication

- Users are stored in SQLite at `data/qsmart.sqlite` by default.
- Passwords are hashed with `bcryptjs`.
- Sessions are stored server-side and identified by the HTTP-only `clinic_session` cookie.
- Users have either the `patient` or `staff` role.
- Staff queue actions require a server-side staff role check.

## Run locally

```bash
npm install
npm start
```

Create the first staff account interactively:

```bash
npm run create-staff
```

The command prompts for the staff credentials and never stores a password in source code. Copy `.env.example` to `.env` when environment-specific settings are needed.

## Routes

- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /api/me`

Deployment files remain in `deploy/` for the Node service and reverse proxy.
