// Browser-side helpers for calling the console's own API routes.
import type {Bucket,Responses,Query,StorageInput,FolderPage,Groups} from "./models";

type AdminInput={op:string;query?:Query;body?:unknown};
export function call<K extends keyof Responses>(input:AdminInput & {op:K},signal?:AbortSignal):Promise<Responses[K]>;
export function call(input:StorageInput & {kind:"objects"},signal?:AbortSignal):Promise<FolderPage>;
export function call(input:StorageInput & {kind:"composition"},signal?:AbortSignal):Promise<{groups:Groups;next?:string}>;
export function call(input:AdminInput|StorageInput,signal?:AbortSignal):Promise<unknown>;
export async function call(input:AdminInput|StorageInput,signal?:AbortSignal) {
  const res = await fetch("/api/control",{signal,method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});
  const data = await res.json();
  if (!res.ok) throw Error(data.error || "Request failed");
  return data;
}
export const label = (b:Bucket) => b.globalAliases?.[0] || b.localAliases?.[0]?.alias || b.id;

export type UploadLimit={maxBytes:number;custom:boolean;default:number;ceiling:number};
export async function loadUploadLimit(bucket:string):Promise<UploadLimit>{
 const r=await fetch("/api/upload-limit?"+new URLSearchParams({bucket}),{cache:"no-store"}),out=await r.json();
 if(!r.ok)throw Error(out.error);return out;
}
