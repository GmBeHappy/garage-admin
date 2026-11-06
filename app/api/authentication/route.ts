import {session,origin} from "../../../lib/session";
import {authPolicy,saveAuthPolicy,audited} from "../../../lib/audit";
import {signInPolicy} from "../../../lib/forms";
const configured=()=>["OIDC_ISSUER","OIDC_CLIENT_ID","OIDC_SECRET","OIDC_ADMIN_GROUP"].every(k=>!!process.env[k]);
export async function GET(){
 const s=await session();
 if(!s.user)return Response.json({error:"Sign in first"},{status:401});
 return Response.json({ssoOnly:authPolicy().ssoOnly,verified:s.method==="oidc",configured:configured(),passwordConfigured:!!process.env.ADMIN_PASSWORD},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(req:Request){
 if(req.headers.get("origin")!==origin())return Response.json({error:"Forbidden"},{status:403});
 const s=await session();
 if(!s.user)return Response.json({error:"Sign in first"},{status:401});
 const input=signInPolicy.safeParse(await req.json().catch(()=>null));
 if(!input.success)return Response.json({error:"Choose a valid sign-in mode."},{status:400});
 const {ssoOnly}=input.data;
 return audited(s.user,"Update sign-in policy",ssoOnly?"SSO only":"SSO and password",()=>{
   if(s.method!=="oidc")return Response.json({error:"Sign in with Authentik before changing sign-in modes."},{status:403});
   if(ssoOnly&&!configured())return Response.json({error:"Configure Authentik first."},{status:409});
   if(!ssoOnly&&!process.env.ADMIN_PASSWORD)return Response.json({error:"Configure an administrator password first."},{status:409});
   return Response.json({ssoOnly:saveAuthPolicy(ssoOnly).ssoOnly});
 });
}
