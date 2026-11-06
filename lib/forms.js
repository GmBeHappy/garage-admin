import {z} from "zod";
export const units={B:1,KiB:1024,MiB:1024**2,GiB:1024**3,TiB:1024**4};
export const bucketName=z.string().trim().min(3,"Use at least 3 characters.").max(63).regex(/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])$/,"Use lowercase letters, numbers, hyphens or dots.").refine(v=>!v.includes("..")&&!/^\d+\.\d+\.\d+\.\d+$/.test(v),"Use a bucket name without consecutive dots or an IP address.");
export const keyName=z.string().trim().min(1,"Enter a key name.");
export const passwordSchema=z.object({password:z.string().min(1,"Enter the administrator password.")});
export const quotaSchema=z.object({size:z.string(),unit:z.enum(Object.keys(units)),objects:z.string()}).transform((v,ctx)=>{
  function limit(raw,multiplier,field){
    const s=raw.trim();if(!s)return null;
    const n=Number(s)*multiplier;
    if(!/^\d+(?:\.\d+)?$/.test(s)||!Number.isSafeInteger(n)||n<0)ctx.addIssue({code:"custom",path:[field],message:"Enter a nonnegative limit equal to a whole number of "+(field==="size"?"bytes.":"objects.")});
    return n;
  }
  return {maxSize:limit(v.size,units[v.unit],"size"),maxObjects:limit(v.objects,1,"objects")};
});
const lines=z.array(z.string().trim()).transform(a=>[...new Set(a.filter(Boolean))]);
function validOrigin(v){
  if(v==="*"||v==="null")return true;
  try{const u=new URL(v.replaceAll("*","wildcard"));return !!u.host&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==="/"&&!v.endsWith("/")}catch{return false}
}
export const corsRules=z.array(z.looseObject({
  AllowedOrigins:lines.refine(v=>v.length>0,"Enter at least one allowed origin.").refine(v=>v.every(validOrigin),"Use an origin such as https://app.example.com without a path or trailing slash."),
  AllowedMethods:z.array(z.enum(["GET","HEAD","PUT","POST","DELETE"])).min(1,"Choose at least one request method."),
  AllowedHeaders:lines.nullish(),ExposeHeaders:lines.nullish(),MaxAgeSeconds:z.number().int().nonnegative().nullish(),ID:z.string().nullish()
}));
const days=z.number().int().positive();
export const lifecycle=z.array(z.looseObject({
  ID:z.string().max(255).nullish(),Status:z.enum(["Enabled","Disabled"]),Filter:z.looseObject({Prefix:z.string().optional()}).optional(),
  Expiration:z.looseObject({Days:days.optional(),Date:z.string().refine(s=>Number.isFinite(Date.parse(s)),"Enter a valid date.").optional()}).refine(v=>Number(v.Days!=null)+Number(v.Date!=null)===1,"Set expiration days or a date.").optional(),
  AbortIncompleteMultipartUpload:z.object({DaysAfterInitiation:days}).optional()
}).refine(r=>r.Expiration||r.AbortIncompleteMultipartUpload,"Choose an expiration or upload cleanup action.")).min(1,"Add a lifecycle rule or delete the configuration.").refine(rs=>{const ids=rs.map(r=>r.ID).filter(Boolean);return new Set(ids).size===ids.length},"Use unique rule IDs.");
export const website=z.looseObject({IndexDocument:z.object({Suffix:z.string().min(1).regex(/^[^/]+$/,"Enter an index filename without a slash.")}),ErrorDocument:z.object({Key:z.string().min(1)}).optional()});
export const folderSchema=z.object({name:z.string().min(1,"Enter a folder name.").refine(v=>v.trim().length>0&&!v.includes("/")&&v!=="."&&v!=="..","Use a single folder name without slashes.")});
export const fileSchema=z.object({file:z.file().max(32*1024*1024,"Maximum upload size is 32 MiB.")});
export const parseJson=z.string().transform((s,ctx)=>{try{return JSON.parse(s)}catch{ctx.addIssue({code:"custom",message:"Enter valid JSON."});return z.NEVER}});
export const signInPolicy=z.object({ssoOnly:z.boolean()});
