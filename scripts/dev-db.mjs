/**
 * Local-development Postgres, for machines without Docker or a native Postgres.
 *
 * Boots an in-process PGlite instance persisted to ./.pgdata and exposes it as a
 * real Postgres wire-protocol server on 127.0.0.1:5433, so Prisma (migrate, seed,
 * and the app itself) can talk to it exactly like a hosted Postgres.
 *
 * This is a local convenience only — production runs against Neon/Supabase.
 *
 *   npm run dev:db
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const PORT = Number(process.env.DEV_DB_PORT || 5433);
const HOST = "127.0.0.1";

const db = await PGlite.create({ dataDir: "./.pgdata" });
await db.waitReady;

const server = new PGLiteSocketServer({ db, port: PORT, host: HOST });
await server.start();

console.log(`Dev Postgres listening on ${HOST}:${PORT}`);
console.log(
  `DATABASE_URL="postgresql://postgres:postgres@${HOST}:${PORT}/postgres?sslmode=disable&connection_limit=1&pgbouncer=true"`
);
console.log("(sslmode/connection_limit/pgbouncer params are needed by this local server only.)");
console.log("Press Ctrl+C to stop.");

async function shutdown() {
  await server.stop();
  await db.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
