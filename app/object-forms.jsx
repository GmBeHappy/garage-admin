"use client";
import {useState} from "react";
import {Upload,FolderPlus} from "lucide-react";
import {Button} from "../components/ui/button";
import {folderSchema,fileSchema} from "../lib/forms";
import {FormErrors,useValidatedForm} from "./form";
export default function ObjectForms({folder,busy,change}){
 const [open,setOpen]=useState(false);
 const dir=useValidatedForm(folderSchema,{name:""}),upload=useValidatedForm(fileSchema,{});
 const create=dir.handleSubmit(async({name})=>{
   if(await change(folder+name+"/",{method:"PUT",body:new Blob([])})){dir.reset();setOpen(false)}
 });
 const send=upload.handleSubmit(async({file})=>{
   if(confirm("Upload "+file.name+" here? An existing file with that name will be replaced."))await change(folder+file.name,{method:"PUT",body:file});
   upload.reset()
 });
 return <><Button variant="outline" disabled={busy} onClick={()=>{dir.reset();setOpen(!open)}}><FolderPlus/>New folder</Button>
 <form noValidate onSubmit={send}><label className="upload"><Upload size={15}/>Upload<input type="file" disabled={busy} onChange={e=>{const file=e.target.files[0];e.target.value="";if(file){upload.setValue("file",file);send()}}}/></label></form>
 <FormErrors errors={upload.formState.errors}/>
 {open&&<form noValidate className="object-form" onSubmit={create}><label>Folder name<input autoFocus {...dir.register("name")}/></label><FormErrors errors={dir.formState.errors}/><div className="actions"><Button type="button" variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={busy}>Create folder</Button></div></form>}</>
}
