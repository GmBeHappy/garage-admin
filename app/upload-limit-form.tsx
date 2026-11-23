"use client";
import {useEffect,useState} from "react";
import {errorMessage} from "../lib/models";
import {uploadLimitSchema,units} from "../lib/forms";
import {bytes} from "../lib/file-types";
import {useValidatedForm,FormErrors} from "./form";
import {Button} from "../components/ui/button";
import SizeField from "./size-field";

export type UploadLimit={maxBytes:number;custom:boolean;default:number;ceiling:number};
export async function loadUploadLimit(bucket:string):Promise<UploadLimit>{
 const r=await fetch("/api/upload-limit?"+new URLSearchParams({bucket}),{cache:"no-store"}),out=await r.json();
 if(!r.ok)throw Error(out.error);return out;
}
const formValues=(l:UploadLimit|null)=>{
 if(!l?.custom)return {size:"",unit:"MiB" as const};
 const unit=l.maxBytes%units.GiB===0?"GiB" as const:"MiB" as const;
 return {size:String(+(l.maxBytes/units[unit]).toFixed(2)),unit};
};
export default function UploadLimitForm({bucket}:{bucket:string}){
 const [limit,setLimit]=useState<UploadLimit|null>(null),[notice,setNotice]=useState("");
 const {register,handleSubmit,reset,setError,watch,formState:{errors,isSubmitting}}=useValidatedForm(uploadLimitSchema,formValues(null));
 useEffect(()=>{let active=true;loadUploadLimit(bucket).then(l=>{if(active){setLimit(l);reset(formValues(l))}}).catch(e=>active&&setError("root",{message:errorMessage(e)}));return()=>{active=false}},[bucket,reset,setError]);
 async function save({maxBytes}:{maxBytes:number|null}){
  setNotice("");
  try{
   const r=await fetch("/api/upload-limit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({bucket,maxBytes})}),out=await r.json();
   if(!r.ok)throw Error(out.error);
   setLimit(out);reset(formValues(out));setNotice("Upload limit saved");
  }catch(e){setError("root",{message:errorMessage(e)})}
 }
 return <form className="quota-form" noValidate onSubmit={handleSubmit(save)}><fieldset disabled={!limit||isSubmitting}>
 <SizeField label="Maximum file size" size={register("size")} unit={register("unit")} value={watch("size")} unitValue={watch("unit")} choices={["MiB","GiB"]} placeholder={"Default ("+bytes(limit?.default??32*units.MiB)+")"}/>
 <p className="hint">Largest single file the console accepts when uploading to this bucket{limit&&<>, currently <b>{bytes(limit.maxBytes)}</b></>}. Leave blank for the default; up to {bytes(limit?.ceiling??units.GiB)}. Uploads pass through the console server&apos;s memory, and a reverse proxy in front of the console may enforce its own body size limit.</p>
 <FormErrors errors={errors}/>{notice&&<small role="status">{notice}</small>}
 <div className="quota-actions"><Button size="sm">{isSubmitting?"Saving…":"Save upload limit"}</Button></div></fieldset></form>
}
