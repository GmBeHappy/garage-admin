import {z} from "zod";
import spec from "./admin-spec.json";
import {parseJson} from "./forms";

// Resolve local references before handing the v2.1 request schema to Zod.
export function resolve(raw){
  if(!raw||typeof raw!=="object")return raw;
  if(raw.$ref)return resolve(spec.components.schemas[raw.$ref.split("/").pop()]);
  if(Array.isArray(raw))return raw.map(resolve);
  return Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,resolve(v)]));
}
export function operationFormSchema(op){
  const query={};
  for(const p of op.parameters||[]){
    let field=z.string();
    if(p.required)field=field.min(1,"Required");
    if(p.schema.type==="boolean")field=field.refine(v=>["true","false",""].includes(v),"Enter true or false.");
    if(p.schema.type==="integer")field=field.refine(v=>v===""||/^-?\d+$/.test(v),"Enter an integer.");
    query[p.name]=p.required?field:field.optional();
  }
  const raw=op.requestBody?.content?.["application/json"]?.schema;
  return z.object({query:z.object(query),body:raw?parseJson.pipe(z.fromJSONSchema(resolve(raw))):z.string().optional()});
}
