"use client";
import type {UseFormRegisterReturn} from "react-hook-form";
import {units} from "../lib/forms";

// Unit picker, then the number, with the equivalent in the neighbouring unit shown at the end of the box.
export default function SizeField({label,size,unit,value,unitValue,choices,placeholder,autoFocus}:{label:string;size:UseFormRegisterReturn;unit:UseFormRegisterReturn;value:string;unitValue:string;choices:string[];placeholder?:string;autoFocus?:boolean}){
 const n=Number(value?.trim())*(units[unitValue as keyof typeof units]??NaN);
 const valid=!!value?.trim()&&/^\d+(?:\.\d+)?$/.test(value.trim())&&Number.isFinite(n)&&n>0;
 // Show the neighbouring binary unit: MiB ↔ GiB, and B→KiB, KiB→MiB, TiB→GiB.
 const other=({B:"KiB",KiB:"MiB",MiB:"GiB",GiB:"MiB",TiB:"GiB"} as const)[unitValue as "B"]??"MiB";
 const converted=n/units[other],equivalent=!valid?"":(Number.isInteger(converted)?"= ":"≈ ")+converted.toLocaleString("en-US",{maximumFractionDigits:2})+" "+other;
 // Arrow Up/Down step the number by 1 (Shift: 10), keeping the decimals already typed.
 function step(e:React.KeyboardEvent<HTMLInputElement>){
  if(e.key!=="ArrowUp"&&e.key!=="ArrowDown")return;
  const raw=e.currentTarget.value.trim();
  if(raw&&!/^\d+(?:\.\d+)?$/.test(raw))return;
  e.preventDefault();
  const decimals=raw.split(".")[1]?.length??0,delta=(e.shiftKey?10:1)*(e.key==="ArrowUp"?1:-1);
  e.currentTarget.value=String(Math.max(0,+(Number(raw||0)+delta).toFixed(decimals)));
  size.onChange({target:e.currentTarget,type:"change"});
 }
 return <label>{label}<div className="quota-size"><select aria-label={label+" unit"} {...unit}>{choices.map(u=><option key={u}>{u}</option>)}</select>
 <div className="size-box"><input aria-label={label} {...size} onKeyDown={step} inputMode="decimal" placeholder={placeholder} autoFocus={autoFocus}/>{equivalent&&<span aria-live="polite">{equivalent}</span>}</div></div></label>
}
