"use client";
import {errorMessage} from "../lib/models";

import {z} from "zod";
import {Button} from "../components/ui/button";
import {bucketName,keyName} from "../lib/forms";
import {useValidatedForm,FormErrors} from "./form";
import {call} from "./console";
export default function CreateForm({kind,close,onCreated}:{kind:string;close:()=>void;onCreated:()=>Promise<void>}){
 const key=kind==="key";
 const {register,handleSubmit,setError,formState:{errors,isSubmitting}}=useValidatedForm(z.object({name:key?keyName:bucketName}),{name:""});
 async function submit({name}:{name:string}){try{await call({op:key?"CreateKey":"CreateBucket",body:key?{name}:{globalAlias:name}});await onCreated();close()}catch(e){setError("root",{message:errorMessage(e)})}}
 return <dialog open><form noValidate onSubmit={handleSubmit(submit)}><h2>Create {kind}</h2><label>Name<input autoFocus {...register("name")}/></label><FormErrors errors={errors}/><div className="actions"><Button type="button" variant="outline" disabled={isSubmitting} onClick={close}>Cancel</Button><Button disabled={isSubmitting}>Create</Button></div></form></dialog>
}
