export const types = {
  Images: {color:"#b08cf4",extensions:"jpg jpeg png gif webp svg ico bmp avif heic tiff"},
  Documents: {color:"#6dacf3",extensions:"pdf doc docx txt md rtf odt ppt pptx"},
  Data: {color:"#ebbb56",extensions:"json xml csv xls xlsx parquet sql db yaml yml"},
  Code: {color:"#76c7a6",extensions:"js jsx ts tsx py rs go java c h cpp css html sh php rb dart"},
  Media: {color:"#ed906a",extensions:"mp4 mov webm mkv mp3 wav m4a ogg"},
  Archives: {color:"#d781b4",extensions:"zip gz tar rar 7z bz2 xz zst"},
  Other: {color:"#98a0b2",extensions:""},
};
export function fileType(key) {
  const ext = key.split("/").pop().toLowerCase().match(/\.([^.]+)$/)?.[1];
  return Object.keys(types).find(t=>ext && types[t].extensions.split(" ").includes(ext)) || "Other";
}
export function bytes(size) {
  if(size==null)return "Unavailable";
  const units=["B","KiB","MiB","GiB","TiB","PiB"];
  const i=Math.min(units.length-1,Math.floor(Math.log(Math.max(1,size))/Math.log(1024)));
  return (size/1024**i).toLocaleString("en-US",{maximumFractionDigits:i?1:0})+" "+units[i];
}
