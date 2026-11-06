import { session } from "../../../lib/session";
import { listAudit } from "../../../lib/audit";
export async function GET(req:Request) {
  if (!(await session()).user) return Response.json({error:"Sign in again"},{status:401});
  const params = new URL(req.url).searchParams;
  const rows = listAudit(Number(params.get("before")), (params.get("q") || "").slice(0,200));
  return Response.json({events:rows.slice(0,50),more:rows.length>50},{headers:{"Cache-Control":"no-store"}});
}
