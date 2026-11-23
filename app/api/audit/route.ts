import { session } from "../../../lib/session";
import {listAudit} from "../../../lib/db/audit";
const sizes = [25, 50, 100];
export async function GET(req:Request) {
  if (!(await session()).user) return Response.json({error:"Sign in again"},{status:401});
  const params = new URL(req.url).searchParams;
  const size = sizes.includes(Number(params.get("size"))) ? Number(params.get("size")) : 50;
  const page = Math.floor(Number(params.get("page"))) || 1;
  return Response.json(listAudit(page, size, (params.get("q") || "").slice(0,200)),{headers:{"Cache-Control":"no-store"}});
}
