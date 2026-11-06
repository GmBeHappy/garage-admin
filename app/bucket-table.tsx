"use client";
import type {RefreshProps,Usage,Bucket} from "../lib/models";
import {useEffect,useState} from "react";
import {Database,ChevronRight} from "lucide-react";
import {bytes} from "../lib/file-types";
import {label} from "./console";

function Usage({data}:{data?:Usage|null}){
  if(!data)return <small>Usage unavailable</small>;
  const {maxSize,maxObjects}=data.quotas||{};
  const percent=maxSize!=null&&maxSize>0?data.bytes/maxSize*100:data.bytes>0?100:0;
  return <div className="usage-cell">
    <span>{bytes(data.bytes)} <small>/ {maxSize==null?"Unlimited":bytes(maxSize)}</small></span>
    {maxSize!=null&&<><progress aria-label="Storage quota used" value={Math.min(100,percent)} max="100"/><small>{Math.round(percent)}% used</small></>}
    {maxObjects!=null&&<small>{data.objects.toLocaleString()} / {maxObjects.toLocaleString()} objects</small>}
  </div>
}
export default function BucketTable({items,onSelect,refreshId}:RefreshProps & {items:Bucket[];onSelect:(bucket:Bucket)=>void}){
  const [usage,setUsage]=useState<Record<string,Usage|null>|null>(null),[error,setError]=useState("");
  useEffect(()=>{const controller=new AbortController();setUsage(null);setError("");
    fetch("/api/bucket-usage",{signal:controller.signal,cache:"no-store"}).then(async r=>{
      if(!r.ok)throw Error("Unable to load bucket usage. Use Refresh to retry.");
      const result=await r.json();if(!controller.signal.aborted)setUsage(result)
    }).catch(e=>{if(!controller.signal.aborted)setError(e.message)});
    return()=>controller.abort()
  },[refreshId]);
  return <>{error&&<p role="alert">{error}</p>}<div className="table usage-table">
    <div className="tr th"><span>Bucket name</span><span>Storage / quota</span><span>Created</span><span/></div>
    {items.map(b=><button className="tr" key={b.id} onClick={()=>onSelect(b)}><span><Database size={17}/><strong>{label(b)}</strong></span>
      {usage||error?<Usage data={usage?.[b.id]}/>:<small>Loading usage…</small>}
      <span>{b.created.slice(0,10)}</span><ChevronRight size={15}/></button>)}
    {!items.length&&<p className="empty">No matching buckets.</p>}
  </div></>
}
