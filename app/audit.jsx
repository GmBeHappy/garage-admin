"use client";
import {useFilter} from "./form";
import {useEffect,useState} from "react";
import {Button} from "../components/ui/button";
export default function Audit({refreshId}) {
  const [pages,setPages]=useState([0]),[result,setResult]=useState(null),[error,setError]=useState("");
  const {value:filter,input:filterInput}=useFilter(200);
  const cursor=pages.at(-1);
  useEffect(()=>{
    const controller=new AbortController();
    setResult(null);setError("");
    (async()=>{
      const res=await fetch("/api/audit?"+new URLSearchParams({before:String(cursor),q:filter}),{signal:controller.signal,cache:"no-store"});
      if(!res.ok)throw Error("Unable to load audit events");
      setResult(await res.json());
    })().catch(e=>{if(!controller.signal.aborted)setError(e.message)});
    return ()=>controller.abort();
  },[cursor,filter,refreshId]);
  return <><label>Search audit log<input {...filterInput} placeholder="Actor, action, resource or outcome" onChange={e=>{filterInput.onChange(e);setPages([0])}}/></label>
    {error && <p role="alert">{error}</p>}
    <div className="audit-table"><table><thead><tr>{["Time (UTC)","Administrator","Action","Resource","Outcome"].map(h=><th key={h}>{h}</th>)}</tr></thead>
    <tbody>{result?.events.map(e=><tr key={e.id}><td>{e.time.replace("T"," ").slice(0,19)}</td><td>{e.actor}</td><td>{e.action}</td><td>{e.target||"—"}</td><td>{e.outcome}</td></tr>)}</tbody></table>
    {!error&&!result && <p className="empty">Loading events…</p>}{result?.events.length===0 && <p className="empty">No matching events.</p>}</div>
    <div className="actions"><Button variant="outline" disabled={pages.length===1} onClick={()=>setPages(pages.slice(0,-1))}>Newer</Button><Button variant="outline" disabled={!result?.more} onClick={()=>setPages([...pages,result.events.at(-1).id])}>Older</Button></div></>;
}
