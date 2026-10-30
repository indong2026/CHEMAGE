/// <reference types="vite/client" />
import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Battle} from '../src/screens/Battle';
import {Modal} from '../src/components/Modal';
import {SPELLS} from '../src/data/spells';
import {ENEMIES} from '../src/data/enemies';
import {newGame,performAction} from '../src/game/engine';
import {PlaybackController} from '../src/presentation/playback';
import {battleSequence} from '../src/presentation/sequence';
import type {Action,Element,GameEvent} from '../src/game/types';
import '../src/styles/game.css';
import '../src/styles/combat.css';
import '../src/styles/ux.css';
const scenarios={empty:'A · 공격 조합 없음',choice:'B · 공격 / 방어',heavy:'C · 화염 강공격',methane:'D · CH₄ 5원소',ferrous:'E · FeCl₂ 연속 공격',reconstruct:'F · 재구성 100%',graphite:'C 보호막 · 반사',combustion:'O₂ → CH₄'};
type Scenario=keyof typeof scenarios;
function fixture(name:Scenario){
 const s=newGame(()=>.5,{firstAdventure:false,boss:'warden'});
 const hands:Record<Scenario,Element[]>={empty:['N','S','Cl'],choice:['C','H','H','O','Fe'],heavy:['C','O','O','Fe','N','N'],methane:['C','H','H','H','H'],ferrous:['Fe','Cl','Cl','N','H','H','H'],reconstruct:['N','S','Cl'],graphite:['C','C'],combustion:['O','O','C','H','H','H','H']};
 const enemy=name==='heavy'?'inferno':name==='ferrous'?'warden':'slime';
 s.enemy={...s.enemy,id:enemy,hp:ENEMIES[enemy].hp,patternIndex:name==='heavy'?3:name==='ferrous'?1:0,intent:name==='heavy'?ENEMIES.inferno.pattern[3]:name==='ferrous'?ENEMIES.warden.pattern[1]:{type:'attack',value:18,label:'직접 공격'}};
 if(enemy!=='slime')s.stage=4;
 s.inventory=hands[name].map(element=>({id:s.nextId++,element}));s.discoveries=SPELLS.map(x=>x.id);s.reconstruction=name==='reconstruct'?100:0;return s;
}
function QA(){
 const [name,setName]=useState<Scenario>('empty'),[game,setGame]=useState(()=>fixture('empty')),[selected,setSelected]=useState<number[]>([]),[event,setEvent]=useState<GameEvent|null>(null),[events,setEvents]=useState<GameEvent[]>([]);
 const [speed,setSpeed]=useState(1.5),[reduced,setReduced]=useState(false),[detail,setDetail]=useState<{title:string;text:string}|null>(null);
 const player=useRef(new PlaybackController()),lock=useRef(false);
 useEffect(()=>{const c=player.current;return()=>c.cancel();},[]);
 const reset=(n:Scenario)=>{player.current.cancel();lock.current=false;setName(n);setGame(fixture(n));setSelected([]);setEvent(null);setEvents([]);};
 const act=(a:Action)=>{if(lock.current)return;const n=performAction(game,a,game.revision,()=>.5);if(n===game)return;setGame(n);setEvents(n.events);setSelected(a.type==='reconstruct'?selected.filter(id=>n.inventory.some(t=>t.id===id)):[]);lock.current=true;player.current.speed=speed;player.current.reducedMotion=reduced;player.current.start(battleSequence(n,true).events,setEvent,()=>{setEvent(null);lock.current=false;});};
 return <div className={`world rework ${reduced?'reduced-motion':''}`} style={{display:'block',padding:0,minHeight:0}}><div className="game-shell in-battle" style={{margin:'auto',maxWidth:430}}>
 <header className="topbar"><b>XI · QA</b><select aria-label="검증 시나리오" value={name} onChange={e=>reset(e.target.value as Scenario)}>{Object.entries(scenarios).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></header>
 <Battle key={name} game={{...game,...event?.frame,screen:'battle'}} selected={selected} discoveries={game.discoveries} busy={!!event} tutorial={3} event={event} eventIndex={game.revision} speed={speed} discovery={null} select={setSelected} act={act} skip={()=>player.current.skip()} detail={(title,text)=>setDetail({title,text})}/>
 </div><div style={{maxWidth:430,margin:'auto',padding:10,display:'flex',gap:6,flexWrap:'wrap'}}><button onClick={()=>reset(name)}>상황 재시작</button><button onClick={()=>player.current.skip()}>연출 종료</button><button onClick={()=>setSpeed(v=>v===1?1.5:1)}>속도 {speed}배</button><button onClick={()=>setReduced(v=>!v)}>움직임 줄이기 {reduced?'켜짐':'꺼짐'}</button><small>개발 전용 · 실제 엔진·UI · 저장 기록 미사용 · 배포 미포함</small><output aria-label="실행 기록" style={{fontSize:10,whiteSpace:'pre-wrap',width:'100%'}}>{events.map(e=>`${e.kind}: ${e.text}${e.value!==undefined?' ['+e.value+']':''}${e.blocked?' blocked='+e.blocked:''}`).join('\n')}</output></div>{detail&&<Modal title={detail.title} onClose={()=>setDetail(null)}><p>{detail.text}</p></Modal>}</div>;
}
const root=createRoot(document.getElementById('root')!);root.render(<QA/>);if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
