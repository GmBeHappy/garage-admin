import { Database } from "bun:sqlite";

let database:Database | undefined;
// Console database: audit log, sign-in policy and per-bucket settings.
export function db() {
  if (database) return database;
  const connection = new Database(process.env.AUDIT_DB || "audit.sqlite", {create:true});
  connection.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY, time TEXT NOT NULL, actor TEXT NOT NULL,
      action TEXT NOT NULL, target TEXT NOT NULL, outcome TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sign_in_policy (
      id INTEGER PRIMARY KEY CHECK(id=1), sso_only INTEGER NOT NULL, password_epoch INTEGER NOT NULL
    );
    INSERT OR IGNORE INTO sign_in_policy VALUES(1,0,0);
    CREATE TABLE IF NOT EXISTS user_settings (
      bucket TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(bucket,key)
    )`);
  database = connection;
  return database;
}
