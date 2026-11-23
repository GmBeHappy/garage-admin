import { db } from "./index";
import { DEFAULT_UPLOAD } from "../forms";

// Console-only per-bucket settings that Garage itself has no field for.
function setting(bucket:string,key:string){
  return db().query<{value:string},[string,string]>("SELECT value FROM user_settings WHERE bucket=? AND key=?").get(bucket,key)?.value;
}
function saveSetting(bucket:string,key:string,value:string|null){
  if(value===null)db().query("DELETE FROM user_settings WHERE bucket=? AND key=?").run(bucket,key);
  else db().query("INSERT INTO user_settings(bucket,key,value) VALUES(?,?,?) ON CONFLICT(bucket,key) DO UPDATE SET value=excluded.value").run(bucket,key,value);
}
// Maximum single-file upload in bytes; buckets without a value use the default.
export function uploadLimit(bucket:string){
  const value=setting(bucket,"upload_limits");
  return {maxBytes:value===undefined?DEFAULT_UPLOAD:Number(value),custom:value!==undefined};
}
export function saveUploadLimit(bucket:string,maxBytes:number|null){
  saveSetting(bucket,"upload_limits",maxBytes===null?null:String(maxBytes));
  return uploadLimit(bucket);
}
