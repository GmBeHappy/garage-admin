import {ThemeSwitch} from "./theme";
import {ShieldCheck,ArrowRight} from "lucide-react";
import {authPolicy} from "../lib/audit";
import Console from "./console";
import { session } from "../lib/session";
import { admin } from "../lib/garage";
import LoginForm from "./login-form";
export const dynamic = "force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{error?:string}>}) {
  const {user} = await session();
  if (!user){
    const {ssoOnly}=authPolicy(),error=(await searchParams).error;
    const messages:Record<string,string>={"sso-only":"This console requires Authentik single sign-on.",group:"Your Authentik account needs the Garage administrator group.",oidc:"Authentik sign-in did not complete. Start a new sign-in.",login:"The administrator password was not accepted."};
    return <main className="login"><div className="loginbox"><ThemeSwitch/><img src="/garage.svg" width="80" alt="Garage"/><h1>Storage console</h1><p>Sign in to manage your Garage cluster.</p>
      {process.env.OIDC_ISSUER&&<a className="authentik-login" href="/auth/sso"><span className="provider-icon"><ShieldCheck size={23}/></span><span><strong>Continue with Authentik</strong><small>Single sign-on</small></span><ArrowRight size={18}/></a>}
      {!ssoOnly&&process.env.ADMIN_PASSWORD&&<LoginForm/>}
      {error&&<p role="alert">{messages[error]||"Sign-in failed."}</p>}</div></main>
  }
  const [buckets,keys,health,cluster] = await Promise.all([admin("ListBuckets"),admin("ListKeys"),admin("GetClusterHealth"),admin("GetClusterStatus")]);
  return <Console initial={{buckets,keys,health,cluster}} user={user}/>;
}
