// Use the filename only to choose a viewer. The isolated viewer also checks
// signatures before handing bytes to image, media or document decoders.
const kinds = {
  image:"png jpg jpeg gif webp avif bmp ico",
  audio:"mp3 wav ogg oga flac m4a aac opus",
  video:"mp4 m4v webm mov ogv",
  pdf:"pdf",
  package:"zip epub docx pptx xlsx odt odp ods",
};
export function previewKind(key:string) {
  const ext=key.split("/").pop()!.split(".").pop()!.toLowerCase();
  return (Object.keys(kinds) as (keyof typeof kinds)[]).find(kind=>kinds[kind].split(" ").includes(ext)) || "text";
}
export const TEXT_LIMIT=256*1024;
export const BINARY_LIMIT=24*1024*1024;
