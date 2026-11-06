"use client";
import type {RefreshProps} from "../lib/models";
import {errorMessage} from "../lib/models";

import {useEffect,useState} from "react";
import {ShieldCheck} from "lucide-react";
import {Button} from "../components/ui/button";
import {signInPolicy} from "../lib/forms";
import {useValidatedForm,FormErrors} from "./form";

export default function Authentication({refreshId}:RefreshProps){
 type Policy={ssoOnly:boolean;verified:boolean;configured:boolean;passwordConfigured:boolean};
 const [state,setState]=useState<Policy|null>(null),[notice,setNotice]=useState(""),[error,setError]=useState("");
 const {handleSubmit,reset,watch,setValue,setError:fieldError,formState:{errors,isSubmitting}}=useValidatedForm(signInPolicy,{ssoOnly:false});
 useEffect(()=>{let active=true;
   fetch("/api/authentication",{cache:"no-store"}).then(async r=>{const result=await r.json();if(!r.ok)throw Error(result.error);if(active){setState(result);reset({ssoOnly:result.ssoOnly});setError("")}}).catch(e=>active&&setError(errorMessage(e)));
   return()=>{active=false}
 },[refreshId,reset]);
 const selected=watch("ssoOnly");
 async function save(input:{ssoOnly:boolean}){
   setNotice("");
   try{
     const r=await fetch("/api/authentication",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});
     const result=await r.json();if(!r.ok)throw Error(result.error);
     setState(s=>s&&({...s,ssoOnly:result.ssoOnly}));reset({ssoOnly:result.ssoOnly});setNotice("Sign-in mode saved.");
   }catch(e){fieldError("root",{message:errorMessage(e)})}
 }
 return <section className="panel"><h2>Console sign-in</h2>{error&&<p role="alert">{error}</p>}{!state&&!error&&<p>Loading sign-in settings…</p>}{state&&<form onSubmit={handleSubmit(save)}><p className="hint">Current mode: {state.ssoOnly?"SSO only":"Authentik and administrator password"}</p>
   <fieldset disabled={!state.verified||isSubmitting}><label>Sign-in mode<select value={String(selected)} onChange={e=>{setValue("ssoOnly",e.target.value==="true");setNotice("")}}><option value="false" disabled={!state.passwordConfigured}>Authentik and administrator password</option><option value="true" disabled={!state.configured}>SSO only</option></select></label>
   {selected&&<p className="hint">Only Authentik administrators can sign in. Enabling this ends existing password sessions.</p>}
   <FormErrors errors={errors}/><Button disabled={selected===state.ssoOnly||isSubmitting}>Save sign-in mode</Button></fieldset>
   {!state.verified&&state.configured&&<a className="auth-settings-link" href="/auth/sso"><ShieldCheck size={16}/>Sign in with Authentik to change this setting</a>}
   {notice&&<p role="status">{notice}</p>}
 </form>}</section>
}
