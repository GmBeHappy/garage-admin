"use client";
import {useEffect,useRef,useState} from "react";
import {Upload,FolderUp,FolderPlus} from "lucide-react";
import {Button} from "../../ui/button";
import {folderSchema} from "../../../lib/forms";
import {bytes} from "../../../lib/file-types";
import {FormErrors,useValidatedForm} from "../../ui/form";
type Picked={file:File;path:string};
// Walk a dropped file or directory entry, keeping each file's path relative to the drop.
async function walk(entry:FileSystemEntry,base=""):Promise<Picked[]>{
 if(entry.isFile)return [{file:await new Promise<File>((ok,fail)=>(entry as FileSystemFileEntry).file(ok,fail)),path:base+entry.name}];
 const reader=(entry as FileSystemDirectoryEntry).createReader(),out:Picked[]=[];
 // readEntries returns results in batches; keep reading until it returns an empty batch.
 for(;;){
  const batch=await new Promise<FileSystemEntry[]>((ok,fail)=>reader.readEntries(ok,fail));
  if(!batch.length)return out;
  for(const child of batch)out.push(...await walk(child,base+entry.name+"/"));
 }
}
function dropped(data:DataTransfer):Promise<Picked[]>{
 // Entries must be taken synchronously inside the drop event; reading them can happen later.
 const entries=[...data.items].filter(i=>i.kind==="file").map(i=>i.webkitGetAsEntry());
 if(entries.length&&entries.every(Boolean))return Promise.all(entries.map(e=>walk(e!))).then(r=>r.flat());
 return Promise.resolve([...data.files].map(file=>({file,path:file.name})));
}
const hasFiles=(e:DragEvent)=>!!e.dataTransfer?.types.includes("Files");
type Upload=(items:{key:string;file:File}[],progress:(done:number)=>void)=>Promise<string[]>;
export default function ObjectForms({folder,busy,change,upload,limit}:{folder:string;busy:boolean;limit:number;change:(key:string,options:RequestInit)=>Promise<boolean>;upload:Upload}){
 const [open,setOpen]=useState(false),[progress,setProgress]=useState<{done:number;total:number}|null>(null),[problems,setProblems]=useState<string[]>([]);
 const dir=useValidatedForm(folderSchema,{name:""});
 const create=dir.handleSubmit(async({name})=>{
   if(await change(folder+name+"/",{method:"PUT",body:new Blob([])})){dir.reset();setOpen(false)}
 });
 const [dragging,setDragging]=useState(false),state=useRef({busy,send});
 state.current={busy,send};
 useEffect(()=>{
  // Listen on the whole window while the bucket view is open, so a drop anywhere uploads
  // into the current folder instead of the browser navigating to the file.
  let depth=0;
  const enter=(e:DragEvent)=>{if(!hasFiles(e))return;e.preventDefault();depth++;setDragging(true)};
  const leave=(e:DragEvent)=>{if(!hasFiles(e))return;if(--depth<=0){depth=0;setDragging(false)}};
  const over=(e:DragEvent)=>{if(!hasFiles(e))return;e.preventDefault();e.dataTransfer!.dropEffect=state.current.busy?"none":"copy"};
  const drop=(e:DragEvent)=>{
   if(!hasFiles(e))return;e.preventDefault();depth=0;setDragging(false);
   if(state.current.busy)return;
   dropped(e.dataTransfer!).then(files=>state.current.send(files),err=>setProblems(["Could not read the dropped items: "+(err?.message||err)]));
  };
  window.addEventListener("dragenter",enter);window.addEventListener("dragleave",leave);window.addEventListener("dragover",over);window.addEventListener("drop",drop);
  return ()=>{window.removeEventListener("dragenter",enter);window.removeEventListener("dragleave",leave);window.removeEventListener("dragover",over);window.removeEventListener("drop",drop)};
 },[]);
 async function send(files:Picked[]){
   if(!files.length)return;
   const large=files.filter(f=>f.file.size>limit),items=files.filter(f=>f.file.size<=limit).map(f=>({key:folder+f.path,file:f.file}));
   const skipped=large.map(f=>f.path+": larger than the "+bytes(limit)+" upload limit");
   setProblems([]);
   if(!items.length){setProblems(skipped);return}
   const total=items.reduce((n,i)=>n+i.file.size,0);
   const what=items.length===1?items[0].key.slice(folder.length):items.length+" files ("+bytes(total)+")";
   if(!confirm("Upload "+what+" to "+(folder||"the bucket root")+"?"+(skipped.length?"\n\n"+skipped.length+" file(s) over "+bytes(limit)+" will be skipped.":"")+"\n\nExisting files with the same names will be replaced."))return;
   setProgress({done:0,total:items.length});
   const failed=await upload(items,done=>setProgress({done,total:items.length}));
   setProgress(null);setProblems([...skipped,...failed]);
 }
 // Folder picks carry a relative path ("photos/2024/a.jpg"); plain file picks only a name.
 const picker=(e:React.ChangeEvent<HTMLInputElement>)=>{const files=[...e.target.files||[]].map(file=>({file,path:file.webkitRelativePath||file.name}));send(files).finally(()=>{e.target.value=""})};
 return <><Button variant="outline" disabled={busy} onClick={()=>{dir.reset();setOpen(!open)}}><FolderPlus/>New folder</Button>
 <label className="upload upload-secondary" aria-disabled={busy}><FolderUp size={15}/>Upload folder<input type="file" disabled={busy} ref={el=>el?.setAttribute("webkitdirectory","")} onChange={picker}/></label>
 <label className="upload" aria-disabled={busy}><Upload size={15}/>Upload files<input type="file" multiple disabled={busy} onChange={picker}/></label>
 {dragging&&<div className="drop-zone" aria-hidden><div><Upload size={34}/><strong>{busy?"Wait for the current operation to finish":"Drop files or folders to upload"}</strong><small>to {folder||"the bucket root"}</small></div></div>}
 {progress&&<p className="upload-status" role="status">Uploading… {progress.done} of {progress.total} done</p>}
 {problems.length>0&&<div role="alert" className="upload-status">{problems.length} file{problems.length>1?"s were":" was"} not uploaded:<ul>{problems.slice(0,10).map(p=><li key={p}>{p}</li>)}</ul>{problems.length>10&&"…and "+(problems.length-10)+" more."}</div>}
 {open&&<form noValidate className="object-form" onSubmit={create}><label>Folder name<input autoFocus {...dir.register("name")}/></label><FormErrors errors={dir.formState.errors}/><div className="actions"><Button type="button" variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={busy}>Create folder</Button></div></form>}</>
}
