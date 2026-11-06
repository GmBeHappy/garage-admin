import {getDocument,GlobalWorkerOptions,AnnotationMode} from "pdfjs-dist/build/pdf.mjs";
import fonts from "inline-pdf-fonts";
import workerSource from "inline-pdf-worker";
import {ZipReader,Uint8ArrayReader,configure} from "@zip.js/zip.js";
import {previewKind} from "../lib/preview-types";

configure({useWebWorkers:false,useCompressionStream:true});
const root=document.querySelector("main");
function element(tag,text,parent=root){
  const node=document.createElement(tag);
  if(text!==undefined)node.textContent=text;
  parent.append(node);return node;
}
function message(text){root.replaceChildren();element("p",text)}
function textPreview(data,truncated){
  const utf16=data[0]===255&&data[1]===254?"utf-16le":data[0]===254&&data[1]===255?"utf-16be":null;
  let text;
  try{text=new TextDecoder(utf16||"utf-8",{fatal:true}).decode(data,{stream:truncated})}catch{return message("This file is binary or uses an unsupported text encoding.")}
  if(/[\x00-\x08\x0e-\x1a]/.test(text))return message("Preview is unavailable for this binary format.");
  if(truncated)element("small","Showing the first 256 KiB.");
  if(!text){element("p","This file is empty.");return}
  element("pre",text);
}
async function pdf(data){
  const workerUrl=URL.createObjectURL(new Blob([workerSource],{type:"text/javascript"}));
  GlobalWorkerOptions.workerPort=new Worker(workerUrl);
  class LocalPdfData {
    async fetch({kind,filename}){
      if(kind!=="standardFontDataUrl"||!Object.hasOwn(fonts,filename))throw Error("Unavailable PDF resource.");
      return Uint8Array.from(atob(fonts[filename]),c=>c.charCodeAt(0));
    }
  }
  const doc=await getDocument({data,BinaryDataFactory:LocalPdfData,isEvalSupported:false,useSystemFonts:false,disableFontFace:true,useWasm:false,useWorkerFetch:false,maxImageSize:12_000_000,enableXfa:false}).promise;
  let number=1;
  const nav=element("nav"),prev=element("button","Previous",nav),status=element("span","",nav),next=element("button","Next",nav),canvas=element("canvas");
  async function render(){
    prev.disabled=next.disabled=true;
    const page=await doc.getPage(number),base=page.getViewport({scale:1});
    const viewport=page.getViewport({scale:Math.min(1.5,1500/Math.max(base.width,base.height))});
    canvas.width=Math.max(1,Math.ceil(viewport.width));canvas.height=Math.max(1,Math.ceil(viewport.height));
    await page.render({canvas,viewport,annotationMode:AnnotationMode.DISABLE}).promise;
    status.textContent="Page "+number+" of "+doc.numPages;prev.disabled=number===1;next.disabled=number===doc.numPages;
  }
  prev.onclick=()=>{number--;render().catch(()=>message("This page could not be rendered."))};
  next.onclick=()=>{number++;render().catch(()=>message("This page could not be rendered."))};
  await render();
}
const MAX_XML=2*1024*1024;
async function xml(entry,budget){
  if(entry.encrypted||entry.uncompressedSize>Math.min(MAX_XML,budget.left))throw Error("Document exceeds preview limits.");
  const parts=[];let bytes=0;
  await entry.getData(new WritableStream({write(part){
    bytes+=part.length;budget.left-=part.length;
    if(bytes>MAX_XML||budget.left<0)throw Error("Document exceeds preview limits.");
    parts.push(part);
  }}));
  const source=await new Blob(parts).text();
  if(/<!DOCTYPE|<!ENTITY/i.test(source))throw Error("Unsupported XML declarations.");
  const tree=new DOMParser().parseFromString(source,"application/xml");
  if(tree.getElementsByTagName("parsererror").length)throw Error("Invalid document XML.");
  return tree;
}
const tags=(node,name)=>Array.from(node.getElementsByTagNameNS("*",name));
async function packagePreview(data,ext){
  const reader=new ZipReader(new Uint8ArrayReader(data)),entries=[];
  try{
    for await(const item of reader.getEntriesGenerator()){
      if(entries.length>=2000)throw Error("This archive exceeds the 2,000-entry preview limit.");
      entries.push(item);
    }
    const budget={left:6*1024*1024};
    if(ext==="zip"||ext==="epub"){
      element("p",entries.length+" archive entries");const list=element("ul");
      for(const e of entries.slice(0,250))element("li",e.filename,list);
      if(entries.length>250)element("small","Showing the first 250 entries.");return;
    }
    const read=async(name)=>{const entry=entries.find(e=>e.filename===name);if(!entry)throw Error("Missing document content.");return xml(entry,budget)};
    let files=ext==="pptx"?entries.filter(e=>/^ppt\/slides\/slide\d+\.xml$/.test(e.filename)).map(e=>e.filename).sort((a,b)=>a.localeCompare(b,"en",{numeric:true})):
      ext==="xlsx"?entries.filter(e=>/^xl\/worksheets\/sheet\d+\.xml$/.test(e.filename)).map(e=>e.filename).sort((a,b)=>a.localeCompare(b,"en",{numeric:true})):
      [ext==="docx"?"word/document.xml":"content.xml"];
    if(!files.length)throw Error("No previewable content.");
    element("small","Text excerpt · up to 5 sections and 200 paragraphs or rows per section.");
    const strings=ext==="xlsx"&&entries.some(e=>e.filename==="xl/sharedStrings.xml")?tags(await read("xl/sharedStrings.xml"),"si").map(n=>tags(n,"t").map(t=>t.textContent).join("")):[];
    for(const [i,file] of files.slice(0,5).entries()){
      const tree=await read(file);
      if(ext==="xlsx"){
        element("h3","Sheet "+(i+1));
        const lines=tags(tree,"row").slice(0,200).map(row=>tags(row,"c").slice(0,50).map(c=>{
          const v=tags(c,"v")[0]?.textContent;
          return c.getAttribute("t")==="s"?strings[Number(v)]||"":v||tags(c,"t")[0]?.textContent||"";
        }).join("  |  "));element("pre",lines.join("\n"));
      }else{
        if(ext==="pptx")element("h3","Slide "+(i+1));
        for(const p of tags(tree,"p").slice(0,200))element("p",ext.startsWith("od")?p.textContent:tags(p,"t").map(t=>t.textContent).join(""));
      }
    }
  }finally{await reader.close()}
}
function mediaType(data,kind){
  const hex=Array.from(data.slice(0,12),n=>n.toString(16).padStart(2,"0")).join("");
  const s=String.fromCharCode(...data.slice(0,48));
  if(kind==="image"){
    if(hex.startsWith("89504e470d0a1a0a"))return "image/png";
    if(hex.startsWith("ffd8ff"))return "image/jpeg";
    if(/^GIF8[79]a/.test(s))return "image/gif";
    if(s.startsWith("RIFF")&&s.slice(8,12)==="WEBP")return "image/webp";
    if(s.slice(4,8)==="ftyp"&&/avi[fs]/.test(s))return "image/avif";
    if(hex.startsWith("00000100"))return "image/x-icon";
    if(s.startsWith("BM"))return "image/bmp";
  }else{
    if(s.slice(4,8)==="ftyp")return kind==="audio"?"audio/mp4":"video/mp4";
    if(s.startsWith("OggS"))return kind==="audio"?"audio/ogg":"video/ogg";
    if(hex.startsWith("1a45dfa3"))return kind+"/webm";
    if(kind==="audio"){
      if(s.startsWith("fLaC"))return "audio/flac";
      if(s.startsWith("RIFF")&&s.slice(8,12)==="WAVE")return "audio/wav";
      if(hex.startsWith("fff1")||hex.startsWith("fff9"))return "audio/aac";
      if(s.startsWith("ID3")||(data[0]===255&&(data[1]&224)===224))return "audio/mpeg";
    }
  }
  throw Error("The file contents do not match a supported media format.");
}
async function show({key,buffer,truncated,dark}){
  document.body.classList.toggle("dark",dark);
  const data=new Uint8Array(buffer),kind=previewKind(key);
  if(kind==="text")return textPreview(data,truncated);
  if(kind==="pdf")return pdf(data);
  if(kind==="package")return packagePreview(data,key.split(".").pop().toLowerCase());
  const mime=mediaType(data,kind),node=element(kind==="image"?"img":kind);
  node.onerror=()=>message("Your browser could not decode this file. Use Download to open it elsewhere.");
  if(kind==="image")node.alt=key;else{node.controls=true;node.preload="metadata"}
  node.src=URL.createObjectURL(new Blob([data],{type:mime}));
}
// Only the parent console can provide bytes, once, to an opaque sandbox.
if(window.parent!==window && window.origin==="null"){
  const receive=async e=>{
    if(e.source!==parent||e.origin!==location.origin||!(e.data?.buffer instanceof ArrayBuffer))return;
    window.removeEventListener("message",receive);
    try{await show(e.data)}catch{message("This file is encrypted, damaged, unsupported, or exceeds the preview limits. Download it to open it elsewhere.")}
  };
  window.addEventListener("message",receive);
}
