"use client";
import type {BucketInfo,Usage} from "../../../lib/models";
import {errorMessage} from "../../../lib/models";

import {quotaSchema,units} from "../../../lib/forms";
import {useValidatedForm,FormErrors} from "../../ui/form";
import {Button} from "../../ui/button";
import {call} from "../../../lib/client";
import SizeField from "../../ui/size-field";

export default function QuotaForm({info,onSaved,onCancel}:{info:BucketInfo;onSaved:(b:BucketInfo)=>void;onCancel?:()=>void}){
 const size=info.quotas?.maxSize;
 const initialUnit=size==null?"GiB":(Object.keys(units) as (keyof typeof units)[]).reverse().find(u=>size>0&&size%units[u]===0)||"B";
 const {register,handleSubmit,setError,watch,formState:{errors,isSubmitting}}=useValidatedForm(quotaSchema,{
   size:size==null?"":String(size/units[initialUnit]),unit:initialUnit,objects:String(info.quotas?.maxObjects??"")
 });
 async function submit(quotas:Usage["quotas"]){
   try{const updated=await call({op:"UpdateBucket",query:{id:info.id},body:{quotas}});onSaved(updated)}
   catch(e){setError("root",{message:errorMessage(e)})}
 }
 return <form className="quota-form" noValidate onSubmit={handleSubmit(submit)}><fieldset disabled={isSubmitting}>
 <div className="columns"><SizeField label="Storage limit" size={register("size")} unit={register("unit")} value={watch("size")} unitValue={watch("unit")} choices={Object.keys(units)} placeholder="Unlimited" autoFocus={!!onCancel}/>
 <label>Maximum objects<input {...register("objects")} inputMode="numeric" placeholder="Unlimited"/></label></div>
 <p className="hint">Leave a limit blank for unlimited.</p><FormErrors errors={errors}/>
 <div className="quota-actions">{onCancel&&<Button type="button" size="sm" variant="outline" onClick={onCancel}>Cancel</Button>}<Button size="sm">{isSubmitting?"Saving…":"Save quotas"}</Button></div></fieldset></form>
}
