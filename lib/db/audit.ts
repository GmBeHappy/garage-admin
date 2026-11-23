import { db } from "./index";

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
