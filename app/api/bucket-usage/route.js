import {session} from "../../../lib/session";
import {admin} from "../../../lib/garage";

export async function GET(){
  if(!(await session()).user)return Response.json({error:"Sign in again"},{status:401});
  try{
    // Garage 2.1 returns counters and quotas only on individual bucket lookups.
    const pending=await admin("ListBuckets"), usage={};
    async function worker(){
      while(pending.length){
        const {id}=pending.pop();
        try{
          const {bytes,objects,quotas}=await admin("GetBucketInfo",{id});
          usage[id]={bytes,objects,quotas};
        }catch{usage[id]=null}
      }
    }
    await Promise.all(Array.from({length:Math.min(4,pending.length)},worker));
    return Response.json(usage,{headers:{"Cache-Control":"private, no-store"}});
  }catch{return Response.json({error:"Unable to load bucket usage"},{status:502})}
}
