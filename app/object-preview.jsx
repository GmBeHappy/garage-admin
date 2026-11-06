"use client";
import {useEffect,useRef,useState} from "react";
import {Download,X} from "lucide-react";
import {bytes} from "../lib/file-types";
import {previewKind,BINARY_LIMIT} from "../lib/preview-types";
export default function ObjectPreview({file,url,onClose}){
  const modal=useRef(null),frame=useRef(null);
  const [ready,setReady]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState("");
  useEffect(()=>{
    const dialog=modal.current;dialog.showModal();
    return ()=>dialog.close();
  },[]);
  useEffect(()=>{
    if(!ready)return;
    const abort=new AbortController();
    (async()=>{
      if(file.size>BINARY_LIMIT&&previewKind(file.key)!=="text")throw Error("This file exceeds the 24 MiB preview limit.");
      const res=await fetch(url+"&preview=1",{signal:abort.signal,cache:"no-store"});
      if(!res.ok)throw Error(await res.text());
      const buffer=await res.arrayBuffer();
      if(abort.signal.aborted)return;
      // The sandbox has an opaque origin. Send only to this frame's window.
      frame.current.contentWindow.postMessage({key:file.key,buffer,truncated:res.headers.get("X-Preview-Truncated")==="true",dark:document.documentElement.dataset.theme==="dark"},"*",[buffer]);
      setLoading(false);
    })().catch(e=>{if(!abort.signal.aborted){setError(e.message);setLoading(false)}});
    return ()=>abort.abort();
  },[ready,file,url]);
  return <dialog ref={modal} className="preview-dialog" aria-label="Object preview" onCancel={e=>{e.preventDefault();onClose()}}>
    <div className="preview-head"><div><h2>{file.key.split("/").pop()}</h2><small>{file.key} · {bytes(file.size)}</small></div><a href={url} className="download-file"><Download size={16}/>Download</a><button aria-label="Close preview" onClick={onClose}><X size={20}/></button></div>
    {error?<p className="empty" role="status">{error} Use Download to open the original.</p>:<>{loading&&<p className="hint">Loading preview…</p>}<iframe ref={frame} title="Isolated file viewer" src="/preview-viewer.html" sandbox="allow-scripts" referrerPolicy="no-referrer" onLoad={()=>setReady(true)}/></>}
  </dialog>;
}
