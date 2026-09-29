"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "qsmart-auth-"));
process.env.QSMART_DB_PATH = path.join(testDirectory, "auth.sqlite");
process.env.NODE_ENV = "test";

const app = require("../server/server");
const server = app.listen(0);
const baseUrl = `http://127.0.0.1:${server.address().port}`;

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const body = await response.json();
  return { response, body };
}

function cookieFrom(response) {
  return response.headers.get("set-cookie").split(";", 1)[0];
}

test.after(() => {
  server.close();
});

test("patient signup, duplicate email, login, session, and logout", async () => {
  const signup = await request("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test Patient",
      email: "patient@example.com",
      phone: "9876543210",
      password: "patient-pass",
      confirmPassword: "patient-pass",
      role: "patient"
    })
  });
  assert.equal(signup.response.status, 201);
  assert.equal(signup.body.user.role, "patient");

  const duplicate = await request("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Other Patient",
      email: "PATIENT@example.com",
      phone: "9876543211",
      password: "patient-pass",
      confirmPassword: "patient-pass",
      role: "patient"
    })
  });
  assert.equal(duplicate.response.status, 409);

  const invalidLogin = await request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "patient@example.com", password: "wrong-pass" })
  });
  assert.equal(invalidLogin.response.status, 401);

  const login = await request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "patient@example.com", password: "patient-pass" })
  });
  assert.equal(login.response.status, 200);
  const patientCookie = cookieFrom(login.response);
  assert.match(patientCookie, /^clinic_session=/);

  const me = await request("/api/me", { headers: { Cookie: patientCookie } });
  assert.equal(me.body.authenticated, true);
  assert.equal(me.body.role, "patient");
  assert.equal(me.body.user.email, "patient@example.com");

  const patientStaffAction = await request("/api/queue/recall", {
    method: "POST",
    headers: { Cookie: patientCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ doctorId: "doctor1" })
  });
  assert.equal(patientStaffAction.response.status, 403);

  const logout = await request("/auth/logout", {
    method: "POST",
    headers: { Cookie: patientCookie }
  });
  assert.equal(logout.response.status, 200);

  const afterLogout = await request("/api/me", { headers: { Cookie: patientCookie } });
  assert.equal(afterLogout.body.authenticated, false);
});

test("staff login and role protection", async () => {
  const signup = await request("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test Staff",
      email: "staff@example.com",
      phone: "9876543212",
      password: "staff-pass",
      confirmPassword: "staff-pass",
      role: "staff"
    })
  });
  assert.equal(signup.response.status, 201);

  const login = await request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "staff@example.com", password: "staff-pass" })
  });
  assert.equal(login.response.status, 200);
  const staffCookie = cookieFrom(login.response);

  const me = await request("/api/me", { headers: { Cookie: staffCookie } });
  assert.equal(me.body.role, "staff");
  assert.equal(me.body.isStaff, true);

  const staffAction = await request("/api/queue/recall", {
    method: "POST",
    headers: { Cookie: staffCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ doctorId: "doctor1" })
  });
  assert.equal(staffAction.response.status, 200);
});