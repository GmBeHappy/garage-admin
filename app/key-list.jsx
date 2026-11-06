"use client";
import {useFilter} from "./form";
import {useState,useRef,useEffect} from "react";
import {Eye,EyeOff,KeyRound,Copy} from "lucide-react";
import {Button} from "../components/ui/button";
import {call} from "./console";
export default function KeyList({keys}){
 const [shown,setShown]=useState(null),[busy,setBusy]=useState(""),[error,setError]=useState(""),[copied,setCopied]=useState(false);
 const {value:filter,input:filterInput}=useFilter();
 const generation=useRef(0);
 function hide(){generation.current++;setShown(null);setBusy("");setCopied(false)}
 useEffect(()=>{if(!shown)return;const t=setTimeout(hide,60000);return()=>clearTimeout(t)},[shown]);
 async function reveal(k){
   hide();setError("");const version=generation.current;setBusy(k.id);
   try{const out=await call({op:"GetKeyInfo",query:{id:k.id,showSecretKey:true}});if(!out.secretAccessKey)throw Error("Garage did not return a secret for this key.");if(version===generation.current)setShown({id:k.id,secret:out.secretAccessKey})}
   catch(e){if(version===generation.current)setError(e.message)}finally{if(version===generation.current)setBusy("")}
 }
 const rows=keys.filter(k=>(k.name+" "+k.id).toLowerCase().includes(filter.toLowerCase()));
 return <><input aria-label="Search access keys" placeholder="Search by key name or ID" {...filterInput} onChange={e=>{hide();filterInput.onChange(e)}}/>{error&&<p role="alert">{error}</p>}{rows.map(k=><section className="key-card panel" key={k.id}><div className="key-heading"><KeyRound size={19}/><strong>{k.name}</strong><small>{k.expired?"Expired":"Active"}</small></div><div className="key-line"><code>{k.id}</code><Button size="sm" variant="outline" disabled={!!busy} onClick={()=>shown?.id===k.id?hide():reveal(k)}>{shown?.id===k.id?<EyeOff/>:<Eye/>}{shown?.id===k.id?"Hide secret":busy===k.id?"Loading…":"Reveal secret"}</Button></div>{shown?.id===k.id&&<div className="key-line revealed"><code>{shown.secret}</code><Button size="sm" variant="outline" onClick={async()=>{try{await navigator.clipboard.writeText(shown.secret);setCopied(true)}catch{setError("Copy unavailable. Select the displayed secret to copy it.")}}}><Copy/>{copied?"Copied":"Copy"}</Button></div>}</section>)}{!rows.length&&<p className="empty">No matching keys.</p>}</>
}
