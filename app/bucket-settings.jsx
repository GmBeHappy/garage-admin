"use client";
import {z} from "zod";
import {bucketName} from "../lib/forms";
import {FormErrors,useValidatedForm} from "./form";
import {Button} from "../components/ui/button";
import QuotaForm from "./quota-form";
import {call} from "./console";

export default function Settings({info,keys,act,busy,onQuotaSaved}){
 const alias=useValidatedForm(z.object({name:bucketName}),{name:""});
 const defaults={read:false,write:false,owner:false};
 const access=useValidatedForm(z.object({
   selected:z.string().refine(id=>keys.some(k=>k.id===id),"Select an existing access key."),
   permissions:z.object({read:z.boolean(),write:z.boolean(),owner:z.boolean()})
 }),{selected:"",permissions:defaults});
 const apply=access.handleSubmit(({selected,permissions})=>{
   if(!confirm("Apply these permissions to the selected key?"))return;
   return act(async()=>{
     const prior=info.keys.find(k=>k.accessKeyId===selected)?.permissions||{};
     for(const [op,desired] of [["DenyBucketKey",false],["AllowBucketKey",true]]){
       const diff=Object.fromEntries(Object.keys(permissions).map(k=>[k,permissions[k]===desired&&!!prior[k]!==desired]));
       if(Object.values(diff).some(Boolean))await call({op,body:{bucketId:info.id,accessKeyId:selected,permissions:diff}})
     }
   });
 });
 const update=(op,body,query)=>act(()=>call({op,body,query}));
 return <><h3>Quotas</h3><QuotaForm info={info} onSaved={onQuotaSaved}/>
 <hr/><h3>Global aliases</h3>{info.globalAliases.map(a=><div className="listrow" key={a}>{a}<Button size="sm" variant="outline" disabled={busy} onClick={()=>{if(confirm("Remove the global alias "+a+"?"))update("RemoveBucketAlias",{bucketId:info.id,globalAlias:a})}}>Remove</Button></div>)}<form noValidate className="toolbar" onSubmit={alias.handleSubmit(({name})=>update("AddBucketAlias",{bucketId:info.id,globalAlias:name}))}><input {...alias.register("name")} placeholder="New global alias" aria-label="New global alias"/><Button disabled={busy}>Add alias</Button><FormErrors errors={alias.formState.errors}/></form>
 <hr/><form noValidate onSubmit={apply}><h3>Key permissions</h3><label>Access key<select {...access.register("selected",{onChange:e=>{
   const permissions=info.keys.find(k=>k.accessKeyId===e.target.value)?.permissions||{};
   for(const k of Object.keys(defaults))access.setValue("permissions."+k,!!permissions[k])
 }})}><option value="">Choose a key</option>{keys.map(k=><option key={k.id} value={k.id}>{k.name} · {k.id}</option>)}</select></label>
 <div className="methods">{Object.keys(defaults).map(p=><label key={p}><input type="checkbox" {...access.register("permissions."+p)}/>{p}</label>)}</div>
 <FormErrors errors={access.formState.errors}/><Button disabled={busy||access.formState.isSubmitting}>Apply permissions</Button></form></>
}
