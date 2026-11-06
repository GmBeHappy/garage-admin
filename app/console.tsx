"use client";
import type {Dashboard,Bucket as BucketRow,Responses,Query,StorageInput,FolderPage,Groups} from "../lib/models";
import {errorMessage} from "../lib/models";

import {useFilter} from "./form";
import {useState, useEffect} from "react";
import {LayoutDashboard, Database, KeyRound, Network, Terminal, ArrowUpRight, ChevronRight, Search, Plus, Layers, ShieldCheck, LogOut, RefreshCw, ArrowUpCircle, HardDrive, Box, Server} from "lucide-react";
import {Button} from "../components/ui/button";
import Bucket from "./bucket";
import BucketTable from "./bucket-table";
import CreateForm from "./create-form";
import Cluster from "./cluster";
import {ThemeSwitch} from "./theme";
import KeyList from "./key-list";
import Updates from "./updates";
import Authentication from "./authentication";
import Audit from "./audit";
import Operations from "./operations";

type AdminInput={op:string;query?:Query;body?:unknown};
export function call<K extends keyof Responses>(input:AdminInput & {op:K},signal?:AbortSignal):Promise<Responses[K]>;
export function call(input:StorageInput & {kind:"objects"},signal?:AbortSignal):Promise<FolderPage>;
export function call(input:StorageInput & {kind:"composition"},signal?:AbortSignal):Promise<{groups:Groups;next?:string}>;
export function call(input:AdminInput|StorageInput,signal?:AbortSignal):Promise<unknown>;
export async function call(input:AdminInput|StorageInput,signal?:AbortSignal) {
  const res = await fetch("/api/control",{signal,method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});
  const data = await res.json();
  if (!res.ok) throw Error(data.error || "Request failed");
  return data;
}
export const label = (b:BucketRow) => b.globalAliases?.[0] || b.localAliases?.[0]?.alias || b.id;
const menu = [["Overview",LayoutDashboard],["Buckets",Database],["Access keys",KeyRound],["Cluster",Network],["Admin operations",Terminal],["Audit log",ShieldCheck],["Authentication",KeyRound],["Updates",ArrowUpCircle]] as const;
function Rack() {return <svg className="rack" aria-hidden="true" viewBox="0 0 260 155"><defs><pattern id="dots" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#66858e"/></pattern></defs><rect width="260" height="155" fill="url(#dots)"/>{[76,53,30].map((y,i)=><g key={y} transform={'translate(47 '+y+')'} strokeLinejoin="round"><path d="M0 26 77 0 156 25 79 54Z" fill={i===2?"#e9f8fb":"#7299a2"} stroke="#94bec8"/><path d="m0 26 79 28v17L0 43Z" fill="#426572" stroke="#a6c7ca"/><path d="m79 54 77-29v17L79 71Z" fill="#253f4d" stroke="#a6c7ca"/><path d="m12 35 40 14" stroke="#ffaf48" strokeWidth="3"/><circle cx="135" cy="40" r="2" fill="#65ddda"/></g>)}</svg>}
export default function Console({initial,user}:{initial:Dashboard;user:string}) {
  const [data,setData]=useState(initial),[tab,setTab]=useState("Overview"),[bucket,setBucket]=useState<BucketRow|null>(null),[error,setError]=useState(""),[create,setCreate]=useState(""),[busy,setBusy]=useState(false);
  const {value:filter,input:filterInput,clear:clearFilter}=useFilter();
  const {health,cluster,buckets,keys}=data;
  function nav(t:string){setTab(t);setBucket(null);setError("");clearFilter();setCreate("")}
  async function refresh(){const [buckets,keys,health,cluster]=await Promise.all([call({op:"ListBuckets"}),call({op:"ListKeys"}),call({op:"GetClusterHealth"}),call({op:"GetClusterStatus"})]);setData({buckets,keys,health,cluster})}
  async function run(fn:()=>Promise<unknown>){setError("");setBusy(true);try{await fn()}catch(e){setError(errorMessage(e))}finally{setBusy(false)}}
  function select(b:BucketRow){setBucket(b);setTab("Buckets");setError("")}
  const visible=buckets.filter(b=>label(b).toLowerCase().includes(filter.toLowerCase()));
  function table(items:BucketRow[]){return <div className="table"><div className="tr th"><span>Bucket name</span><span>Created</span><span/></div>{items.map(b=><button className="tr" onClick={()=>select(b)} key={b.id}><span><Database size={17}/><strong>{label(b)}</strong></span><span>{new Date(b.created).toISOString().slice(0,10)}</span><ChevronRight size={16}/></button>)}{!items.length && <p className="empty">No matching buckets.</p>}</div>}
  return <div className="shell"><aside><div className="brand"><img src="/garage.svg" alt="" />Garage<span>Console</span></div><div className="navlabel">WORKSPACE</div><nav>{menu.map(([name,Icon])=><button className={tab===name?"active":""} key={name} onClick={()=>nav(name)}><Icon size={17}/>{name}</button>)}</nav><form className="account" action="/auth/logout" method="post"><span className="avatar">{user.slice(0,1).toUpperCase()}</span><span>{user}<small>Administrator</small></span><button aria-label="Sign out"><LogOut size={16}/></button></form></aside>
  <main><header><span className="breadcrumb">Workspace <ChevronRight size={13}/><b>{tab}</b></span><div className="header-tools"><ThemeSwitch/><span className="status"><i/>{health.status}</span></div></header>
  <section className="page" key={tab+(bucket?.id||"")}><div className="title"><div><h1>{bucket?label(bucket):tab==="Overview"?"Cluster overview":tab==="Cluster"?"Cluster dashboard":tab}</h1></div><Button variant="outline" size="sm" disabled={busy} onClick={()=>run(refresh)}><RefreshCw size={14}/>Refresh</Button></div>
  {error && <div role="alert">{error}</div>}
  {tab==="Overview" && <><div className="hero"><div><span className="heroTag"><i/>Live cluster</span><h2>Storage health</h2><p>{health.storageNodesUp} of {health.storageNodes} storage nodes online</p><button onClick={()=>nav("Cluster")}>View cluster <ArrowUpRight size={14}/></button></div><Rack/></div><div className="metrics">{([[Database,"Buckets",buckets.length,"Buckets"],[KeyRound,"Access keys",keys.length,"Access keys"],[Layers,"Healthy partitions",health.partitionsAllOk+" / "+health.partitions,"Cluster"]] as const).map(([Icon,name,n,t])=><button key={name} onClick={()=>nav(t)}><Icon size={18}/><small>{name}</small><strong>{n}</strong></button>)}</div><div className="sectionhead"><h2>Recent buckets</h2><button onClick={()=>nav("Buckets")}>View all <ChevronRight size={14}/></button></div>{table([...buckets].sort((a,b)=>b.created.localeCompare(a.created)).slice(0,6))}</>}
  {tab==="Buckets" && (bucket?<><button className="back" onClick={()=>setBucket(null)}>← All buckets</button><Bucket key={bucket.id} bucket={bucket} keys={keys} refreshId={data}/></>:<><div className="toolbar"><label className="search"><Search size={16}/><input placeholder="Search buckets" {...filterInput}/></label><Button onClick={()=>setCreate("bucket")}><Plus size={15}/>Create bucket</Button></div><BucketTable items={visible} onSelect={select} refreshId={data}/></>)}
  {tab==="Access keys" && <><div className="toolbar"><h2>{keys.length} access keys</h2><Button onClick={()=>setCreate("key")}><Plus size={16}/>Create key</Button></div><KeyList keys={keys}/></>}
  {tab==="Cluster" && <Cluster data={data}/>}
  {tab==="Admin operations" && <Operations/>}
  {tab==="Updates" && <Updates/>}
  {tab==="Authentication" && <Authentication refreshId={data}/>}
  {tab==="Audit log" && <Audit refreshId={data}/>}
  {create && <CreateForm kind={create} close={()=>setCreate("")} onCreated={refresh}/>}
  </section></main></div>
}
