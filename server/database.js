"use strict";

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const databasePath =
  process.env.QSMART_DB_PATH || path.join(__dirname, "..", "data", "qsmart.sqlite");

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new Database(databasePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('patient', 'staff')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_id TEXT NOT NULL,
    doctor_name TEXT NOT NULL,
    appointment_date TEXT NOT NULL,
    appointment_time TEXT NOT NULL,
    token_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'waiting',
    called_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const appointmentColumns = db
  .prepare("PRAGMA table_info(appointments)")
  .all()
  .map(column => column.name);

if (!appointmentColumns.includes("called_at")) {
  db.exec("ALTER TABLE appointments ADD COLUMN called_at TEXT");
}
if (!appointmentColumns.includes("completed_at")) {
  db.exec("ALTER TABLE appointments ADD COLUMN completed_at TEXT");
}

const statements = {
  findUserByEmail: db.prepare("SELECT * FROM users WHERE email = ?"),
  findUserById: db.prepare("SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?"),
  insertUser: db.prepare(
    "INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)"
  ),
  insertSession: db.prepare(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, datetime('now', ?))"
  ),
  findCurrentAppointment: db.prepare(`
    SELECT id, patient_id, doctor_id, doctor_name, appointment_date,
           appointment_time, token_number, status, created_at
    FROM appointments
    WHERE patient_id = ? AND status IN ('waiting', 'called', 'active')
    ORDER BY id DESC
    LIMIT 1
  `),
  findHighestTokenNumber: db.prepare(`
    SELECT MAX(CAST(substr(token_number, instr(token_number, '-') + 1) AS INTEGER)) AS highest
    FROM appointments
    WHERE doctor_id = ?
  `),
  findWaitingAppointments: db.prepare(`
    SELECT a.id, a.patient_id, u.name AS patient_name, a.doctor_id,
           a.doctor_name, a.appointment_date, a.appointment_time,
           a.token_number, a.status, a.created_at
    FROM appointments a
    JOIN users u ON u.id = a.patient_id
    WHERE a.doctor_id = ? AND a.status IN ('waiting', 'active')
    ORDER BY a.id ASC
  `),
  findTodayHistory: db.prepare(`
    SELECT a.id, a.patient_id, u.name AS patient_name, a.doctor_id,
           a.doctor_name, a.appointment_date, a.appointment_time,
           a.token_number, a.status, a.created_at, a.called_at, a.completed_at
    FROM appointments a
    JOIN users u ON u.id = a.patient_id
    WHERE a.doctor_id = ? AND a.status = 'completed'
      AND date(a.completed_at, 'localtime') = date('now', 'localtime')
    ORDER BY a.completed_at DESC, a.id DESC
  `),
  findWaitingAppointmentByToken: db.prepare(`
    SELECT * FROM appointments
    WHERE doctor_id = ? AND token_number = ? AND status IN ('waiting', 'active')
    LIMIT 1
  `),
  findCalledAppointmentByToken: db.prepare(`
    SELECT * FROM appointments
    WHERE doctor_id = ? AND token_number = ? AND status IN ('waiting', 'active', 'called')
    LIMIT 1
  `),
  callAppointment: db.prepare(`
    UPDATE appointments
    SET status = 'called', called_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `),
  completeAppointment: db.prepare(`
    UPDATE appointments
    SET status = 'completed', completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `),
  findAppointmentById: db.prepare("SELECT * FROM appointments WHERE id = ?"),
  findAppointmentWithPatientById: db.prepare(`
    SELECT a.*, u.name AS patient_name
    FROM appointments a
    JOIN users u ON u.id = a.patient_id
    WHERE a.id = ?
  `),
  insertAppointment: db.prepare(`
    INSERT INTO appointments
      (patient_id, doctor_id, doctor_name, appointment_date, appointment_time, token_number)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  findSessionUser: db.prepare(`
    SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > CURRENT_TIMESTAMP
  `),
  deleteSession: db.prepare("DELETE FROM sessions WHERE id = ?")
};

function findUserByEmail(email) {
  return statements.findUserByEmail.get(email);
}

function findUserById(id) {
  return statements.findUserById.get(id);
}

function insertUser({ name, email, phone, passwordHash, role }) {
  const result = statements.insertUser.run(name, email, phone, passwordHash, role);
  return findUserById(result.lastInsertRowid);
}

function insertSession(sessionId, userId, maxAgeSeconds) {
  statements.insertSession.run(sessionId, userId, `+${maxAgeSeconds} seconds`);
}

function findCurrentAppointment(patientId) {
  return statements.findCurrentAppointment.get(patientId) || null;
}

function createAppointment({ patientId, doctorId, doctorName, appointmentDate, appointmentTime, tokenNumber }) {
  const result = statements.insertAppointment.run(
    patientId,
    doctorId,
    doctorName,
    appointmentDate,
    appointmentTime,
    tokenNumber
  );
  return statements.findCurrentAppointment.get(patientId) || { id: result.lastInsertRowid };
}

function getNextTokenNumber(doctorId, tokenPrefix) {
  const highest = statements.findHighestTokenNumber.get(doctorId).highest;
  return `${tokenPrefix}-${(highest || 104) + 1}`;
}

function findWaitingAppointments(doctorId) {
  return statements.findWaitingAppointments.all(doctorId);
}

function findTodayHistory(doctorId) {
  return statements.findTodayHistory.all(doctorId);
}

function callNextAppointment(doctorId) {
  const appointment = statements.findWaitingAppointments.get(doctorId);
  if (!appointment) return null;
  statements.callAppointment.run(appointment.id);
  return statements.findAppointmentWithPatientById.get(appointment.id);
}

function callSpecificAppointment(doctorId, tokenNumber) {
  const appointment = statements.findWaitingAppointmentByToken.get(doctorId, tokenNumber);
  if (!appointment) return null;
  statements.callAppointment.run(appointment.id);
  return statements.findAppointmentWithPatientById.get(appointment.id);
}

function completeAppointment(doctorId, tokenNumber) {
  const appointment = statements.findCalledAppointmentByToken.get(doctorId, tokenNumber);
  if (!appointment) return null;
  statements.completeAppointment.run(appointment.id);
  return statements.findAppointmentWithPatientById.get(appointment.id);
}

function findSessionUser(sessionId) {
  if (!sessionId) return null;
  return statements.findSessionUser.get(sessionId) || null;
}

function deleteSession(sessionId) {
  if (sessionId) statements.deleteSession.run(sessionId);
}

module.exports = {
  findUserByEmail,
  insertUser,
  insertSession,
  findCurrentAppointment,
  createAppointment,
  getNextTokenNumber,
  findWaitingAppointments,
  findTodayHistory,
  callNextAppointment,
  callSpecificAppointment,
  completeAppointment,
  findSessionUser,
  deleteSession
};