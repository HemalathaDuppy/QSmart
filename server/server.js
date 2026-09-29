"use strict";

require("dotenv").config();

const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const { attachUser, requirePatient, requireStaff, SESSION_COOKIE } = require("./middleware");
const {
  findUserByEmail,
  insertUser,
  insertSession,
  deleteSession,
  findCurrentAppointment,
  createAppointment,
  getNextTokenNumber,
  findWaitingAppointments,
  findTodayHistory,
  callNextAppointment,
  callSpecificAppointment,
  completeAppointment
} = require("./database");

const app = express();

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || APP_BASE_URL;

// Running behind Nginx/ALB on EC2 — needed for correct client IPs,
// secure cookies, and rate limiting to work.
app.set("trust proxy", 1);

/* ============================================================
   SECURITY MIDDLEWARE
   ============================================================ */

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Google Fonts, used by index.html
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: IS_PRODUCTION ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "10kb" }));
app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    credentials: true
  })
);

app.use(
  morgan(IS_PRODUCTION ? "combined" : "dev", {
    skip: (req) => req.path === "/healthz"
  })
);

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false
});

// Tighter limit on auth endpoints specifically
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
});

app.use("/api", apiLimiter);
app.use("/auth", authLimiter);

/* ============================================================
   HEALTH CHECK (for EC2 / load balancer)
   ============================================================ */

app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

/* ============================================================
   AUTH ROUTES (SQLite users and server-side sessions)
   ============================================================ */

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: "lax",
  maxAge: SESSION_MAX_AGE_SECONDS * 1000
};

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function validateSignup(body) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = normalizeEmail(body.email);
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword =
    typeof body.confirmPassword === "string" ? body.confirmPassword : "";
  const role = body.role === "staff" ? "staff" : body.role === "patient" ? "patient" : "";

  if (!name || name.length > 100) return { error: "A valid name is required" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "A valid email is required" };
  }
  if (!/^[0-9+()\-\s]{7,20}$/.test(phone)) {
    return { error: "A valid phone number is required" };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match" };
  }
  if (!role) return { error: "Role must be patient or staff" };

  return { name, email, phone, password, role };
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isStaff: user.role === "staff"
  };
}

function setSessionCookie(res, user) {
  const sessionId = crypto.randomBytes(32).toString("hex");
  insertSession(sessionId, user.id, SESSION_MAX_AGE_SECONDS);
  res.cookie(SESSION_COOKIE, sessionId, SESSION_COOKIE_OPTIONS);
}

app.post("/auth/signup", async (req, res) => {
  const signup = validateSignup(req.body || {});
  if (signup.error) return res.status(400).json({ error: signup.error });

  if (findUserByEmail(signup.email)) {
    return res.status(409).json({ error: "An account with that email already exists" });
  }

  try {
    const passwordHash = await bcrypt.hash(signup.password, 12);
    const user = insertUser({ ...signup, passwordHash });
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "An account with that email already exists" });
    }
    throw err;
  }
});

app.post("/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body && req.body.email);
  const password = req.body && req.body.password;
  const user = findUserByEmail(email);

  if (!user || typeof password !== "string" || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  setSessionCookie(res, user);
  res.json({ user: publicUser(user) });
});

app.post("/auth/logout", (req, res) => {
  deleteSession(req.cookies ? req.cookies[SESSION_COOKIE] : null);
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax"
  });
  res.json({ ok: true });
});

/* ============================================================
   API ROUTES
   ============================================================ */

app.use(attachUser);

// Public: lets the frontend know if a session is active.
app.get("/api/me", (req, res) => {
  if (!req.user) {
    return res.json({ authenticated: false, isStaff: false, role: null, name: null, user: null });
  }
  res.json({
    authenticated: true,
    isStaff: req.user.role === "staff",
    role: req.user.role,
    name: req.user.name,
    user: req.user
  });
});

const appointmentDoctors = {
  doctor1: { name: "Dr. Sarah Jenkins", prefix: "A" },
  doctor2: { name: "Dr. Alan Miller", prefix: "B" },
  doctor3: { name: "Dr. Priya Patel", prefix: "C" }
};

const appointmentTimes = new Set([
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
  "05:00 PM"
]);

app.get("/api/appointments/current", requirePatient, (req, res) => {
  res.json({ appointment: findCurrentAppointment(req.user.id) });
});

app.post("/api/appointments", requirePatient, (req, res) => {
  const doctor = appointmentDoctors[req.body && req.body.doctorId];
  const appointmentDate = req.body && req.body.appointmentDate;
  const appointmentTime = req.body && req.body.appointmentTime;

  if (!doctor || !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate || "")) {
    return res.status(400).json({ error: "Doctor and a valid appointment date are required" });
  }
  if (appointmentTime && !appointmentTimes.has(appointmentTime)) {
    return res.status(400).json({ error: "Select an available appointment time" });
  }

  const existingAppointment = findCurrentAppointment(req.user.id);
  if (existingAppointment) {
    return res.status(409).json({
      error: "You already have an active appointment",
      appointment: existingAppointment
    });
  }

  const tokenNumber = getNextTokenNumber(req.body.doctorId, doctor.prefix);
  const appointment = createAppointment({
    patientId: req.user.id,
    doctorId: req.body.doctorId,
    doctorName: doctor.name,
    appointmentDate,
    appointmentTime: appointmentTime || "09:00 AM",
    tokenNumber
  });

  res.status(201).json({ appointment });
});

app.get("/api/queue/waiting", requireStaff, (req, res) => {
  res.json({ appointments: findWaitingAppointments(req.query.doctorId) });
});

app.get("/api/queue/history", requireStaff, (req, res) => {
  res.json({ appointments: findTodayHistory(req.query.doctorId) });
});

// --- Protected staff-only actions -----------------------------------
// Authorization is enforced here, server-side, independent of anything
// the client claims. requireStaff checks the SQLite session user's role.

app.post("/api/queue/call-next", requireStaff, (req, res) => {
  const appointment = callNextAppointment(req.body && req.body.doctorId);
  if (!appointment) return res.status(404).json({ error: "No patients are waiting" });
  res.json({ ok: true, appointment });
});

app.post("/api/queue/call-specific", requireStaff, (req, res) => {
  const appointment = callSpecificAppointment(
    req.body && req.body.doctorId,
    req.body && req.body.token
  );
  if (!appointment) return res.status(404).json({ error: "Waiting patient was not found" });
  res.json({ ok: true, appointment });
});

app.post("/api/queue/recall", requireStaff, (req, res) => {
  console.log(`[queue] recall by ${req.user.name} for doctor ${req.body.doctorId}`);
  res.json({ ok: true });
});

app.post("/api/queue/complete", requireStaff, (req, res) => {
  const appointment = completeAppointment(
    req.body && req.body.doctorId,
    req.body && req.body.token
  );
  if (!appointment) return res.status(404).json({ error: "Called patient was not found" });
  res.json({ ok: true, appointment });
});

/* ============================================================
   STATIC FRONTEND
   ============================================================ */

app.use(express.static(path.join(__dirname, "..", "public"), { index: "index.html" }));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

/* ============================================================
   ERROR HANDLING
   ============================================================ */

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Qsmart Clinic server listening on port ${PORT} (${NODE_ENV})`);
  });
}

module.exports = app;
