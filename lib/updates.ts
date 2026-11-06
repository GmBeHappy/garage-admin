import {randomUUID} from "node:crypto";
import {link,readFile,unlink,writeFile} from "node:fs/promises";
import {z} from "zod";

export const repository="gmbehappy/garage-admin";
export const digest=z.string().regex(/^sha256:[a-f0-9]{64}$/);
const revision=z.string().regex(/^[a-f0-9]{40}$/);
const workerSchema=z.object({
  current:digest.nullable(), checkedAt:z.number(), phase:z.enum(["idle","installing","installed","failed"]),
  message:z.string(), target:digest.nullable()
});
const root="/run/garage-updater";
export interface Release {digest:string; revision:string|null}

async function get(url:string,headers:Record<string,string>={}){
  const res=await fetch(url,{headers,cache:"no-store",signal:AbortSignal.timeout(10000)});
  if(!res.ok)throw Error("Release lookup returned HTTP "+res.status);
  return res;
}
export async function latest():Promise<Release>{
  const auth=await get("https://ghcr.io/token?service=ghcr.io&scope=repository:"+repository+":pull");
  const {token}=z.object({token:z.string().min(1)}).parse(await auth.json());
  const res=await get("https://ghcr.io/v2/"+repository+"/manifests/latest",{
    Authorization:"Bearer "+token,Accept:"application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json"
  });
  const manifest=await res.json();
  const sha=revision.safeParse(manifest.annotations?.["org.opencontainers.image.revision"]);
  return {digest:digest.parse(res.headers.get("docker-content-digest")),revision:sha.success?sha.data:null};
}
export async function relation(release:Release,installed:string|undefined){
  if(!installed||!release.revision)return "unknown";
  if(installed===release.revision)return "identical";
  if(!revision.safeParse(installed).success)return "unknown";
  const res=await get("https://api.github.com/repos/"+repository+"/compare/"+installed+"..."+release.revision,{"User-Agent":"garage-admin-update-check","Accept":"application/vnd.github+json"});
  return z.enum(["ahead","behind","identical","diverged"]).parse((await res.json()).status);
}
export async function worker(){
  try{return workerSchema.parse(JSON.parse(await readFile(root+"/status/worker.json","utf8")))}
  catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT")return null;throw e}
}
export function ready(w:Awaited<ReturnType<typeof worker>>){
  return !!w && Date.now()-w.checkedAt < 4*60_000;
}
export async function pending(){
  try{await readFile(root+"/queue/request.json","utf8");return true}
  catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT")return false;throw e}
}
export async function queue(target:string){
  const temp=root+"/queue/"+randomUUID()+".tmp";
  await writeFile(temp,JSON.stringify({target}),{flag:"wx",mode:0o600});
  try{await link(temp,root+"/queue/request.json")}finally{await unlink(temp)}
}
