import {z} from "zod";
import {origin,session} from "../../../lib/session";
import {audited} from "../../../lib/audit";
import {digest,latest,worker,ready,queue,pending,relation} from "../../../lib/updates";
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(req:Request){
  if(!(await session()).user)return json({error:"Sign in first"},401);
  try{
    const w=await worker();
    const release=new URL(req.url).searchParams.has("status")?undefined:await latest();
    const direction=release?await relation(release,process.env.GARAGE_ADMIN_REVISION):undefined;
    return json({direction,worker:w,ready:ready(w),pending:await pending(),revision:process.env.GARAGE_ADMIN_REVISION||null,release});
  }catch{return json({error:"Unable to check for updates. Retry in a moment."},503)}
}
export async function POST(req:Request){
  if(req.headers.get("origin")!==origin())return json({error:"Invalid origin"},403);
  const {user}=await session();if(!user)return json({error:"Sign in first"},401);
  const input=z.object({target:digest}).safeParse(await req.json().catch(()=>null));
  if(!input.success)return json({error:"Invalid release digest"},400);
  try{
    return await audited(user,"Request console upgrade",input.data.target,async()=>{
      const w=await worker();if(!w||!ready(w)||!w.current)return json({error:"Host updater unavailable"},409);
      if(w.phase==="installing" || await pending())return json({error:"An upgrade is already in progress"},409);
      const published=await latest();
      if(published.digest!==input.data.target || w.current===published.digest)return json({error:"Release changed or already installed. Check again."},409);
      const direction=await relation(published,process.env.GARAGE_ADMIN_REVISION);
      if(direction==="behind"||direction==="diverged")return json({error:"Latest is not a newer build of this revision."},409);
      try{await queue(published.digest)}catch(e){if((e as NodeJS.ErrnoException).code==="EEXIST")return json({error:"Upgrade already queued"},409);throw e}
      return json({queued:true},202);
    });
  }catch{return json({error:"Could not queue the upgrade. Check the registry and host updater."},503)}
}
