"use strict";

const { findSessionUser } = require("./database");

const SESSION_COOKIE = "clinic_session";

/**
 * Reads the server-side session on every request and attaches the
 * corresponding user. Public routes can ignore req.user.
 */
function attachUser(req, res, next) {
  const sessionId = req.cookies ? req.cookies[SESSION_COOKIE] : null;
  req.user = findSessionUser(sessionId);
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

function requireStaff(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "staff") {
      return res.status(403).json({ error: "Staff access required" });
    }
    next();
  });
}

function requirePatient(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "patient") {
      return res.status(403).json({ error: "Patient access required" });
    }
    next();
  });
}

module.exports = {
  attachUser,
  requireAuth,
  requireStaff,
  requirePatient,
  SESSION_COOKIE
};
