import { Database } from "bun:sqlite";

let database:Database | undefined;
function db() {
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
    INSERT OR IGNORE INTO sign_in_policy VALUES(1,0,0)`);
  database = connection;
  return database;
}

// Persist intent before acting. An interrupted operation retains an unknown outcome.
export function beginAudit(actor:string|null|undefined, action:string, target="") {
  const connection = db();
  const {lastInsertRowid} = connection.query(
    "INSERT INTO events(time,actor,action,target,outcome) VALUES(?,?,?,?, 'Unconfirmed')"
  ).run(new Date().toISOString(), actor || "Unauthenticated", action, String(target).slice(0,2048));
  return (outcome:string, verifiedActor:string|null=null) => connection.query(
    "UPDATE events SET outcome=?, actor=coalesce(?,actor) WHERE id=?"
  ).run(outcome,verifiedActor,lastInsertRowid);
}

export async function audited<T>(actor:string, action:string, target:string, work:()=>Promise<T>|T) {
  const finish = beginAudit(actor,action,target);
  let result;
  try { result = await work(); }
  catch (err) { finish("Failed"); throw err; }
  finish(result instanceof Response && !result.ok ? "Failed" : "Succeeded");
  return result;
}

export function listAudit(before:number, filter:string) {
  return db().query(`SELECT * FROM events WHERE id < ?
    AND (?='' OR instr(lower(actor||' '||action||' '||target||' '||outcome),lower(?))>0)
    ORDER BY id DESC LIMIT 51`).all(before || Number.MAX_SAFE_INTEGER, filter, filter);
}

export function authPolicy(){
  const row=db().query<{sso_only:number;password_epoch:number},[]>("SELECT sso_only,password_epoch FROM sign_in_policy WHERE id=1").get()!;
  return {ssoOnly:Boolean(row.sso_only),passwordEpoch:row.password_epoch};
}
export function saveAuthPolicy(ssoOnly:boolean){
  db().query("UPDATE sign_in_policy SET password_epoch=password_epoch+CASE WHEN sso_only=0 AND ?=1 THEN 1 ELSE 0 END,sso_only=? WHERE id=1").run(Number(ssoOnly),Number(ssoOnly));
  return authPolicy();
}
