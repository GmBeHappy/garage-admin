"use client";
import {useState} from "react";
import {Upload,FolderUp,FolderPlus} from "lucide-react";
import {Button} from "../components/ui/button";
import {folderSchema,MAX_UPLOAD} from "../lib/forms";
import {bytes} from "../lib/file-types";
import {FormErrors,useValidatedForm} from "./form";
type Upload=(items:{key:string;file:File}[],progress:(done:number)=>void)=>Promise<string[]>;
export default function ObjectForms({folder,busy,change,upload}:{folder:string;busy:boolean;change:(key:string,options:RequestInit)=>Promise<boolean>;upload:Upload}){
 const [open,setOpen]=useState(false),[progress,setProgress]=useState<{done:number;total:number}|null>(null),[problems,setProblems]=useState<string[]>([]);
 const dir=useValidatedForm(folderSchema,{name:""});
 const create=dir.handleSubmit(async({name})=>{
   if(await change(folder+name+"/",{method:"PUT",body:new Blob([])})){dir.reset();setOpen(false)}
 });
 async function send(list:FileList|null){
   // Folder picks carry a relative path ("photos/2024/a.jpg"); plain file picks only a name.
   const files=[...list||[]].map(file=>({file,path:file.webkitRelativePath||file.name}));
   if(!files.length)return;
   const large=files.filter(f=>f.file.size>MAX_UPLOAD),items=files.filter(f=>f.file.size<=MAX_UPLOAD).map(f=>({key:folder+f.path,file:f.file}));
   const skipped=large.map(f=>f.path+": larger than the "+bytes(MAX_UPLOAD)+" upload limit");
   setProblems([]);
   if(!items.length){setProblems(skipped);return}
   const total=items.reduce((n,i)=>n+i.file.size,0);
   const what=items.length===1?items[0].key.slice(folder.length):items.length+" files ("+bytes(total)+")";
   if(!confirm("Upload "+what+" to "+(folder||"the bucket root")+"?"+(skipped.length?"\n\n"+skipped.length+" file(s) over "+bytes(MAX_UPLOAD)+" will be skipped.":"")+"\n\nExisting files with the same names will be replaced."))return;
   setProgress({done:0,total:items.length});
   const failed=await upload(items,done=>setProgress({done,total:items.length}));
   setProgress(null);setProblems([...skipped,...failed]);
 }
 const picker=(e:React.ChangeEvent<HTMLInputElement>)=>{const files=e.target.files;send(files).finally(()=>{e.target.value=""})};
 return <><Button variant="outline" disabled={busy} onClick={()=>{dir.reset();setOpen(!open)}}><FolderPlus/>New folder</Button>
 <label className="upload upload-secondary" aria-disabled={busy}><FolderUp size={15}/>Upload folder<input type="file" disabled={busy} ref={el=>el?.setAttribute("webkitdirectory","")} onChange={picker}/></label>
 <label className="upload" aria-disabled={busy}><Upload size={15}/>Upload files<input type="file" multiple disabled={busy} onChange={picker}/></label>
 {progress&&<p className="upload-status" role="status">Uploading… {progress.done} of {progress.total} done</p>}
 {problems.length>0&&<div role="alert" className="upload-status">{problems.length} file{problems.length>1?"s were":" was"} not uploaded:<ul>{problems.slice(0,10).map(p=><li key={p}>{p}</li>)}</ul>{problems.length>10&&"…and "+(problems.length-10)+" more."}</div>}
 {open&&<form noValidate className="object-form" onSubmit={create}><label>Folder name<input autoFocus {...dir.register("name")}/></label><FormErrors errors={dir.formState.errors}/><div className="actions"><Button type="button" variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={busy}>Create folder</Button></div></form>}</>
}
