"use client";
import type {CorsRule} from "../lib/models";
import {errorMessage} from "../lib/models";

import {z} from "zod";
import {corsRules} from "../lib/forms";
import {useValidatedForm,FormErrors} from "./form";
import {Globe,Plus,X,ChevronDown,Trash2} from "lucide-react";
import {Button} from "../components/ui/button";
import {call} from "./console";

const presets:{name:string;methods:CorsRule["AllowedMethods"]}[]=[
  {name:"Read files",methods:["GET","HEAD"]},
  {name:"Read and upload",methods:["GET","HEAD","PUT","POST"]},
];
const newRule=():CorsRule=>({AllowedOrigins:[""],AllowedMethods:[...presets[0].methods]});
export default function Cors({initial,bucket,name,onSaved}:{initial:CorsRule[];bucket:string;name:string;onSaved:()=>void}){
  const {watch,setValue,reset,handleSubmit,setError,formState:{errors,isSubmitting}}=useValidatedForm(z.object({rules:corsRules}),{rules:initial.length?initial:[newRule()]});
  const rules=watch("rules");
  const setRules=(next:CorsRule[])=>setValue("rules",next,{shouldDirty:true,shouldValidate:!!errors.rules});
  function update(i:number,patch:Partial<CorsRule>){setRules(rules.map((r,n)=>n===i?{...r,...patch}:r))}
  const save=handleSubmit(async({rules:next})=>{
    if(!next.length&&!confirm("Remove all CORS rules from "+name+"?"))return;
    try{await call({bucket,kind:"cors",action:next.length?"save":"remove",value:next});onSaved()}
    catch(e){setError("root",{message:errorMessage(e)})}
  });
  return <form noValidate onSubmit={save}><fieldset className="cors-editor" disabled={isSubmitting}><div className="cors-top"><span>{initial.length} saved {initial.length===1?"rule":"rules"}</span><Button type="button" variant="outline" size="sm" onClick={()=>{setRules([...rules,newRule()])}}><Plus/>Add rule</Button></div>
  {rules.map((r,i)=>{const origins=r.AllowedOrigins?.length?r.AllowedOrigins:[""];
    return <section key={i} className="cors-rule"><div className="cors-head"><h3><Globe size={17}/>{r.ID||"Rule "+(i+1)}</h3><button type="button" aria-label={"Remove rule "+(i+1)} onClick={()=>{setRules(rules.filter((_,n)=>n!==i))}}><Trash2 size={16}/></button></div>
    <h4>Allowed origins</h4><p className="hint">Enter each website that can call this bucket. Use * for every origin.</p>
    {origins.map((origin,n)=><div className="cors-origin" key={n}><input aria-label={"Origin "+(n+1)+" for rule "+(i+1)} placeholder="https://app.example.com" value={origin} onChange={e=>update(i,{AllowedOrigins:origins.map((v,p)=>p===n?e.target.value:v)})}/>{origins.length>1&&<button type="button" aria-label={"Remove origin "+(n+1)} onClick={()=>update(i,{AllowedOrigins:origins.filter((_,p)=>p!==n)})}><X size={15}/></button>}</div>)}
    <button type="button" className="cors-add" onClick={()=>update(i,{AllowedOrigins:[...origins,""]})}><Plus size={14}/>Add origin</button>
    <h4>Browser access</h4><div className="cors-presets">{presets.map(p=><button type="button" key={p.name} aria-pressed={p.methods.length===r.AllowedMethods.length&&p.methods.every(m=>r.AllowedMethods.includes(m))} onClick={()=>update(i,{AllowedMethods:[...p.methods],...(p.name==="Read and upload"&&!r.AllowedHeaders?.length?{AllowedHeaders:["*"]}:{})})}>{p.name}<small>{p.methods.join(", ")}</small></button>)}</div>
    <details><summary>Customize methods, headers and cache</summary><div className="methods">{(["GET","HEAD","PUT","POST","DELETE"] as const).map(m=><label key={m}><input type="checkbox" checked={r.AllowedMethods.includes(m)} onChange={e=>update(i,{AllowedMethods:e.target.checked?[...r.AllowedMethods,m]:r.AllowedMethods.filter(v=>v!==m)})}/>{m}</label>)}</div>
    <div className="columns">{([["Allowed request headers","AllowedHeaders"],["Exposed response headers","ExposeHeaders"]] as const).map(([title,key])=><label key={key}>{title}<textarea rows={2} placeholder="One header per line" value={(r[key]||[]).join("\n")} onChange={e=>update(i,{[key]:e.target.value.split("\n")})}/></label>)}</div><div className="columns"><label>Preflight cache (seconds)<input type="number" min="0" step="1" value={r.MaxAgeSeconds??""} onChange={e=>update(i,{MaxAgeSeconds:e.target.value===""?undefined:Number(e.target.value)})}/></label><label>Rule ID (optional)<input value={r.ID||""} onChange={e=>update(i,{ID:e.target.value||undefined})}/></label></div></details>
    <FormErrors errors={Array.isArray(errors.rules)?errors.rules[i]:errors.rules}/></section>})}
    {!rules.length&&<p className="empty">All rules will be removed when you save.</p>}<FormErrors errors={errors.root}/>
    <div className="actions"><Button type="button" variant="outline" onClick={()=>reset()}>Reset edits</Button><Button type="submit" disabled={!rules.length&&!initial.length}>{isSubmitting?"Saving…":"Save CORS rules"}</Button></div></fieldset></form>
}
