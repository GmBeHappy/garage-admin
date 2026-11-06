"use client";
import {z} from "zod";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
export function useValidatedForm(schema,defaultValues){
  return useForm({resolver:zodResolver(schema),defaultValues});
}
function messages(errors,path=""){
 if(!errors||typeof errors!=="object")return [];
 if(errors.message)return [(path?path+" — ":"")+errors.message];
 return Object.entries(errors).filter(([k])=>k!=="ref").flatMap(([k,v])=>messages(v,path?path+"."+k:k))
}
export function FormErrors({errors}){
 const list=messages(errors);
 return list.length?<p role="alert" className="form-error">{list.join("\n")}</p>:null
}

export function useFilter(maxLength=1024){
 const form=useForm({resolver:zodResolver(z.object({query:z.string().max(maxLength)})),mode:"onChange",defaultValues:{query:""}});
 return {value:form.watch("query"),input:{...form.register("query"),maxLength},clear:()=>form.reset({query:""})};
}
