"use client";
import {z} from "zod";
import {website,lifecycle,parseJson} from "../lib/forms";
import {FormErrors,useValidatedForm} from "./form";
import {Button} from "../components/ui/button";
import {call} from "./console";
function update(value:string,set:(s:string)=>void,field:string,text:Record<string,string>|null){
 let obj;try{obj=JSON.parse(value)}catch{return}
 if(text)obj[field]=text;else delete obj[field];
 set(JSON.stringify(obj,null,2));
}
export default function ConfigFields({tab,text,setText}:{tab:string;text:string;setText:(s:string)=>void}){
 let obj;try{obj=JSON.parse(text)}catch{}
 const write=(next:unknown)=>setText(JSON.stringify(next,null,2));
 const rules=Array.isArray(obj)?obj:[];
 return <>{tab==="Website"&&obj&&<div className="columns">{([["Index document","IndexDocument","Suffix"],["Error document","ErrorDocument","Key"]] as const).map(([name,key,prop])=><label key={key}>{name}<input value={obj[key]?.[prop]||""} onChange={e=>update(text,setText,key,e.target.value?{[prop]:e.target.value}:null)}/></label>)}</div>}
 {tab==="Lifecycle"&&Array.isArray(obj)&&<>{rules.map((r,i)=>{function field(k:string,v:unknown){write(rules.map((rule,n)=>n===i?{...rule,[k]:v}:rule))}return <div className="rule" key={i}><div className="sectionhead"><h3>{r.ID||"Lifecycle rule "+(i+1)}</h3><button type="button" onClick={()=>write(rules.filter((_,n)=>n!==i))}>Remove</button></div><div className="columns"><label>Rule name<input value={r.ID||""} onChange={e=>field("ID",e.target.value)}/></label><label>Status<select value={r.Status} onChange={e=>field("Status",e.target.value)}><option>Enabled</option><option>Disabled</option></select></label></div>{(!r.Filter||!Object.keys(r.Filter).some(k=>k!=="Prefix"))&&<label>Object prefix<input value={r.Filter?.Prefix||""} onChange={e=>field("Filter",{Prefix:e.target.value})}/></label>}{r.Expiration?.Days!=null&&<label>Expire after (days)<input type="number" min="1" value={r.Expiration.Days} onChange={e=>field("Expiration",{...r.Expiration,Days:Number(e.target.value)})}/></label>}{r.AbortIncompleteMultipartUpload&&<label>Abort incomplete uploads after (days)<input type="number" min="1" value={r.AbortIncompleteMultipartUpload.DaysAfterInitiation} onChange={e=>field("AbortIncompleteMultipartUpload",{DaysAfterInitiation:Number(e.target.value)})}/></label>}</div>})}<div className="actions"><button type="button" onClick={()=>write([...rules,{ID:"",Status:"Enabled",Filter:{Prefix:""},Expiration:{Days:30}}])}>+ Expiration rule</button><button type="button" onClick={()=>write([...rules,{ID:"",Status:"Enabled",Filter:{Prefix:""},AbortIncompleteMultipartUpload:{DaysAfterInitiation:7}}])}>+ Upload cleanup rule</button></div></>}
 <details open={!obj}><summary>Advanced JSON</summary><label>{tab} configuration<textarea rows={8} value={text} onChange={e=>setText(e.target.value)}/></label></details></>
}

export function ConfigForm({tab,initial,bucket,onSaved,onDelete}:{tab:string;initial:unknown;bucket:string;onSaved:()=>void;onDelete:()=>void}){
 const schema=tab==="Website"?website:lifecycle;
 const form=useValidatedForm(z.object({text:parseJson.pipe(schema)}),{text:JSON.stringify(initial,null,2)});
 const text=form.watch("text");
 const submit=form.handleSubmit(async({text:value})=>{
   try{await call({bucket,kind:tab.toLowerCase(),action:"save",value});onSaved()}
   catch(err){form.setError("root",{message:err instanceof Error?err.message:String(err)})}
 });
 return <form noValidate onSubmit={submit}><fieldset disabled={form.formState.isSubmitting}>
   <ConfigFields tab={tab} text={text} setText={s=>form.setValue("text",s,{shouldDirty:true,shouldValidate:!!form.formState.errors.text})}/>
   <FormErrors errors={form.formState.errors}/><div className="actions"><Button type="button" variant="outline" onClick={onDelete}>Delete configuration</Button><Button>Save configuration</Button></div>
 </fieldset></form>
}
