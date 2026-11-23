import {session,origin} from "../../../lib/session";
import {audited} from "../../../lib/db/audit";
import {uploadLimit,saveUploadLimit} from "../../../lib/db/settings";
import {uploadLimitInput,DEFAULT_UPLOAD,UPLOAD_CEILING} from "../../../lib/forms";
import {admin} from "../../../lib/garage";
import {bytes} from "../../../lib/file-types";
import {errorMessage} from "../../../lib/models";
const reply=(bucket:string)=>Response.json({...uploadLimit(bucket),default:DEFAULT_UPLOAD,ceiling:UPLOAD_CEILING},{headers:{"Cache-Control":"no-store"}});
export async function GET(req:Request){
 if(!(await session()).user)return Response.json({error:"Sign in again"},{status:401});
 const bucket=new URL(req.url).searchParams.get("bucket")||"";
 if(!/^[a-f0-9]{64}$/.test(bucket))return Response.json({error:"Missing bucket ID"},{status:400});
 return reply(bucket);
}
export async function POST(req:Request){
 if(req.headers.get("origin")!==origin())return Response.json({error:"Forbidden"},{status:403});
 const {user}=await session();
 if(!user)return Response.json({error:"Sign in again"},{status:401});
 const input=uploadLimitInput.safeParse(await req.json().catch(()=>null));
 if(!input.success)return Response.json({error:"Enter an upload limit up to "+bytes(UPLOAD_CEILING)+"."},{status:400});
 const {bucket,maxBytes}=input.data;
 try{
  return await audited(user,"Update upload limit",bucket+": "+(maxBytes===null?"default":bytes(maxBytes)),async()=>{
   await admin("GetBucketInfo",{id:bucket});
   saveUploadLimit(bucket,maxBytes);
   return reply(bucket);
  });
 }catch(e){return Response.json({error:errorMessage(e)},{status:400})}
}
