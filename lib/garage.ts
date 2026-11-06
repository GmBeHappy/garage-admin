import type {Responses,Query,StorageInput,Groups} from "./models";
import {paths} from "./operation-schema";
import {fileType} from "./file-types";
import { audited } from "./audit";

import * as s3 from "@aws-sdk/client-s3";

export function admin<K extends keyof Responses>(op:K,query?:Query,body?:unknown):Promise<Responses[K]>;
export function admin(op:string,query?:Query,body?:unknown):Promise<unknown>;
export async function admin(op:string, query:Query = {}, body?:unknown) {
  const entry = paths["/v2/" + op];
  if (!entry) throw Error("Unknown Garage operation");
  const method = Object.keys(entry)[0].toUpperCase();
  const url = new URL("/v2/" + op, process.env.GARAGE_ADMIN_URL);
  for (const [key, value] of Object.entries(query)) if (value !== "" && value!==undefined) url.searchParams.set(key, String(value));
  const res = await fetch(url, {method, cache:"no-store", headers:{Authorization:"Bearer " + process.env.GARAGE_TOKEN, "Content-Type":"application/json"}, body: method !== "GET" && body !== undefined ? JSON.stringify(body) : undefined});
  const text = await res.text();
  if (!res.ok) throw Error(text || res.statusText);
  return text ? JSON.parse(text) : {};
}

// Garage scopes S3 keys per bucket. Resolve to the immutable ID before granting
// or using access so local aliases cannot select a different bucket.
export async function adminBucket(bucket:string, actor:string) {
  const query = /^[a-f0-9]{64}$/.test(bucket) ? {id:bucket} : {globalAlias:bucket};
  const info = await admin("GetBucketInfo", query);
  const accessKeyId = process.env.S3_KEY;
  const permissions = info.keys.find(key => key.accessKeyId === accessKeyId)?.permissions;
  if (!permissions?.read || !permissions.write || !permissions.owner) {
    await audited(actor, "Grant console key access", info.id, () =>
      admin("AllowBucketKey", {}, {bucketId:info.id, accessKeyId, permissions:{read:true,write:true,owner:true}}));
  }
  return info.id;
}

export function client() {
  return new s3.S3Client({region:process.env.S3_REGION || "garage", endpoint:process.env.S3_ENDPOINT, forcePathStyle:true, requestChecksumCalculation:"WHEN_REQUIRED", credentials:{accessKeyId:process.env.S3_KEY!, secretAccessKey:process.env.S3_SECRET!}});
}
export async function storage({bucket, kind, action, value, prefix, token}:StorageInput, actor:string) {
  bucket = await adminBucket(bucket, actor);
  const api = client();
  if (kind === "composition" || kind === "objects") {
    const folders = kind === "objects" && action === "browse";
    const out = await api.send(new s3.ListObjectsV2Command({
      Bucket:bucket, Prefix:prefix || "", Delimiter:folders ? "/" : undefined,
      ContinuationToken:token, MaxKeys:kind === "composition" ? 1000 : 100
    }));
    const items=out.Contents || [];
    if(kind==="composition"){
      const groups:Groups={};
      for(const item of items){
        if(!item.Key)continue;
        if(item.Key.endsWith("/") && item.Size===0)continue;
        const name=fileType(item.Key);
        const group=groups[name] ||= {bytes:0,count:0};
        group.bytes+=item.Size??0; group.count++;
      }
      return {groups,next:out.NextContinuationToken};
    }
    return {items,folders:(out.CommonPrefixes||[]).map(f=>f.Prefix),next:out.NextContinuationToken};
  }
  const Bucket=bucket;
  try {
    if(kind==="cors"){
      if(action==="read")return (await api.send(new s3.GetBucketCorsCommand({Bucket}))).CORSRules??[];
      if(action==="save")await api.send(new s3.PutBucketCorsCommand({Bucket,CORSConfiguration:{CORSRules:value as s3.CORSRule[]}}));
      else if(action==="remove")await api.send(new s3.DeleteBucketCorsCommand({Bucket}));
      else throw Error("Invalid bucket operation");
      return [];
    }
    if(kind==="lifecycle"){
      if(action==="read")return (await api.send(new s3.GetBucketLifecycleConfigurationCommand({Bucket}))).Rules??[];
      if(action==="save")await api.send(new s3.PutBucketLifecycleConfigurationCommand({Bucket,LifecycleConfiguration:{Rules:value as s3.LifecycleRule[]}}));
      else if(action==="remove")await api.send(new s3.DeleteBucketLifecycleCommand({Bucket}));
      else throw Error("Invalid bucket operation");
      return [];
    }
    if(kind!=="website")throw Error("Invalid bucket operation");
    if(action==="read"){
      const {$metadata,...settings}=await api.send(new s3.GetBucketWebsiteCommand({Bucket}));
      return settings;
    }
    if(action==="save")await api.send(new s3.PutBucketWebsiteCommand({Bucket,WebsiteConfiguration:value as s3.WebsiteConfiguration}));
    else if(action==="remove")await api.send(new s3.DeleteBucketWebsiteCommand({Bucket}));
    else throw Error("Invalid bucket operation");
    return {};
  }catch(err){
    const empty=kind==="website"?{}:[];
    if(action==="read"&&err instanceof Error&&["NoSuchCORSConfiguration","NoSuchLifecycleConfiguration","NoSuchWebsiteConfiguration"].includes(err.name))return empty;
    if(action==="read"&&err instanceof s3.S3ServiceException&&err.$metadata.httpStatusCode===404){
      await api.send(new s3.HeadBucketCommand({Bucket}));return empty;
    }
    throw err;
  }
}
