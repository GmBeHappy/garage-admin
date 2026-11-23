import { db } from "./index";

export function authPolicy(){
  const row=db().query<{sso_only:number;password_epoch:number},[]>("SELECT sso_only,password_epoch FROM sign_in_policy WHERE id=1").get()!;
  return {ssoOnly:Boolean(row.sso_only),passwordEpoch:row.password_epoch};
}
export function saveAuthPolicy(ssoOnly:boolean){
  db().query("UPDATE sign_in_policy SET password_epoch=password_epoch+CASE WHEN sso_only=0 AND ?=1 THEN 1 ELSE 0 END,sso_only=? WHERE id=1").run(Number(ssoOnly),Number(ssoOnly));
  return authPolicy();
}
