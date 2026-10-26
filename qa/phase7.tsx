/// <reference types="vite/client" />
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Battle } from '../src/screens/Battle';
import { Modal } from '../src/components/Modal';
import { Rewards } from '../src/screens/Results';
import { ELEMENT_KEYS } from '../src/data/elements';
import { SPELLS, SPELL_BY_ID } from '../src/data/spells';
import { newGame, performAction, chooseReward } from '../src/game/engine';
import { battleSequence } from '../src/presentation/sequence';
import { PlaybackController } from '../src/presentation/playback';
import type { Action, Element, GameEvent, GameState, SpellId } from '../src/game/types';
import '../src/styles/game.css';
import '../src/styles/combat.css';
function fixture(name:string){
  const s=newGame(()=>.5);s.enemy.intent={type:'wait',value:0,label:'대기'};s.reconstruction=name==='charge'?70:100;s.mana=name==='charge'?100:20;
  if(name==='resonance'){s.screen='reward';s.rewards=['resonance'];return s;}
  let elements:Element[]=[...ELEMENT_KEYS,'Cl','H','H','O'];
  if(name==='ammonium') elements=['N','H','H','H','H','Cl'];
  else if(name in SPELL_BY_ID)elements=Object.entries(SPELL_BY_ID[name as SpellId].recipe).flatMap(([e,n])=>Array(n).fill(e));
  s.inventory=elements.map(element=>({id:s.nextId++,element}));return s;
}
function QA(){
  const [g,setG]=useState(()=>fixture('bag')),[selected,setSelected]=useState<number[]>([]),[event,setEvent]=useState<GameEvent|null>(null),[speed,setSpeed]=useState(1),[reduced,setReduced]=useState(false),[name,setName]=useState('bag'),[detail,setDetail]=useState<{title:string;text:string}|null>(null);
  const [frames,setFrames]=useState<GameEvent[]>([]),[frameIndex,setFrameIndex]=useState(-1);
  const controller=useRef(new PlaybackController()),lock=useRef(false),announced=useRef(false);
  useEffect(()=>{const p=controller.current;return()=>p.cancel();},[]);
  const play=(next:GameState)=>{setG(next);const seq=battleSequence(next,announced.current);announced.current=seq.announced;setFrames(seq.events);setFrameIndex(-1);lock.current=true;controller.current.speed=speed;controller.current.reducedMotion=reduced;controller.current.start(seq.events,e=>setEvent(e),()=>{setEvent(null);lock.current=false;});};
  const action=(a:Action)=>{if(lock.current)return;const n=performAction(g,a,g.revision,()=>.9);if(n===g)return;setSelected(a.type==='reconstruct'?selected.filter(id=>n.inventory.some(t=>t.id===id)):[]);play(n);};
  return <div className={`world rework ${reduced?'reduced-motion':''} ${frameIndex>=0?'phase7-paused':''}`} style={{display:'block',padding:0,minHeight:0}}>
    <style>{'.phase7-paused .notice-band,.phase7-paused .reconstruction-symbols i,.phase7-paused .reaction-flash{animation:none!important;opacity:1;transform:none;translate:0 0}.phase7-paused .battle *{animation-play-state:paused!important}'}</style>
    <div className="game-shell in-battle" style={{margin:'auto',height:'100dvh',maxWidth:430}}>
      <header className="topbar"><b>PHASE VII · QA</b><select aria-label="검증 시나리오" value={name} onChange={e=>{controller.current.cancel();lock.current=false;setEvent(null);setName(e.target.value);setG(fixture(e.target.value));setSelected([]);setFrames([]);announced.current=false;}}>
        <option value="bag">8원소 · 재구성</option><option value="charge">동시 준비 알림</option><option value="ammonium">NH₃ → HCl</option><option value="resonance">N/S 공명</option>{SPELLS.slice(13).map(s=><option key={s.id} value={s.id}>{s.display}</option>)}
      </select></header>
      {g.screen==='reward'?<Rewards game={g} choose={(id,e)=>play(chooseReward(g,id,()=>.5,e))}/>:<Battle key={name} game={{...g,...event?.frame,screen:'battle'}} selected={selected} discoveries={SPELLS.map(s=>s.id)} busy={!!event} tutorial={3} event={event} eventIndex={g.revision*100+frameIndex} speed={speed} discovery={null} select={setSelected} act={action} skip={()=>controller.current.skip()} detail={(title,text)=>setDetail({title,text})}/>}
    </div>
    <div style={{maxWidth:430,margin:'auto',display:'flex',gap:8,flexWrap:'wrap',padding:10}}><button onClick={()=>setSpeed(v=>v===1?1.5:1)}>속도 {speed}배</button><button onClick={()=>setReduced(v=>!v)}>움직임 줄이기 {reduced?'켜짐':'꺼짐'}</button><button disabled={!frames.length} onClick={()=>{controller.current.cancel();lock.current=true;const i=(frameIndex+1)%frames.length;setFrameIndex(i);setEvent(frames[i]);}}>이벤트 한 장씩</button><button onClick={()=>{controller.current.cancel();lock.current=false;setEvent(null);}}>연출 종료</button><small>개발 전용. 실제 엔진·UI·순서 관리기. 배포 빌드에 포함하지 않음.</small></div>
    {detail&&<Modal title={detail.title} onClose={()=>setDetail(null)}><p>{detail.text}</p></Modal>}
  </div>;
}
const root=createRoot(document.getElementById('root')!);root.render(<QA/>);if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
