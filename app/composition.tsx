"use client";
import type {Groups,RefreshProps} from "../lib/models";
import {errorMessage} from "../lib/models";

import {useEffect,useState} from "react";
import {ChartNoAxesColumn} from "lucide-react";
import {bytes,types} from "../lib/file-types";
import {call} from "./console";
import {Button} from "../components/ui/button";
export default function Composition({bucket,revision,refreshId}:RefreshProps & {bucket:string;revision:number}){
 const [groups,setGroups]=useState<Groups|null>(null),[running,setRunning]=useState(false),[error,setError]=useState("");
 const [attempt,setAttempt]=useState(0);
 useEffect(()=>{
   const controller=new AbortController();
   async function scan(){
     setRunning(true);setError("");setGroups(null);
     try{
       const totals:Groups={};let token:string|undefined;
       do{
         const page=await call({bucket,kind:"composition",action:"scan",token},controller.signal);
         if(controller.signal.aborted)return;
         for(const [name,g] of Object.entries(page.groups)){
           const t=totals[name]||={bytes:0,count:0};t.bytes+=g.bytes;t.count+=g.count;
         }
         setGroups({...totals});token=page.next;
       }while(token);
     }catch(e){if(!controller.signal.aborted)setError(errorMessage(e))}
     finally{if(!controller.signal.aborted)setRunning(false)}
   }
   scan();
   return ()=>controller.abort();
 },[bucket,revision,refreshId,attempt]);
 const rows=Object.entries(groups||{}).sort((a,b)=>b[1].bytes-a[1].bytes),size=rows.reduce((s,[,g])=>s+g.bytes,0),count=rows.reduce((s,[,g])=>s+g.count,0);
 return <section className="composition"><div className="sectionhead"><h3><ChartNoAxesColumn size={17}/>File types</h3>{running&&<small role="status">Analyzing…</small>}{error&&<Button size="sm" variant="outline" onClick={()=>setAttempt(n=>n+1)}>Retry</Button>}</div>{groups?<><p className="hint">{bytes(size)} · {count.toLocaleString()} files{running?" scanned so far":error?" · partial scan":""}</p><div className="type-bar">{rows.map(([n,g])=><i key={n} style={{width:(size?100*g.bytes/size:100*g.count/count)+"%",background:types[n as keyof typeof types].color}}/>)}</div><div className="legend">{rows.map(([n,g])=><span key={n}><i style={{background:types[n as keyof typeof types].color}}/>{n} <b>{size?(100*g.bytes/size).toFixed(1):"0"}%</b><small>{g.count} files · {bytes(g.bytes)}</small></span>)}</div></>:<p className="hint">Calculating storage by file type…</p>}{error&&<p role="alert">{error}</p>}</section>
}
