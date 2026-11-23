"use client";
import {z} from "zod";
import {useForm,type FieldValues,type DefaultValues} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
export function useValidatedForm<I extends FieldValues,O extends FieldValues>(schema:z.ZodType<O,I>,defaultValues:DefaultValues<I>){
  return useForm<I,unknown,O>({resolver:zodResolver(schema),defaultValues});
}
function messages(errors:unknown,path=""):string[]{
 if(!errors||typeof errors!=="object")return [];
 if("message" in errors && typeof errors.message==="string")return [(path?path+" — ":"")+errors.message];
 return Object.entries(errors).filter(([k])=>k!=="ref").flatMap(([k,v])=>messages(v,path?path+"."+k:k))
}
export function FormErrors({errors}:{errors:unknown}){
 const list=messages(errors);
 return list.length?<p role="alert" className="form-error">{list.join("\n")}</p>:null
}

export function useFilter(maxLength=1024){
 const form=useForm({resolver:zodResolver(z.object({query:z.string().max(maxLength)})),mode:"onChange",defaultValues:{query:""}});
 return {value:form.watch("query"),input:{...form.register("query"),maxLength},clear:()=>form.reset({query:""})};
}
