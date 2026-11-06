"use client";
import {useEffect,useState} from "react";
import {Moon,Sun} from "lucide-react";
export function ThemeSwitch(){
 const [theme,setTheme]=useState("dark");
 useEffect(()=>setTheme(document.documentElement.dataset.theme||"dark"),[]);
 function change(next){document.documentElement.dataset.theme=next;localStorage.setItem("garage-theme",next);setTheme(next)}
 return <div className="theme-switch" aria-label="Appearance">{[[Sun,"light"],[Moon,"dark"]].map(([Icon,name])=><button key={name} aria-label={name+" theme"} aria-pressed={theme===name} onClick={()=>change(name)}><Icon size={15}/></button>)}</div>
}
