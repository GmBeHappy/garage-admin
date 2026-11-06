import "./style.css";
export const metadata = { title:"Garage · Storage console", icons:{icon:"/garage.svg"} };
export default function Layout({children}) {return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:`try{document.documentElement.dataset.theme=localStorage.getItem("garage-theme")||(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark")}catch{document.documentElement.dataset.theme="dark"}`}}/></head><body>{children}</body></html>}
