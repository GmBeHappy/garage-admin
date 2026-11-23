import { Database } from "bun:sqlite";
import { DEFAULT_UPLOAD } from "./forms";

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
    INSERT OR IGNORE INTO sign_in_policy VALUES(1,0,0);
    CREATE TABLE IF NOT EXISTS user_settings (
      bucket TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(bucket,key)
    )`);
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

export interface AuditEvent {id:number; time:string; actor:string; action:string; target:string; outcome:string}
const matches = "(?1='' OR instr(lower(actor||' '||action||' '||target||' '||outcome),lower(?1))>0)";
export function listAudit(page:number, size:number, filter:string) {
  const {total} = db().query<{total:number},[string]>(`SELECT count(*) AS total FROM events WHERE ${matches}`).get(filter)!;
  const pages = Math.max(1, Math.ceil(total/size));
  const current = Math.min(Math.max(1, page), pages);
  const events = db().query<AuditEvent,[string,number,number]>(`SELECT * FROM events WHERE ${matches}
    ORDER BY id DESC LIMIT ?2 OFFSET ?3`).all(filter, size, (current-1)*size);
  return {events, total, page:current, pages, size};
}

export function authPolicy(){
  const row=db().query<{sso_only:number;password_epoch:number},[]>("SELECT sso_only,password_epoch FROM sign_in_policy WHERE id=1").get()!;
  return {ssoOnly:Boolean(row.sso_only),passwordEpoch:row.password_epoch};
}
export function saveAuthPolicy(ssoOnly:boolean){
  db().query("UPDATE sign_in_policy SET password_epoch=password_epoch+CASE WHEN sso_only=0 AND ?=1 THEN 1 ELSE 0 END,sso_only=? WHERE id=1").run(Number(ssoOnly),Number(ssoOnly));
  return authPolicy();
}

// Console-only per-bucket settings that Garage itself has no field for.
function setting(bucket:string,key:string){
  return db().query<{value:string},[string,string]>("SELECT value FROM user_settings WHERE bucket=? AND key=?").get(bucket,key)?.value;
}
function saveSetting(bucket:string,key:string,value:string|null){
  if(value===null)db().query("DELETE FROM user_settings WHERE bucket=? AND key=?").run(bucket,key);
  else db().query("INSERT INTO user_settings(bucket,key,value) VALUES(?,?,?) ON CONFLICT(bucket,key) DO UPDATE SET value=excluded.value").run(bucket,key,value);
}
// Maximum single-file upload in bytes; buckets without a value use the default.
export function uploadLimit(bucket:string){
  const value=setting(bucket,"upload_limits");
  return {maxBytes:value===undefined?DEFAULT_UPLOAD:Number(value),custom:value!==undefined};
}
export function saveUploadLimit(bucket:string,maxBytes:number|null){
  saveSetting(bucket,"upload_limits",maxBytes===null?null:String(maxBytes));
  return uploadLimit(bucket);
}
