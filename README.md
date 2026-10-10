# Qsmart Clinic
   
Qsmart Clinic is a digital clinic queue and appointment management application built with Node.js, Express, and SQLite. It supports patient self-service booking and staff-side queue management from a browser-based interface.

## Overview

The application allows:

- Patients to sign up, log in, and book appointments
- Staff users to manage token queues, call the next patient, and complete appointments
- Secure session-based authentication using SQLite-backed user records
- Queue tracking by doctor, date, and token number
- Operational health checks for deployment environments

## Key Features

- Secure user registration and login
- Patient and staff role separation
- Server-side session management using HTTP-only cookies
- Appointment creation and current-appointment lookup
- Queue waiting list and completed history views
- Staff-only token actions for calling and completing patients
- Production-ready security middleware (Helmet, CORS, rate limiting, compression)
- SQLite persistence with WAL mode for reliability

## Tech Stack

- Node.js 18+
- Express.js
- SQLite + better-sqlite3
- bcryptjs for password hashing
- dotenv for environment configuration
- Helmet, CORS, rate-limit, compression, cookie-parser

## Project Structure

```text
.
├── .env.example            # Example environment configuration
├── deploy/                 # Service and reverse-proxy deployment files
├── public/                 # Static frontend assets
├── scripts/
│   └── create-staff.js     # Creates the first staff account
├── server/
│   ├── database.js         # SQLite schema and queue logic
│   ├── middleware.js       # Auth/role middleware
│   └── server.js           # Express app and API routes
├── test/                   # Automated tests
├── package.json            # Scripts and dependencies
├── README.md               # Project documentation
└── .gitignore
```

## Prerequisites

Before running the project, make sure you have:

- Node.js 18 or newer
- npm
- A writable filesystem for the SQLite database

## Environment Configuration

Copy the example environment file before running locally:

```bash
cp .env.example .env
```

The default configuration includes:

- `NODE_ENV` - application environment
- `PORT` - server port, default `3000`
- `ALLOWED_ORIGIN` - CORS origin for browser requests
- `QSMART_DB_PATH` - optional custom SQLite database path

Example values:

```bash
NODE_ENV=development
PORT=3000
ALLOWED_ORIGIN=http://localhost:3000
QSMART_DB_PATH=data/qsmart.sqlite
```

## Installation

Install dependencies:

```bash
npm install
```

## Running the Application

Start the app:

```bash
npm start
```

For local development mode:

```bash
npm run dev
```

The app will be available at:

- http://localhost:3000

## Create the First Staff Account

Create an initial staff user interactively:

```bash
npm run create-staff
```

This command:

- prompts for the staff name, email, phone, and password
- validates the input
- hashes the password with `bcryptjs`
- creates the account in SQLite
- does not store plain-text passwords in source files

## Authentication and Roles

The app uses SQLite-backed users and server-side sessions.

- Users are stored in `data/qsmart.sqlite` by default
- Passwords are hashed using `bcryptjs`
- Sessions are stored in the database and associated with an HTTP-only cookie
- Supported roles:
  - `patient`
  - `staff`
- Staff-only actions are validated on the server with middleware

## Main API Routes

### Authentication

- `POST /auth/signup` - Register a new patient or staff account
- `POST /auth/login` - Log in with email and password
- `POST /auth/logout` - End the active user session
- `GET /api/me` - Get current session information

### Patient Features

- `GET /api/appointments/current` - Get the current active appointment for the logged-in patient
- `POST /api/appointments` - Create a patient appointment

### Staff Features

- `GET /api/queue/waiting` - Get waiting appointments for a doctor
- `GET /api/queue/history` - Get completed appointments for the current day
- `POST /api/queue/call-next` - Call the next patient in queue
- `POST /api/queue/call-specific` - Call a specific token number
- `POST /api/queue/complete` - Mark a called patient as completed

### Health Check

- `GET /healthz` - Returns application health status for load balancers or deployment checks

## Database

The app uses SQLite with the following primary tables:

- `users` - user account information and role assignment
- `sessions` - active login sessions with expiry timestamps
- `appointments` - appointment, token, queue, and completion metadata

The database file is created automatically if it does not exist.

## Deployment

Deployment scaffolding is included in the `deploy/` folder:

- `deploy/DEPLOY.md` - production deployment instructions
- `deploy/qsmart-clinic.service` - systemd service unit
- `deploy/nginx.conf` - reverse proxy configuration

Production guidance:

- Run Node.js in a production environment
- Set secure values for `NODE_ENV` and `ALLOWED_ORIGIN`
- Ensure the database directory is writable by the app service user
- Use secure secrets management rather than committing `.env` files

## Security Notes

This project includes basic protections such as:

- `helmet` for HTTP response protection
- CORS restrictions
- rate limiting on auth and API endpoints
- bcrypt password hashing
- server-side role checks for staff actions

For production deployment, also ensure:

- HTTPS is enabled in front of the app
- `ALLOWED_ORIGIN` is restricted to the correct domain
- database files and session-related data are backed up regularly

## Common Commands

```bash
npm install
npm start
npm run dev
npm run create-staff
npm test
```

## Notes

The frontend remains browser-based and is served from the `public/` directory. The backend is responsible for authentication, queue logic, appointments, and user authorization.

If you want, I can also help you turn this into a more polished README with badges, screenshots, usage examples, and a deployment checklist.
