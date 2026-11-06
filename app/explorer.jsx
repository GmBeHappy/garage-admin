"use client";
import {useFilter} from "./form";
import {useEffect,useState} from "react";
import {Folder,FolderPlus,Image as Picture,FileText,FileCode,FileArchive,File,Film,Database,Upload,List,Grid2X2,Trash2,ChevronRight,HardDrive} from "lucide-react";
import {Button} from "../components/ui/button";
import {call} from "./console";
import {bytes,fileType,types} from "../lib/file-types";
import ObjectForms from "./object-forms";
import ObjectPreview from "./object-preview";
const icons={Images:Picture,Documents:FileText,Code:FileCode,Archives:FileArchive,Media:Film,Data:Database,Other:File};
export default function Explorer({bucket,refreshId,onChange}){
 const [folder,setFolder]=useState(""),[view,setView]=useState("list"),[pages,setPages]=useState([undefined]),[data,setData]=useState(null),[rev,setRev]=useState(0),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const [preview,setPreview]=useState(null);
 const {value:search,input:searchInput,clear:clearSearch}=useFilter();
 const token=pages.at(-1);
 useEffect(()=>{setView(localStorage.getItem("garage-file-view")==="grid"?"grid":"list")},[]);
 useEffect(()=>{let active=true;setError("");setData(null);
 call({bucket,kind:"objects",action:"browse",prefix:folder+search,token}).then(out=>{if(active)setData(out)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[bucket,folder,search,token,rev,refreshId]);
 function navigate(path){setData(null);setFolder(path);clearSearch();setPages([undefined])}
 function url(key){return "/api/object?"+new URLSearchParams({bucket,key})}
 async function change(key,options){setBusy(true);setError("");try{const r=await fetch(url(key),options);if(!r.ok)throw Error(await r.text());setPages([undefined]);setRev(v=>v+1);onChange();return true}catch(e){setError(e.message);return false}finally{setBusy(false)}}
 const rows=data?[...data.folders.map(key=>({key,dir:true})),...data.items.filter(o=>!(o.Key===folder&&o.Size===0)).map(o=>({key:o.Key,size:o.Size,date:o.LastModified}))]:[];
 const parts=folder?folder.slice(0,-1).split("/"):[];
 return <><div className="filetools"><div className="crumbs"><button onClick={()=>navigate("")}><HardDrive size={15}/>Bucket root</button>{parts.map((p,i)=><span key={i}><ChevronRight size={12}/><button onClick={()=>navigate(parts.slice(0,i+1).join("/")+"/")}>{p||"/"}</button></span>)}</div><div className="view-switch">{[[List,"list"],[Grid2X2,"grid"]].map(([Icon,v])=><button aria-label={v+" view"} aria-pressed={view===v} key={v} onClick={()=>{setView(v);localStorage.setItem("garage-file-view",v)}}><Icon size={16}/></button>)}</div></div>
 <div className="filetools"><input aria-label="Filter folder" placeholder="Filter by name prefix…" {...searchInput} onChange={e=>{setPages([undefined]);searchInput.onChange(e)}}/><ObjectForms folder={folder} change={change} busy={busy}/></div>
 {error&&<p role="alert">{error}</p>}<div className={"files "+view}>{view==="list"&&<div className="filehead"><span>Name</span><span>Size</span><span>Modified (UTC)</span><span/></div>}{rows.map(r=>{const type=fileType(r.key),Icon=r.dir?Folder:icons[type],name=r.key.slice(folder.length).replace(/\/$/,"")||"/";return <div className="fileitem" key={(r.dir?"d":"f")+r.key}>{r.dir?<button className="filename" onClick={()=>navigate(r.key)}><Icon className="folder-icon"/><span>{name}</span></button>:<button className="filename" aria-label={"Preview "+name} onClick={()=>setPreview(r)}><Icon style={{color:types[type].color}}/><span>{name}</span></button>}<small>{r.dir?"Folder":bytes(r.size)}</small><small>{r.date?new Date(r.date).toISOString().slice(0,10):"—"}</small>{!r.dir&&<button aria-label={"Delete "+name} disabled={busy} onClick={()=>{if(confirm("Delete "+r.key+"?"))change(r.key,{method:"DELETE"})}}><Trash2 size={15}/></button>}</div>})}</div>
 {!error&&(!data||!rows.length)&&<p className="empty">{data?"This folder has no matching items.":"Loading folder…"}</p>}{(pages.length>1||data?.next)&&<div className="actions"><Button variant="outline" disabled={pages.length===1} onClick={()=>setPages(pages.slice(0,-1))}>Previous</Button><Button variant="outline" disabled={!data?.next} onClick={()=>setPages([...pages,data.next])}>Next</Button></div>}{preview&&<ObjectPreview key={preview.key} file={preview} url={url(preview.key)} onClose={()=>setPreview(null)}/>}</>
}
