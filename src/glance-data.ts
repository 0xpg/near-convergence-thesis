import {useState} from 'react';
import cached from '../data/glance-daily.json';
import {analyzeWindow} from './glance-analytics.ts';
import type {DailyObservation} from './glance-analytics.ts';

export type GlanceSnapshot={version:string,asOf:string,retrievedAt:string,sourceCutoff:string,rows:DailyObservation[],queries:Record<string,string>,lineage?:{file:string,url:string,retrievedAt:string,sha256:string}[],method?:string};
function validate(value:unknown):GlanceSnapshot{
  if(!value||typeof value!=='object')throw new Error('Invalid snapshot payload.');
  const item=value as GlanceSnapshot;
  if(typeof item.version!=='string'||typeof item.retrievedAt!=='string'||typeof item.asOf!=='string'||typeof item.sourceCutoff!=='string'||!Array.isArray(item.rows)||item.rows.length<1||item.rows.length>10_000)throw new Error('Snapshot metadata or row count is invalid.');
  const check=analyzeWindow(item.rows,{days:30,end:item.sourceCutoff,asOf:item.asOf});
  if(check.status!=='ready')throw new Error('Snapshot failed completed-day and row-quality checks.');
  return item;
}
export function useGlanceSnapshot(){
  const [snapshot,setSnapshot]=useState<GlanceSnapshot>(()=>{try{return validate(cached);}catch{return {version:'unavailable',asOf:new Date().toISOString().slice(0,10),retrievedAt:'unavailable',sourceCutoff:'',rows:[],queries:{}};}});
  const [refreshing,setRefreshing]=useState(false),[error,setError]=useState<string|null>(snapshot.version==='unavailable'?'The bundled source snapshot failed validation.':null);
  async function refresh(){
    if(refreshing)return;
    setRefreshing(true);setError(null);
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10_000);
    try{
      const response=await fetch('/data/glance-daily.json',{cache:'no-store',credentials:'omit',signal:controller.signal});
      if(!response.ok)throw new Error('Snapshot request failed.');
      const payload=await response.text();if(payload.length>4_194_304)throw new Error('Snapshot exceeds the supported size.');
      setSnapshot(validate(JSON.parse(payload)));
    }catch{setError('A newer validated snapshot could not be retrieved.');}
    finally{clearTimeout(timeout);setRefreshing(false);}
  }
  return {snapshot,refreshing,error,refresh};
}
