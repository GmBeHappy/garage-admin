"use client";
import type {Dashboard,Responses} from "../lib/models";
import {useEffect,useState} from "react";
import {Activity,Layers,Network,Server,HardDrive} from "lucide-react";
import {bytes} from "../lib/file-types";
import {call} from "./console";
export default function Cluster({data}:{data:Dashboard}){
 const {cluster,health}=data;const [layout,setLayout]=useState<Responses["GetClusterLayout"]|null>(null),[error,setError]=useState("");
 useEffect(()=>{let current=true;call({op:"GetClusterLayout"}).then(l=>{if(current){setLayout(l);setError("")}}).catch(e=>current&&setError(e.message));return()=>{current=false}},[data]);
 const zones=new Set(cluster.nodes.map(n=>n.role?.zone).filter(Boolean));
 return <><div className="metrics cluster-metrics">{([[Activity,"Storage nodes up",health.storageNodesUp+" / "+health.storageNodes],[Layers,"Healthy partitions",health.partitionsAllOk+" / "+health.partitions],[Network,"Zones",zones.size]] as const).map(([Icon,k,v])=><div key={k}><Icon size={20}/><small>{k}</small><strong>{v}</strong></div>)}</div>
 <div className="cluster-layout"><section className="panel"><h2>Partition health</h2><strong className="display-number">{health.partitionsQuorum} <small>/ {health.partitions}</small></strong><div className="meter"><i style={{width:(health.partitions?100*health.partitionsQuorum/health.partitions:0)+"%"}}/></div><p className="hint">Partitions with write quorum</p></section><section className="panel"><h2>Cluster layout</h2><strong className="display-number">v{cluster.layoutVersion}</strong>{layout&&<p className="hint">{bytes(layout.partitionSize)} per partition · {layout.stagedRoleChanges.length} staged role changes</p>}{error&&<p role="alert">{error}</p>}</section></div>
 <h2 className="sectionhead">Nodes</h2>{cluster.nodes.map(n=><section className="panel node" key={n.id}><div className="sectionhead"><h3><Server size={18}/>{n.hostname||n.id.slice(0,12)}</h3><small>{n.draining?"Draining":n.isUp?"Online":"Offline"}</small></div><p className="hint">{[n.addr,n.role?.zone,n.garageVersion].filter(Boolean).join(" · ")}</p><div className="columns">{([["Data disk",n.dataPartition],["Metadata disk",n.metadataPartition]] as const).map(([label,d])=><div key={label}><h4><HardDrive size={14}/>{label}</h4>{d&&d.total>0?<><div className="meter"><i style={{width:100*Math.max(0,d.total-d.available)/d.total+"%"}}/></div><small>{bytes(d.total-d.available)} used of {bytes(d.total)}</small></>:<small>Capacity unavailable</small>}</div>)}</div></section>)}</>
}
