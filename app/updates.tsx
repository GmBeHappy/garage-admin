"use client";
import {useEffect,useState} from "react";
import {ArrowUpCircle,RefreshCw} from "lucide-react";
import {Button} from "../components/ui/button";
import type {Release} from "../lib/updates";
type State={direction?:string;worker:{current:string|null;phase:string;message:string;target:string|null}|null;ready:boolean;pending:boolean;revision:string|null;release?:Release};
export default function Updates(){
 const [data,setData]=useState<State|null>(null),[release,setRelease]=useState<Release|null>(null),[error,setError]=useState(""),[checking,setChecking]=useState(false),[requested,setRequested]=useState(false),[tick,setTick]=useState(0);
 const active=requested||!!data?.pending||data?.worker?.phase==="installing";
 useEffect(()=>{
   let live=true;
   async function check(status:boolean){
     if(!status)setChecking(true);
     try{
       const r=await fetch("/api/updates"+(status?"?status=1":""),{cache:"no-store"});const result=await r.json();
       if(!r.ok)throw Error(result.error);
       if(live){setData(prev=>({...result,direction:result.direction??prev?.direction}));if(result.release)setRelease(result.release);setError("");if(!result.pending&&result.worker?.phase!=="installing")setRequested(false)}
     }catch(e){if(live)setError(e instanceof Error?e.message:"Update check failed")}
     finally{if(live&&!status)setChecking(false)}
   }
   void check(false);
   const timer=setInterval(()=>void check(active),active?4000:10*60_000);
   return()=>{live=false;clearInterval(timer)}
 },[tick,active]);
 const blocked=data?.direction==="behind"||data?.direction==="diverged";
 const current=data?.worker?.current;
 const same=current?current===release?.digest:!!data?.revision&&data.revision===release?.revision;
 async function install(){
   if(!release||!confirm("Upgrade the console to "+release.digest.slice(0,19)+"? The UI will briefly restart."))return;
   setRequested(true);setError("");
   try{
     const r=await fetch("/api/updates",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({target:release.digest})});
     const out=await r.json();if(!r.ok)throw Error(out.error);
     setData(d=>d&&({...d,pending:true}));
   }catch(e){setRequested(false);setError(e instanceof Error?e.message:"Upgrade request failed")}
 }
 return <section className="panel update-panel"><div className="sectionhead"><h2>Console updates</h2><Button variant="outline" disabled={checking||active} onClick={()=>setTick(v=>v+1)}><RefreshCw size={15}/>Check now</Button></div>
 <p className="hint">Official Garage Admin image · latest channel</p>
 <dl><div><dt>Installed</dt><dd>{current||data?.revision||"Unknown build"}</dd></div><div><dt>Published</dt><dd>{release?.digest||"Checking…"}</dd></div></dl>
 {release&&<p role="status">{active?"Upgrade in progress…":same?"You’re up to date.":blocked?"The latest channel is older than or has diverged from this build.":"A published image is available."}</p>}
 {release?.revision&&<a href={"https://github.com/GmBeHappy/garage-admin/commit/"+release.revision} target="_blank" rel="noreferrer">View published commit ↗</a>}
 {data?.worker?.message&&<p className="hint">{data.worker.message}</p>}
 {data&&!data.ready&&<p className="hint">Enable the Compose host updater to install from the console. <a href="https://github.com/GmBeHappy/garage-admin#in-app-updates">Setup instructions ↗</a></p>}
 {error&&<p role="alert">{error}</p>}
 {data?.ready&&release&&!same&&!blocked&&<Button disabled={active||checking||!current} onClick={install}><ArrowUpCircle size={16}/>Upgrade console</Button>}
 </section>
}
