import { useCallback, useEffect, useRef, useState } from 'react';
import type { UxNotice } from './ux';
const priority={discovery:0,'reaction-discovery':1,stage:2,guide:3};
/** One informational queue, suspended by the existing combat event timeline.
 * Notifications never advance the game or hold its input lock. Timers, not CSS
 * animationend events, finish notices even if animations are unavailable. */
export function useNotices(paused:boolean,speed:number,reduced:boolean) {
  const [queue,setQueue]=useState<UxNotice[]>([]);
  const seen=useRef(new Set<string>());
  const enqueue=useCallback((items:UxNotice[])=>{
    const fresh=items.filter(item=>{if(seen.current.has(item.id))return false;seen.current.add(item.id);return true;});
    if(fresh.length)setQueue(previous=>[...previous,...fresh].sort((a,b)=>priority[a.kind]-priority[b.kind]));
  },[]);
  const dismiss=useCallback(()=>setQueue(previous=>previous.slice(1)),[]);
  const clear=useCallback(()=>setQueue([]),[]);
  const skipGuides=useCallback(()=>setQueue(previous=>previous.filter(item=>item.kind!=='guide')),[]);
  const remove=useCallback((ids:string[])=>setQueue(previous=>previous.filter(item=>!ids.includes(item.id))),[]);
  const current=queue[0];
  useEffect(()=>{
    if(paused||!current)return;
    const ms=current.kind==='guide'?6500:current.kind==='stage'?1600:1800;
    // Reduced motion removes motion, not the time required to read text.
    const timer=setTimeout(dismiss,ms/(reduced?1:speed));
    return()=>clearTimeout(timer);
  },[current,paused,speed,reduced,dismiss]);
  return {notice:paused?null:current??null,enqueue,dismiss,clear,skipGuides,remove};
}
