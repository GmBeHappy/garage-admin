import type {z} from "zod";
import type {corsRules} from "./forms";

export interface Bucket {id:string;created:string;globalAliases:string[];localAliases?:{alias:string}[]}
export interface Permissions {read:boolean;write:boolean;owner:boolean}
export interface Usage {bytes:number;objects:number;quotas:{maxSize?:number|null;maxObjects?:number|null}}
export interface BucketInfo extends Bucket,Usage {keys:{accessKeyId:string;name:string;permissions:Permissions}[];unfinishedUploads:number;websiteAccess:boolean}
export interface AccessKey {id:string;name:string;expired:boolean}
interface Disk {total:number;available:number}
interface Node {id:string;hostname?:string;addr?:string;garageVersion?:string;draining:boolean;isUp:boolean;role?:{zone:string};metadataPartition?:Disk;dataPartition?:Disk}
export interface Dashboard {buckets:Bucket[];keys:AccessKey[];cluster:{nodes:Node[];layoutVersion:number};health:{status:string;storageNodesUp:number;storageNodes:number;partitions:number;partitionsQuorum:number;partitionsAllOk:number}}
export interface Responses {ListBuckets:Bucket[];ListKeys:AccessKey[];GetClusterStatus:Dashboard["cluster"];GetClusterHealth:Dashboard["health"];GetClusterLayout:{version:number;partitionSize:number;stagedRoleChanges:unknown[]};GetBucketInfo:BucketInfo;UpdateBucket:BucketInfo;GetKeyInfo:{secretAccessKey?:string|null}}
export interface FolderPage {items:{Key:string;Size:number;LastModified:string}[];folders:string[];next?:string}
export type Groups=Record<string,{bytes:number;count:number}>;
export interface FileRow {key:string;dir?:boolean;size?:number;date?:string}
export type CorsRule=z.input<typeof corsRules>[number];
export type RefreshProps={refreshId:Dashboard};
export type Act=(fn:()=>Promise<unknown>,success?:string)=>Promise<void>;
export type Query=Record<string,string|number|boolean|undefined>;
export interface StorageInput {bucket:string;kind:string;action?:string;value?:unknown;prefix?:string;token?:string}
export function errorMessage(err:unknown){return err instanceof Error?err.message:String(err)}
