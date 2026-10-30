/// <reference types="vite/client" />
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Battle } from '../src/screens/Battle';
import { Modal } from '../src/components/Modal';
import { UxNotice } from '../src/components/UxNotice';
import { ELEMENT_KEYS } from '../src/data/elements';
import { SPELLS, SPELL_BY_ID } from '../src/data/spells';
import { newGame, performAction } from '../src/game/engine';
import { battleSequence } from '../src/presentation/sequence';
import { PlaybackController } from '../src/presentation/playback';
import { useNotices } from '../src/presentation/useNotices';
import { discoveryNotices, GUIDES, type UxNotice as Notice } from '../src/presentation/ux';
import type { Action, Element, GameEvent, GameState, SpellId } from '../src/game/types';
import '../src/styles/game.css';
import '../src/styles/combat.css';
import '../src/styles/ux.css';
function fixture(name:string){
  const s=newGame(()=>.5,{firstAdventure:true});s.enemy.intent={type:'wait',value:0,label:'대기'};s.reconstruction=100;s.mana=100;
  let elements:Element[]=[...ELEMENT_KEYS,'Cl','H','H','O'];
  if(name==='scrollbag'){s.upgrades.capacity=14;elements.push('H','O');}
  else if(name==='ammonium')elements=['N','H','H','H','H','Cl'];
  else if(name==='empty')elements=['N'];
  else if(name in SPELL_BY_ID)elements=Object.entries(SPELL_BY_ID[name as SpellId].recipe).flatMap(([e,n])=>Array(n).fill(e));
  s.inventory=elements.map(element=>({id:s.nextId++,element}));return s;
}
function QA(){
  const [game,setGame]=useState(()=>fixture('bag')),[selected,setSelected]=useState<number[]>([]),[event,setEvent]=useState<GameEvent|null>(null),[name,setName]=useState('bag');
  const [speed,setSpeed]=useState(1),[reduced,setReduced]=useState(false),[mode,setMode]=useState(false),[detail,setDetail]=useState<{title:string;text:string}|null>(null);
  const [pinned,setPinned]=useState<Notice|null>(null);
  const player=useRef(new PlaybackController()),lock=useRef(false),ready=useRef(false);
  const notices=useNotices(!!event||mode||!!detail,speed,reduced);
  useEffect(()=>{const controller=player.current;return()=>controller.cancel();},[]);
  const play=(next:GameState)=>{setGame(next);const seq=battleSequence(next,ready.current);ready.current=seq.announced;notices.enqueue(discoveryNotices(seq.events));lock.current=true;player.current.speed=speed;player.current.reducedMotion=reduced;player.current.start(seq.events,setEvent,()=>{setEvent(null);lock.current=false;});};
  const action=(a:Action)=>{if(lock.current)return;const n=performAction(game,a,game.revision,()=>.9);if(n===game)return;setSelected(a.type==='reconstruct'?selected.filter(id=>n.inventory.some(t=>t.id===id)):[]);play(n);};
  const notice=!event&&!mode?(pinned??notices.notice):null;
  return <div className={`world rework ${reduced?'reduced-motion':''}`} style={{display:'block',padding:0,minHeight:0}}><div className="game-shell in-battle" style={{margin:'auto',maxWidth:430}}>
    <header className="topbar" style={{gap:3,paddingInline:6}}><b style={{fontSize:10}}>IX · QA</b><select aria-label="검증 시나리오" value={name} onChange={e=>{player.current.cancel();lock.current=false;setEvent(null);setName(e.target.value);setGame(fixture(e.target.value));setSelected([]);notices.clear();setPinned(null);setMode(false);ready.current=false;}}><option value="bag">재구성 가방</option><option value="scrollbag">14칸 스크롤 가방</option><option value="ammonium">NH₃ → HCl</option><option value="empty">조합 없음</option>{SPELLS.map(s=><option key={s.id} value={s.id}>{s.display}</option>)}</select><select aria-label="알림 검증" value={pinned?.kind??'none'} onChange={e=>setPinned(e.target.value==='none'?null:e.target.value==='guide'?{id:'qa-guide',kind:'guide',...GUIDES.keep}:discoveryNotices([{kind:'spell',spell:'ammonia',freshSpell:true,text:''}])[0])}><option value="none">알림 없음</option><option value="guide">안내</option><option value="discovery">발견</option></select></header>
    <Battle key={name} onReconstructionMode={setMode} noticeActive={!!notice} guideHighlight={notice?.highlight} game={{...game,...event?.frame,screen:'battle'}} selected={selected} discoveries={SPELLS.map(s=>s.id)} busy={!!event} tutorial={3} event={event} eventIndex={game.revision} speed={speed} discovery={null} select={setSelected} act={action} skip={()=>player.current.skip()} detail={(title,text)=>setDetail({title,text})}/>
    {notice&&<UxNotice notice={notice} dismiss={()=>{setPinned(null);notices.dismiss();}} skipGuides={()=>{setPinned(null);notices.skipGuides();}}/>}
  </div><div style={{maxWidth:430,margin:'auto',display:'flex',gap:8,flexWrap:'wrap',padding:10}}>
    <button onClick={()=>setSpeed(v=>v===1?1.5:1)}>속도 {speed}배</button><button onClick={()=>setReduced(v=>!v)}>움직임 줄이기 {reduced?'켜짐':'꺼짐'}</button>
    <button onClick={()=>setPinned(pinned?null:{id:'qa-guide',kind:'guide',...GUIDES.keep})}>안내 고정/해제</button><button onClick={()=>setPinned(pinned?null:discoveryNotices([{kind:'spell',spell:'ammonia',freshSpell:true,text:''}])[0])}>발견 고정/해제</button>
    <button onClick={()=>player.current.skip()}>연출 종료</button><small>개발 전용 고정 상태. 실제 엔진·전투 UI·알림 큐 사용. 배포 빌드 미포함.</small>
  </div>{detail&&<Modal title={detail.title} onClose={()=>setDetail(null)}><p>{detail.text}</p></Modal>}</div>;
}
const root=createRoot(document.getElementById('root')!);root.render(<QA/>);if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
