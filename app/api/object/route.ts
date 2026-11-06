import {errorMessage} from "../../../lib/models";
import {previewKind,TEXT_LIMIT,BINARY_LIMIT} from "../../../lib/preview-types";
import {audited} from "../../../lib/audit";
import {HeadObjectCommand,GetObjectCommand,PutObjectCommand,DeleteObjectCommand} from "@aws-sdk/client-s3";
import {session,origin} from "../../../lib/session";
import {adminBucket,client} from "../../../lib/garage";
async function handle(req:Request) {
  const {user}=await session();
  if (!user || (req.method!=="GET" && req.headers.get("origin")!==origin())) return new Response("Forbidden",{status:403});
  const query=new URL(req.url).searchParams, Bucket=query.get("bucket"),Key=query.get("key");
  if(!Bucket||!Key)return new Response("Missing bucket or object key",{status:400});
  const params={Bucket,Key};
  try {
    const preview=req.method==="GET" && query.get("preview")==="1";
    return await audited(user, preview?"Preview object":"Object "+req.method, params.Bucket+"/"+params.Key, async()=>{
    params.Bucket=await adminBucket(params.Bucket,user);
    const s3=client();
    if(req.method==="GET"){
      if(preview){
        const meta=await s3.send(new HeadObjectCommand(params));
        const size=meta.ContentLength;
        if(size===undefined||!Number.isSafeInteger(size)||size<0)return new Response("Unknown file size",{status:422});
        const text=previewKind(params.Key)==="text";
        if(!text && size>BINARY_LIMIT)return new Response("This file exceeds the 24 MiB preview limit.",{status:413});
        const length=Math.min(size,text?TEXT_LIMIT:BINARY_LIMIT);
        const headers={"Content-Type":"application/octet-stream","Content-Disposition":"attachment",
          "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff",
          "Content-Security-Policy":"default-src 'none'; sandbox","X-Preview-Truncated":String(length<size)};
        if(!length)return new Response(null,{headers});
        const out=await s3.send(new GetObjectCommand({...params,IfMatch:meta.ETag,Range:"bytes=0-"+(length-1)}));
        if(out.ContentLength!==length){await out.Body?.transformToWebStream().cancel();return new Response("Object changed. Reopen the preview.",{status:409})}
        return new Response(out.Body!.transformToWebStream(),{headers});
      }
      const out=await s3.send(new GetObjectCommand(params));
      return new Response(out.Body!.transformToWebStream(),{headers:{"Content-Type":"application/octet-stream","Content-Disposition":"attachment; filename*=UTF-8''"+encodeURIComponent(params.Key.split("/").pop()!).replace(/'/g,"%27"),"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
    }
    if(req.method==="DELETE") await s3.send(new DeleteObjectCommand(params));
    else {
      const length=req.headers.get("content-length");
      if(length===null || Number(length)>32*1024*1024)return new Response("Maximum upload size is 32 MiB",{status:413});
      const body=new Uint8Array(await req.arrayBuffer());
      if(body.length>32*1024*1024)return new Response("Maximum upload size is 32 MiB",{status:413});
      await s3.send(new PutObjectCommand({...params,Body:body,ContentType:req.headers.get("content-type")||"application/octet-stream"}));
    }
    return new Response(null,{status:204});
    });
  }catch(e){return new Response(errorMessage(e),{status:400})}
}
export {handle as GET,handle as PUT,handle as DELETE};
