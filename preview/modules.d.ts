declare module "inline-pdf-fonts" { const fonts:Record<string,string>; export default fonts }
declare module "inline-pdf-worker" { const source:string; export default source }
declare module "pdfjs-dist/build/pdf.mjs" { export * from "pdfjs-dist" }
