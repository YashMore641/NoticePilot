import EmbeddedPostgres from "embedded-postgres";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const pg = new EmbeddedPostgres({
  databaseDir: path.join(root, ".data", "pg"),
  user: "postgres",
  password: "postgres",
  port: 5432,
  persistent: true,
  createPostgresUser: false,
});

async function main() {
  try {
    await pg.initialise();
    console.log("[db] cluster initialised");
  } catch (err) {
    // Already initialised on a previous run — that's fine.
    console.log("[db] initialise skipped:", String(err).split("\n")[0]);
  }

  await pg.start();
  console.log("[db] postgres started on port 5432");

  try {
    await pg.createDatabase("app_db");
    console.log("[db] created database app_db");
  } catch (err) {
    console.log("[db] createDatabase skipped:", String(err).split("\n")[0]);
  }
}

main().then(
  () => console.log("[db] ready (Ctrl+C to stop)"),
  (err) => {
    console.error("[db] failed:", err);
    process.exit(1);
  }
);
