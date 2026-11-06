import {readdir,readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
// A self-contained document needs no network or authenticated access once
// loaded in its opaque-origin frame. Only this exact viewer script may run.
const worker=await Bun.build({entrypoints:["node_modules/pdfjs-dist/build/pdf.worker.min.mjs"],define:{"import.meta.url":'""'},target:"browser",format:"iife",minify:true,write:false});
if(!worker.success)throw Error(worker.logs.join("\n"));
const workerCode=await worker.outputs[0].text();
const fonts={};
const fontDir="node_modules/pdfjs-dist/standard_fonts/";
for(const name of await readdir(fontDir)){
  if(/\.(pfb|ttf)$/.test(name))fonts[name]=(await readFile(fontDir+name)).toString("base64");
}
const build=await Bun.build({entrypoints:["preview/viewer.js"],target:"browser",format:"iife",minify:true,write:false,
  plugins:[{name:"pdf-worker",setup(build){
    build.onResolve({filter:/^inline-pdf-fonts$/},()=>({path:"fonts",namespace:"fonts"}));
    build.onLoad({filter:/.*/,namespace:"fonts"},()=>({contents:"export default "+JSON.stringify(fonts),loader:"js"}));
    build.onResolve({filter:/^inline-pdf-worker$/},()=>({path:"worker",namespace:"pdf"}));
    build.onLoad({filter:/.*/,namespace:"pdf"},()=>({contents:"export default "+JSON.stringify(workerCode),loader:"js"}));
  }}]});
if(!build.success)throw Error(build.logs.join("\n"));
const script=(await build.outputs[0].text()).replace(/<\/script/gi,"<\\/script");
const hash=createHash("sha256").update(script).digest("base64");
const policy=`default-src 'none'; script-src 'sha256-${hash}'; worker-src blob:; img-src blob: data:; media-src blob:; style-src 'unsafe-inline'; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'`;
await Bun.write("public/preview-viewer.html",`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer"><style>
*{box-sizing:border-box}body{margin:0;padding:16px;font:14px/1.5 system-ui,sans-serif;background:#f8f7fa;color:#282333}body.dark{background:#26232e;color:#f2edf4;color-scheme:dark}pre{font:13px/1.6 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere}img,video,canvas{display:block;max-width:100%;height:auto;margin:auto}video,img{max-height:68vh;object-fit:contain}audio{width:100%;margin:20px auto}nav{display:flex;justify-content:center;gap:14px;align-items:center;margin:0 0 10px}button{border:1px solid #8888;border-radius:6px;background:transparent;color:inherit;padding:5px 12px;cursor:pointer}small{opacity:.8}p{overflow-wrap:anywhere}li{overflow-wrap:anywhere}h3{font-size:16px}
</style></head><body><main></main><script type="module">${script}</script></body></html>`);

await Bun.write("public/preview-font-licenses.txt",await readFile(fontDir+"LICENSE_FOXIT","utf8")+"\n"+await readFile(fontDir+"LICENSE_LIBERATION","utf8"));
