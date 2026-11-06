"use client";
import type {Bucket as BucketRow,BucketInfo as Info,RefreshProps,AccessKey,CorsRule} from "../lib/models";
import {errorMessage} from "../lib/models";

import {useEffect,useState} from "react";
import {Folder,Globe,Timer,Settings2,Network,HardDrive,KeyRound,Tag,Layers,Pencil,ChevronDown} from "lucide-react";
import {Button} from "../components/ui/button";
import {bytes} from "../lib/file-types";
import {call,label} from "./console";
import Composition from "./composition";
import QuotaForm from "./quota-form";
import Cors from "./cors";
import Explorer from "./explorer";
import {ConfigForm} from "./config-fields";
import Settings from "./bucket-settings";

const sections=[["General",Settings2],["CORS",Network],["Lifecycle",Timer],["Website",Globe]] as const;
function BucketInfo({bucket,info,revision,refreshId,onQuotaSaved}:RefreshProps & {bucket:BucketRow;info:Info|null;revision:number;onQuotaSaved:(b:Info)=>void}){
 const [editing,setEditing]=useState(false),[saved,setSaved]=useState(false);
 return <section className="bucket-info" aria-label="Bucket information"><h2>Bucket information</h2>
 <Composition bucket={bucket.id} revision={revision} refreshId={refreshId}/>
 {info&&<><ul className="bucket-facts">{([[Layers,"Objects",info.objects],[HardDrive,"Storage used",bytes(info.bytes)],[KeyRound,"Assigned keys",info.keys.length],[Tag,"Global aliases",info.globalAliases.length]] as const).map(([Icon,title,v])=><li key={title}><Icon size={16}/><span>{title}</span><strong>{v}</strong></li>)}</ul>
 <div className="bucket-meta"><small>Created</small><span>{info.created.slice(0,10)}</span><small>Bucket ID</small><code>{info.id}</code></div>
 <details className="extra-details"><summary>More details<ChevronDown size={15}/></summary>
 <div className="detail-group"><div className="detail-heading"><h3>Quotas</h3>{!editing&&<Button size="sm" variant="ghost" aria-label="Edit quotas" onClick={()=>{setEditing(true);setSaved(false)}}><Pencil size={13}/>Edit</Button>}</div>
 {editing?<QuotaForm info={info} onCancel={()=>setEditing(false)} onSaved={updated=>{onQuotaSaved(updated);setEditing(false);setSaved(true)}}/>:
 <dl className="detail-rows"><div><dt>Storage quota</dt><dd>{info.quotas?.maxSize!=null?bytes(info.quotas.maxSize):"Unlimited"}</dd></div><div><dt>Object quota</dt><dd>{info.quotas?.maxObjects?.toLocaleString()??"Unlimited"}</dd></div></dl>}
 {saved&&<small role="status">Quotas saved</small>}</div>
 <dl className="detail-rows"><div><dt>Unfinished uploads</dt><dd>{info.unfinishedUploads}</dd></div><div><dt>Website access</dt><dd>{info.websiteAccess?"Enabled":"Disabled"}</dd></div></dl>
 {([[Tag,"Aliases",info.globalAliases],[KeyRound,"Assigned keys",info.keys.map(k=>k.name||k.accessKeyId)]] as const).map(([Icon,title,items])=><div className="detail-group" key={title}><h3><Icon size={14}/>{title}</h3><div className="detail-tags">{items.length?items.map((item,i)=><span key={i}>{item}</span>):<small>None</small>}</div></div>)}
 </details></>}
 </section>
}
export default function Bucket({bucket,keys,refreshId}:RefreshProps & {bucket:BucketRow;keys:AccessKey[]}){
 const [view,setView]=useState("Objects"),[section,setSection]=useState("General"),[info,setInfo]=useState<Info|null>(null),[value,setValue]=useState<unknown>(null),[error,setError]=useState(""),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false),[rev,setRev]=useState(0),[objectRev,setObjectRev]=useState(0);
 const kind=section.toLowerCase();
 useEffect(()=>{let active=true;setValue(null);setError("");
 (async()=>{
   const details=await call({op:"GetBucketInfo",query:{id:bucket.id}});
   if(!active)return;
   setInfo(details);
   if(view==="Objects"||section==="General")return;
   const out=await call({kind,bucket:details.id,action:"read"});
   if(active){setValue(out)}
 })().catch(e=>active&&setError(errorMessage(e)));
 return()=>{active=false}
 },[bucket.id,view,section,kind,rev,objectRev,refreshId]);
 async function act(fn:()=>Promise<unknown>,success?:string){setError("");setMsg("");setBusy(true);try{await fn();setRev(v=>v+1);if(success)setMsg(success)}catch(e){setError(errorMessage(e))}finally{setBusy(false)}}
 function quotaSaved(updated:Info){setInfo(updated);setRev(v=>v+1)}
 function change(set:(v:string)=>void,next:string){setValue(null);setError("");setMsg("");set(next)}
 const feedback=<>{error&&<p role="alert">{error}</p>}{msg&&<p role="status">{msg}</p>}</>;
 return <><div className="bucket-nav" aria-label="Bucket views">{([[Folder,"Objects"],[Settings2,"Settings"]] as const).map(([Icon,v])=><button key={v} aria-pressed={view===v} disabled={busy} onClick={()=>{if(view!==v)change(setView,v)}}><Icon size={16}/>{v}</button>)}</div>
 {view==="Objects"?<div className="bucket-workspace"><div className="bucket-files">{feedback}<Explorer bucket={bucket.id} refreshId={refreshId} onChange={()=>setObjectRev(n=>n+1)}/></div><BucketInfo onQuotaSaved={quotaSaved} bucket={bucket} info={info} revision={objectRev} refreshId={refreshId}/></div>:
 <section className="panel bucket-settings"><h2>Bucket settings</h2><div className="tabs">{sections.map(([s,Icon])=><button className={section===s?"chosen":""} disabled={busy} key={s} onClick={()=>{if(section!==s)change(setSection,s)}}><Icon size={15}/>{s}</button>)}</div>{feedback}
 {section==="General"&&info&&<Settings onQuotaSaved={updated=>{quotaSaved(updated);setMsg("Quotas saved")}} key={rev} info={info} keys={keys} act={act} busy={busy}/>}
 {value!==null&&section==="CORS"&&<><h3>Cross-origin resource sharing</h3><Cors initial={value as CorsRule[]} bucket={bucket.id} name={label(bucket)} onSaved={()=>{setMsg("CORS rules saved");setRev(v=>v+1)}}/></>}
 {value!==null&&["Lifecycle","Website"].includes(section)&&<ConfigForm key={section} tab={section} initial={value} bucket={bucket.id} onSaved={()=>{setMsg("Saved");setRev(v=>v+1)}} onDelete={()=>{if(!busy&&confirm("Delete "+section+" configuration for "+label(bucket)+"?"))act(()=>call({bucket:bucket.id,kind,action:"remove"}))}}/>}
 </section>}</>
}
