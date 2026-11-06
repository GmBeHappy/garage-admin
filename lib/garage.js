import {fileType} from "./file-types";
import { audited } from "./audit";
import spec from "./admin-spec.json";
import * as s3 from "@aws-sdk/client-s3";

export async function admin(op, query = {}, body) {
  const entry = spec.paths["/v2/" + op];
  if (!entry) throw Error("Unknown Garage operation");
  const method = Object.keys(entry)[0].toUpperCase();
  const url = new URL("/v2/" + op, process.env.GARAGE_ADMIN_URL);
  for (const [key, value] of Object.entries(query)) if (value !== "") url.searchParams.set(key, value);
  const res = await fetch(url, {method, cache:"no-store", headers:{Authorization:"Bearer " + process.env.GARAGE_TOKEN, "Content-Type":"application/json"}, body: method !== "GET" && body !== undefined ? JSON.stringify(body) : undefined});
  const text = await res.text();
  if (!res.ok) throw Error(text || res.statusText);
  return text ? JSON.parse(text) : {};
}

// Garage scopes S3 keys per bucket. Resolve to the immutable ID before granting
// or using access so local aliases cannot select a different bucket.
export async function adminBucket(bucket, actor) {
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

const commands = {
  cors: [s3.GetBucketCorsCommand, s3.PutBucketCorsCommand, s3.DeleteBucketCorsCommand, "CORSConfiguration", "CORSRules"],
  lifecycle: [s3.GetBucketLifecycleConfigurationCommand, s3.PutBucketLifecycleConfigurationCommand, s3.DeleteBucketLifecycleCommand, "LifecycleConfiguration", "Rules"],
  website: [s3.GetBucketWebsiteCommand, s3.PutBucketWebsiteCommand, s3.DeleteBucketWebsiteCommand, "WebsiteConfiguration"],
};
export function client() {
  return new s3.S3Client({region:process.env.S3_REGION || "garage", endpoint:process.env.S3_ENDPOINT, forcePathStyle:true, requestChecksumCalculation:"WHEN_REQUIRED", credentials:{accessKeyId:process.env.S3_KEY, secretAccessKey:process.env.S3_SECRET}});
}
export async function storage({bucket, kind, action, value, prefix, token}, actor) {
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
      const groups={};
      for(const item of items){
        if(item.Key.endsWith("/") && item.Size===0)continue;
        const name=fileType(item.Key);
        const group=groups[name] ||= {bytes:0,count:0};
        group.bytes+=item.Size; group.count++;
      }
      return {groups,next:out.NextContinuationToken};
    }
    return {items,folders:(out.CommonPrefixes||[]).map(f=>f.Prefix),next:out.NextContinuationToken};
  }
  const row = commands[kind];
  const idx = ["read","save","remove"].indexOf(action);
  if (!row || idx < 0) throw Error("Invalid bucket operation");
  try {
    const params = {Bucket:bucket};
    if (action === "save") params[row[3]] = row[4] ? {[row[4]]:value} : value;
    const out = await api.send(new row[idx](params));
    delete out.$metadata;
    return row[4] ? out[row[4]] || [] : out;
  } catch (err) {
    if (action === "read" && ["NoSuchCORSConfiguration","NoSuchLifecycleConfiguration","NoSuchWebsiteConfiguration"].includes(err.name)) return row[4] ? [] : {};
    if (action === "read" && err.$metadata?.httpStatusCode === 404) {
      await api.send(new s3.HeadBucketCommand({Bucket:bucket}));
      return row[4] ? [] : {};
    }
    throw err;
  }
}
