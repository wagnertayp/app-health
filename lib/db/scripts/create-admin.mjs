import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const { Pool } = pg;
const scrypt = promisify(scryptCallback);
const allowedEmails = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map(value => value.trim().toLowerCase())
  .filter(Boolean);
const email = (process.env.ADMIN_EMAIL || (allowedEmails.length === 1 ? allowedEmails[0] : ""))
  .trim()
  .toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não foi definida.");
if (!email || !allowedEmails.includes(email)) throw new Error("Defina ADMIN_EMAIL com um endereço listado em ADMIN_EMAILS.");
if (!password || password.length < 12 || password.length > 1024) {
  throw new Error("A senha inicial precisa ter entre 12 e 1024 caracteres.");
}

const salt = randomBytes(16);
const key = await scrypt(password, salt, 64);
const passwordHash = `scrypt$${salt.toString("hex")}$${Buffer.from(key).toString("hex")}`;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(
    `INSERT INTO users (email, first_name, last_name, password_hash)
     VALUES ($1, 'Admin', '', $2)
     ON CONFLICT (email) DO UPDATE
     SET password_hash = EXCLUDED.password_hash, updated_at = NOW()`,
    [email, passwordHash],
  );
  process.stdout.write("Conta administrativa configurada.\n");
} finally {
  await pool.end();
}
