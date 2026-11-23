"use client";
import type {RefreshProps} from "../../lib/models";
import type {AuditEvent} from "../../lib/db/audit";
import {useFilter} from "../ui/form";
import {useEffect,useState} from "react";
import {ChevronLeft,ChevronRight,ChevronsLeft,ChevronsRight} from "lucide-react";
import {Button} from "../ui/button";
interface Result {events:AuditEvent[]; total:number; page:number; pages:number; size:number}
export default function Audit({refreshId}:RefreshProps) {
  const [page,setPage]=useState(1),[size,setSize]=useState(50),[result,setResult]=useState<Result|null>(null),[error,setError]=useState("");
  const {value:filter,input:filterInput}=useFilter(200);
  useEffect(()=>{
    const controller=new AbortController();
    setError("");
    (async()=>{
      const res=await fetch("/api/audit?"+new URLSearchParams({page:String(page),size:String(size),q:filter}),{signal:controller.signal,cache:"no-store"});
      if(!res.ok)throw Error("Unable to load audit events");
      const data:Result=await res.json();
      setResult(data);
      if(data.page!==page)setPage(data.page);
    })().catch(e=>{if(!controller.signal.aborted)setError(e.message)});
    return ()=>controller.abort();
  },[page,size,filter,refreshId]);
  const current=result?.page??page,pages=result?.pages??1,first=result&&result.total?(current-1)*result.size+1:0;
  const go=(n:number)=>setPage(Math.min(Math.max(1,n),pages));
  return <><label>Search audit log<input {...filterInput} placeholder="Actor, action, resource or outcome" onChange={e=>{filterInput.onChange(e);setPage(1)}}/></label>
    {error && <p role="alert">{error}</p>}
    <div className="audit-table"><table><thead><tr>{["Time (UTC)","Administrator","Action","Resource","Outcome"].map(h=><th key={h}>{h}</th>)}</tr></thead>
    <tbody>{result?.events.map(e=><tr key={e.id}><td>{e.time.replace("T"," ").slice(0,19)}</td><td>{e.actor}</td><td>{e.action}</td><td>{e.target||"—"}</td><td>{e.outcome}</td></tr>)}</tbody></table>
    {!error&&!result && <p className="empty">Loading events…</p>}{result?.events.length===0 && <p className="empty">No matching events.</p>}</div>
    <div className="pager" role="navigation" aria-label="Audit log pages">
      <small aria-live="polite">{result?`Showing ${first.toLocaleString()}–${(first?first+result.events.length-1:0).toLocaleString()} of ${result.total.toLocaleString()}`:""}</small>
      <label>Rows per page<select value={size} onChange={e=>{setSize(Number(e.target.value));setPage(1)}}>{[25,50,100].map(n=><option key={n}>{n}</option>)}</select></label>
      <div className="pager-buttons">
        <Button size="sm" variant="outline" aria-label="First page" disabled={current<=1} onClick={()=>go(1)}><ChevronsLeft/></Button>
        <Button size="sm" variant="outline" aria-label="Previous page" disabled={current<=1} onClick={()=>go(current-1)}><ChevronLeft/></Button>
        <span>Page {current} of {pages}</span>
        <Button size="sm" variant="outline" aria-label="Next page" disabled={current>=pages} onClick={()=>go(current+1)}><ChevronRight/></Button>
        <Button size="sm" variant="outline" aria-label="Last page" disabled={current>=pages} onClick={()=>go(pages)}><ChevronsRight/></Button>
      </div>
    </div></>;
}
