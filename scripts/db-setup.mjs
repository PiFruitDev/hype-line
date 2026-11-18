// Creates the tables. Usage: DATABASE_URL=... npm run db:setup  (or put it in .env.local)
import { readFileSync, existsSync } from "node:fs";
import postgres from "postgres";

if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?/);
    if (m) process.env.DATABASE_URL = m[1];
  }
}
if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL first (in .env.local or the shell).");
  process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
await sql.unsafe(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
console.log("Database ready.");
await sql.end();
