"use client";
import {errorMessage} from "../lib/models";

import {useState,useMemo} from "react";
import spec from "../lib/admin-spec.json";
import {resolve,operationFormSchema,paths,type Operation,type Schema} from "../lib/operation-schema";
import {useValidatedForm,FormErrors} from "./form";
import {call} from "./console";
import {Button} from "../components/ui/button";
const ops=Object.entries(paths).filter(([p])=>p.startsWith("/v2/")).map(([,entry])=>Object.values(entry)[0]!);
function sample(s:Schema|boolean|undefined):unknown{if(!s||typeof s==="boolean")return "";if(s.oneOf)return sample(s.oneOf.find(x=>x.type!=="null"));if(s.properties)return Object.fromEntries(Object.entries(s.properties).filter(([k])=>(s.required||[]).includes(k)).map(([k,v])=>[k,sample(v)]));if(s.type==="array")return [];if(s.type==="integer")return 0;if(s.type==="boolean")return false;return "";}
function RequestForm({op}:{op:Operation}){
 const [output,setOutput]=useState("");
 const raw=op.requestBody?.content?.["application/json"]?.schema;
 const schema=useMemo(()=>operationFormSchema(op),[op]);
 const {handleSubmit,register,formState:{errors,isSubmitting}}=useValidatedForm(schema,{query:{},body:raw?JSON.stringify(sample(resolve(raw)),null,2):""});
 const submit=handleSubmit(async({query,body})=>{
   if(paths["/v2/"+op.operationId].post&&!confirm("Run "+op.operationId+" on the live cluster?"))return;
   try{setOutput(JSON.stringify(await call({op:op.operationId,query,body:raw?body:undefined}),null,2))}
   catch(e){setOutput(errorMessage(e))}
 });
 return <form noValidate onSubmit={submit}><p className="hint">{op.description?.trim()}</p>{op.parameters?.map(p=><label key={p.name}>{p.name}{p.required?" *":""}<input {...register(`query.${p.name}`)} placeholder={p.description}/></label>)}{raw&&<><label>Request body<textarea {...register("body")}/></label><details><summary>Request fields</summary><pre>{JSON.stringify(resolve(raw),null,2)}</pre></details></>}<FormErrors errors={errors}/><Button disabled={isSubmitting}>{isSubmitting?"Running…":"Run operation"}</Button>{output&&<pre aria-live="polite">{output}</pre>}</form>
}
export default function Operations(){
 const [id,setId]=useState("GetClusterHealth");
 return <div className="panel"><h2>Garage Admin API</h2><label>Operation<select value={id} onChange={e=>setId(e.target.value)}>{[...new Set(ops.map(o=>o.tags[0]))].map(tag=><optgroup key={tag} label={tag}>{ops.filter(o=>o.tags[0]===tag).map(o=><option key={o.operationId}>{o.operationId}</option>)}</optgroup>)}</select></label><RequestForm key={id} op={ops.find(o=>o.operationId===id)!}/></div>
}
