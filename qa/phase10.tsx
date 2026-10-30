/// <reference types="vite/client" />
import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Battle} from '../src/screens/Battle';
import {Ending} from '../src/screens/Results';
import {UxNotice} from '../src/components/UxNotice';
import {BOSS_IDS,ENEMIES} from '../src/data/enemies';
import {SPELLS} from '../src/data/spells';
import {newGame,performAction} from '../src/game/engine';
import {seededRng} from '../src/game/random';
import {battleSequence} from '../src/presentation/sequence';
import {PlaybackController} from '../src/presentation/playback';
import {stageNotice} from '../src/presentation/ux';
import type {Action,BossId,Element,GameState,GameEvent} from '../src/game/types';
import '../src/styles/game.css';
import '../src/styles/combat.css';
import '../src/styles/ux.css';

function fixture(id:BossId,mode:string){
 const s=newGame(seededRng(9),{boss:id});const d=ENEMIES[id];s.stage=4;s.stats.defeated=4;
 const phase=mode==='multi'&&id==='golem'?2:1,pattern=phase===2?d.phase2!:d.pattern;
 let index=mode==='multi'?pattern.findIndex(i=>i.hits):mode==='charge'?pattern.findIndex(i=>i.type==='charge'):mode==='charged'?pattern.findIndex(i=>i.type==='charge')+1:0;
 if(index<0)index=0;
 s.enemy={id,hp:mode==='kill'?1:mode==='phase'?Math.floor(d.phaseThreshold!)+1:d.hp,shield:mode==='ward'?10:0,wet:0,acid:0,dot:0,phase,patternIndex:index,intent:{...pattern[index]}};
 s.reconstruction=100;s.mana=100;
 const elements:Element[]=['Fe','Fe','H','H','O','N','N','Na','O','H','Cl','S'];
 s.inventory=elements.map(element=>({id:s.nextId++,element}));s.discoveries=SPELLS.map(s=>s.id);return s;
}
function QA(){
 const [boss,setBoss]=useState<BossId>('inferno'),[mode,setMode]=useState('opening');
 const [game,setGame]=useState(()=>fixture('inferno','opening')),[selected,setSelected]=useState<number[]>([]),[event,setEvent]=useState<GameEvent|null>(null),[index,setIndex]=useState(0);
 const [speed,setSpeed]=useState(1.5),[reduced,setReduced]=useState(false),[entry,setEntry]=useState(false),[events,setEvents]=useState<GameEvent[]>([]);
 const controller=useRef(new PlaybackController()),lock=useRef(false);
 useEffect(()=>{const c=controller.current;return()=>c.cancel();},[]);
 const play=(s:GameState,opening=false)=>{setGame(s);setEvents(s.events);lock.current=true;controller.current.speed=speed;controller.current.reducedMotion=reduced;controller.current.start(battleSequence(s,true,opening).events,(e,i)=>{setEvent(e);setIndex(i);},()=>{setEvent(null);lock.current=false;if(opening)setEntry(true);});};
 const reset=(id:BossId,m:string)=>{controller.current.cancel();lock.current=false;setEvent(null);setSelected([]);setEntry(false);setBoss(id);setMode(m);play(fixture(id,m),true);};
 const act=(a:Action)=>{if(lock.current)return;const n=performAction(game,a,game.revision,()=>.5);if(n===game)return;setSelected(a.type==='reconstruct'?selected.filter(id=>n.inventory.some(t=>t.id===id)):[]);setEntry(false);play(n);};
 const visible=event?.frame?{...game,...event.frame,screen:'battle' as const}:game;
 return <div className={`world rework ${reduced?'reduced-motion':''}`} style={{display:'block',padding:0,minHeight:0}}><div className={`game-shell ${visible.screen==='battle'?'in-battle':''}`} style={{margin:'auto',maxWidth:430}}>
 <header className="topbar" style={{gap:3,paddingInline:6}}><b>X · QA</b><select aria-label="보스" value={boss} onChange={e=>reset(e.target.value as BossId,mode)}>{BOSS_IDS.map(id=><option value={id} key={id}>{ENEMIES[id].name}</option>)}</select><select aria-label="상황" value={mode} onChange={e=>reset(boss,e.target.value)}>{[['opening','첫 등장'],['multi','연속 공격'],['charge','충전'],['charged','강공격'],['phase','전환 직전'],['ward','적 보호막'],['kill','처치 직전']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></header>
 {visible.screen==='battle'?<Battle key={boss+mode} game={visible} selected={selected} discoveries={game.discoveries} busy={!!event} tutorial={3} event={event} eventIndex={game.revision*100+index} speed={speed} discovery={null} select={setSelected} act={act} skip={()=>controller.current.skip()} detail={()=>{}} noticeActive={entry}/>:<Ending game={game} restart={()=>reset(boss,'opening')} menu={()=>reset(boss,'opening')} codex={()=>{}}/>}
 {entry&&!event&&<UxNotice notice={stageNotice(game,1)!} dismiss={()=>setEntry(false)} skipGuides={()=>setEntry(false)}/>}
 </div><div style={{maxWidth:430,margin:'auto',padding:10,display:'flex',gap:6,flexWrap:'wrap'}}><button onClick={()=>reset(boss,mode)}>상황 재시작</button><button onClick={()=>controller.current.skip()}>연출 종료</button><button onClick={()=>setSpeed(v=>v===1?1.5:1)}>속도 {speed}배</button><button onClick={()=>setReduced(v=>!v)}>움직임 줄이기 {reduced?'켜짐':'꺼짐'}</button><small>개발 전용 · 실제 엔진과 전투 UI · 배포 미포함</small><output aria-label="실행 기록" style={{fontSize:10,whiteSpace:'pre-wrap',width:'100%'}}>{events.map(e=>`${e.kind}: ${e.text}${e.value!==undefined?' ['+e.value+']':''}`).join('\n')}</output></div></div>;
}
const root=createRoot(document.getElementById('root')!);root.render(<QA/>);if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
