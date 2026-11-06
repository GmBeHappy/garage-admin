"use client";
import {Button} from "../components/ui/button";
import {passwordSchema} from "../lib/forms";
import {useValidatedForm,FormErrors} from "./form";
export default function LoginForm(){
 const {register,handleSubmit,formState:{errors,isSubmitting}}=useValidatedForm(passwordSchema,{password:""});
 return <form action="/auth/login" method="post" noValidate onSubmit={e=>{const form=e.currentTarget;handleSubmit(()=>HTMLFormElement.prototype.submit.call(form))(e)}}><label>Administrator password<input type="password" autoComplete="current-password" {...register("password")}/></label><FormErrors errors={errors}/><Button disabled={isSubmitting}>Sign in</Button></form>
}
