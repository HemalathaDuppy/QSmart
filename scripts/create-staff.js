"use strict";

const readline = require("readline");
const bcrypt = require("bcryptjs");
const { findUserByEmail, insertUser } = require("../server/database");

function ask(question) {
  const input = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    input.question(question, (answer) => {
      input.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const name = await ask("Staff name: ");
  const email = (await ask("Staff email: ")).toLowerCase();
  const phone = await ask("Staff phone: ");
  const password = await ask("Staff password: ");
  const confirmPassword = await ask("Confirm password: ");

  if (!name || !email || !phone || password.length < 8 || password !== confirmPassword) {
    throw new Error("Name, email, phone, matching passwords, and an 8-character password are required.");
  }
  if (findUserByEmail(email)) {
    throw new Error("An account with that email already exists.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = insertUser({ name, email, phone, passwordHash, role: "staff" });
  console.log(`Created staff account for ${user.email}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});