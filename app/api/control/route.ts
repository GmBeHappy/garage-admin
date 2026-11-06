import {z} from "zod";
import {resolve,paths} from "../../../lib/operation-schema";
import {bucketName,corsRules,keyName,lifecycle,website} from "../../../lib/forms";
import { audited } from "../../../lib/audit";
import spec from "../../../lib/admin-spec.json";
import { session, origin } from "../../../lib/session";
import { admin, storage } from "../../../lib/garage";
export async function POST(req:Request) {
  if (req.headers.get("origin") !== origin()) return Response.json({error:"Invalid origin"}, {status:403});
  const {user} = await session();
  if (!user) return Response.json({error:"Sign in again"}, {status:401});
  try {
    const {op, query, body, ...input} = await req.json();
    const revealing = op==="GetKeyInfo" && String(query?.showSecretKey)==="true";
    const action = revealing ? "Reveal access key secret" : op ? (Object.hasOwn(spec.paths,"/v2/"+op) ? op : "Unknown admin operation")
      : [["cors","website","lifecycle","objects","composition"].includes(input.kind) ? input.kind : "storage",
         ["save","remove","read","browse","scan"].includes(input.action) ? input.action : input.kind === "objects" ? "list" : "request"].join(".");
    const target = [query?.id, query?.node, query?.globalAlias, body?.bucketId, body?.accessKeyId,
      body?.globalAlias, op === "CreateKey" ? body?.name : "", input.bucket].filter(v=>typeof v==="string" && v.length>0).join(" · ");
    const data = await audited(user,action,target,()=>{
      if(op){
        const schema=paths["/v2/"+op]?.post?.requestBody?.content?.["application/json"]?.schema;
        if(schema)z.fromJSONSchema(resolve(schema)).parse(body);
        if(op==="AddBucketAlias"||op==="CreateBucket"){
          if(body?.globalAlias!=null)bucketName.parse(body.globalAlias);
        }
        if(op==="CreateKey"&&body?.name!=null)keyName.parse(body.name);
        return admin(op,query,body);
      }
      if(input.action==="save"){
        const validators:Record<string,z.ZodType>={cors:corsRules,website,lifecycle};
        const validator=validators[input.kind];
        if(validator)input.value=validator.parse(input.value);
        if(input.kind==="cors"&&!input.value.length)throw Error("Add a rule or delete the CORS configuration.");
      }
      return storage(input,user);
    });
    return Response.json(data, {headers:{"Cache-Control":"no-store"}});
  } catch (err) {return Response.json({error:err instanceof z.ZodError?err.issues.map(i=>[i.path.join("."),i.message].filter(Boolean).join(": ")).join("\n"):err instanceof Error?err.message:String(err)}, {status:400});}
}
