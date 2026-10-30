import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../App';
import { Battle } from '../screens/Battle';
import { Codex } from '../screens/Codex';
import { SPELLS, SPELL_BY_ID } from '../data/spells';
import { newGame, performAction } from '../game/engine';
import { CODEX_KEY, ADVENTURE_KEY, REACTIONS_KEY } from '../game/codex';
import { GUIDES, GUIDE_KEY, UNREAD_KEY, contextualGuides, discoveryNotices, loadGuideProgress, loadUnread, smartGuide, spellRole, stageNotice } from '../presentation/ux';
import { useNotices } from '../presentation/useNotices';
import { UxNotice } from '../components/UxNotice';
import { PlaybackController } from '../presentation/playback';
import { battleSequence } from '../presentation/sequence';
import type { Element, GameState } from '../game/types';
const scenario=vi.hoisted(()=>({mode:'normal'}));
vi.mock('../game/engine',async importOriginal=>{
  const original=await importOriginal<typeof import('../game/engine')>();
  return {...original,newGame:(...args:Parameters<typeof original.newGame>)=>{
    const game=original.newGame(...args);game.enemy.hp=500;
    const bag:Element[]=scenario.mode==='reaction'?['N','H','H','H','H','Cl']:['H','H','O','Na','Cl'];
    game.inventory=bag.map(element=>({id:game.nextId++,element}));return game;
  }};
});
beforeEach(()=>{localStorage.clear();scenario.mode='normal';vi.useFakeTimers();});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
const finish=()=>act(()=>vi.runAllTimers());
const start=()=>{render(<App/>);fireEvent.click(screen.getByRole('button',{name:/새로운 모험/}));};
function tiles(elements:Element[]){for(const element of elements){const buttons=within(screen.getByRole('region',{name:'원소 보관함'})).getAllByRole('button').filter(b=>b.getAttribute('aria-label')?.endsWith(` ${element}`)&&b.getAttribute('aria-pressed')!=='true');fireEvent.click(buttons[0]);}}
const cast=()=>fireEvent.click(screen.getByRole('button',{name:/공격 마법 발동|방어 마법 발동|보조 마법 발동|연계 반응 발동/}));
function finishCombat(){for(let i=0;i<60&&screen.queryByRole('button',{name:'턴 종료'})?.hasAttribute('disabled');i++)act(()=>vi.advanceTimersToNextTimer());}
function battle(game:GameState,selected:number[]=[]){return render(<Battle game={game} selected={selected} discoveries={[]} busy={false} tutorial={3} event={null} eventIndex={0} speed={1} discovery={null} select={()=>{}} act={()=>{}} skip={()=>{}} detail={()=>{}}/>);}

it.each(SPELLS.map(s=>[s.id, s.attack?(s.id==='sulfide'?'hybrid':'attack'):s.id==='oxygen'?'support':'defense'] as const))('%s 역할과 발동 버튼이 일치한다', (id,role)=>{
  const spell=SPELL_BY_ID[id];expect(spellRole(spell)).toBe(role);
  const game=newGame(()=>.5);game.inventory=Object.entries(spell.recipe).flatMap(([element,n])=>Array(n).fill(element)).map((element,i)=>({id:i+1,element}));
  battle(game,game.inventory.map(t=>t.id));
  const button=screen.getByRole('button',{name:/마법 발동/});expect(button).toHaveClass(`cast-${role}`);
  expect(button).toHaveTextContent(role==='defense'?'방어 마법 발동':role==='support'?'보조 마법 발동':'공격 마법 발동');
  if(role==='hybrid')expect(button.querySelectorAll('svg')).toHaveLength(2);
});

it.each(['combustion','crystallization','neutralization','ammonium'] as const)('%s 연계 버튼은 실제 엔진 조건과 일치한다', reaction=>{
  const g=newGame(()=>.5);const spell=SPELL_BY_ID[reaction==='combustion'?'methane':reaction==='crystallization'?'salt':reaction==='neutralization'?'alkali':'acid'];
  g.inventory=Object.entries(spell.recipe).flatMap(([element,n])=>Array(n).fill(element)).map((element,i)=>({id:i+1,element}));
  if(reaction==='combustion'){g.boost=true;g.turn=2;}else if(reaction==='crystallization')g.enemy.wet=1;else{g.spellsUsed=1;g.castHistory=[reaction==='neutralization'?'acid':'ammonia'];}
  const view=battle(g,g.inventory.map(t=>t.id));expect(screen.getByRole('button',{name:/연계 반응 발동/})).toHaveClass('cast-reaction');
  const result=performAction(g,{type:'cast',ids:g.inventory.map(t=>t.id)},g.revision,()=>.5);expect(result.events.some(e=>e.reaction===reaction)).toBe(true);
  view.unmount();g.boost=false;g.enemy.wet=0;g.castHistory=[];g.spellsUsed=0;battle(g,g.inventory.map(t=>t.id));expect(screen.queryByRole('button',{name:/연계 반응 발동/})).toBeNull();
});

it('스마트 가이드는 모든 미발견 레시피와 잠금·선택·턴·두 게이지를 반영한다',()=>{
  const g=newGame(()=>.5);g.inventory=[{id:1,element:'N'}];g.mana=0;g.reconstruction=0;
  expect(smartGuide(g,false,[])?.text).toContain('원소를 보관');expect(smartGuide(g,true,[])).toBeNull();expect(smartGuide(g,false,[1])).toBeNull();
  g.spellsUsed=2;expect(smartGuide(g,false,[])).toBeNull();g.spellsUsed=0;g.mana=100;g.reconstruction=100;
  expect(smartGuide(g,false,[])?.text).toContain('재구성');expect(smartGuide(g,false,[])?.text).toContain('ZERO BURST');
  for(const spell of SPELLS){g.inventory=Object.entries(spell.recipe).flatMap(([element,n])=>Array(n).fill(element)).map((element,i)=>({id:i+1,element}));expect(smartGuide(g,false,[])).toBeNull();}
});

it('첫 시전에서만 NEW DISCOVERY를 순서대로 표시하고 입력은 잠그지 않는다',()=>{
  start();finish();tiles(['H','H','O']);expect(localStorage.getItem(CODEX_KEY)).toBeNull();cast();
  expect(screen.queryByText('NEW DISCOVERY!')).toBeNull();finishCombat();
  expect(screen.getByText('NEW DISCOVERY!')).toBeInTheDocument();expect(screen.getByRole('button',{name:'턴 종료'})).toBeEnabled();
  expect(screen.getByText('마법 도감에 등록되었습니다.')).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(UNREAD_KEY)!).magic).toEqual(['water']);
  fireEvent.click(screen.getByRole('button',{name:'알림 닫기'}));expect(screen.getByText(GUIDES.twice.title)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'확인'}));expect(screen.getByText(GUIDES.keep.title)).toBeInTheDocument();
  expect(screen.getByText(GUIDES.keep.text)).toHaveTextContent('남은 원소는 다음 턴에도');
});

it('동시 발견은 화학식→반응 순서이고 이미 발견한 이벤트는 만들지 않는다',()=>{
  scenario.mode='reaction';localStorage.setItem(ADVENTURE_KEY,'1');localStorage.setItem(CODEX_KEY,'["ammonia"]');start();finish();
  tiles(['N','H','H','H']);cast();finish();tiles(['H','Cl']);cast();finishCombat();
  expect(screen.getByText('NEW DISCOVERY!')).toBeInTheDocument();expect(screen.queryByText('NEW REACTION!')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'알림 닫기'}));expect(screen.getByText('NEW REACTION!')).toBeInTheDocument();expect(screen.getByText('NH₃ + HCl → NH₄Cl')).toBeInTheDocument();
  const g=newGame(()=>.5,{discoveries:['water'],reactions:[]});g.inventory=[{id:1,element:'H'},{id:2,element:'H'},{id:3,element:'O'}];
  const result=performAction(g,{type:'cast',ids:[1,2,3]},g.revision);expect(discoveryNotices(result.events)).toEqual([]);
});

it('기존 플레이어는 NEW와 첫 안내를 일괄 재생하지 않고 새 상태는 별도 저장한다',()=>{
  localStorage.setItem(CODEX_KEY,'["water"]');localStorage.setItem(REACTIONS_KEY,'["neutralization"]');
  expect(loadUnread()).toEqual({magic:[],reaction:[]});expect(loadGuideProgress(true).disabled).toBe(true);
  start();finish();expect(screen.queryByText(GUIDES.combine.title)).toBeNull();expect(screen.queryByText('NEW DISCOVERY!')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'마법 도감'}));expect(screen.queryByText('NEW')).toBeNull();expect(screen.getByRole('tab',{name:'전체 마법 1/19'})).toBeInTheDocument();
});

it('도감 NEW는 여러 원소에서 공유하고 상세 확인 후 영속적으로 해제된다',()=>{
  localStorage.setItem(CODEX_KEY,'["water"]');localStorage.setItem(UNREAD_KEY,JSON.stringify({magic:['water'],reaction:[]}));
  const view=render(<App/>);fireEvent.click(screen.getByRole('button',{name:'마법 도감'}));expect(screen.getByRole('button',{name:'워터 블래스트 NEW 상세 확인'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab',{name:'원소별 보기'}));expect(screen.getByText('NEW')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'산소 O · 8종'}));expect(screen.getByText('NEW')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:/H₂O 워터 블래스트/}));expect(screen.queryByText('NEW')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'← 목록으로'}));expect(screen.queryByText('NEW')).toBeNull();expect(JSON.parse(localStorage.getItem(UNREAD_KEY)!).magic).toEqual([]);
  view.unmount();render(<App/>);expect(screen.queryByText('NEW DISCOVERY!')).toBeNull();expect(localStorage.getItem(CODEX_KEY)).toBe('["water"]');
});

it('반응 NEW 상세 확인은 발견 기록을 보존한다',()=>{
  const onRead=vi.fn();render(<Codex discoveries={[]} reactions={['ammonium']} unread={{magic:[],reaction:['ammonium']}} onRead={onRead} storageError={false} onClose={()=>{}}/>);
  fireEvent.click(screen.getByRole('tab',{name:'반응 기록 1/4'}));fireEvent.click(screen.getByRole('button',{name:'암모늄염 형성 NEW 상세 확인'}));expect(onRead).toHaveBeenCalledWith({kind:'reaction',id:'ammonium'});
});

it('첫 가이드 건너뛰기는 별도 저장되며 도움말로 기본 규칙을 다시 볼 수 있다',()=>{
  start();act(()=>vi.advanceTimersByTime(700));expect(screen.getByText(GUIDES.combine.title)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'가이드 건너뛰기'}));expect(JSON.parse(localStorage.getItem(GUIDE_KEY)!).disabled).toBe(true);expect(localStorage.getItem(CODEX_KEY)).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'도움말'}));expect(screen.getByText('기본 전투 가이드 다시 보기')).toBeInTheDocument();expect(screen.getByText('원소를 전부 사용할 필요는 없어요!')).toBeInTheDocument();
});

it('스테이지/상황 안내는 실제 이벤트에 근거하고 일반 전투마다 반복되지 않는다',()=>{
  const g=newGame(()=>.5);expect(stageNotice(g,1)?.text).toContain('다음 행동');g.stage=1;expect(stageNotice(g,1)).toBeUndefined();g.stage=3;expect(stageNotice(g,1)?.title).toContain('강력한');g.stage=4;expect(stageNotice(g,1)?.title).toContain('BOSS BATTLE!');
  expect(contextualGuides([{kind:'shield',target:'player',text:''},{kind:'damage',multiplier:1.5,text:''},{kind:'reaction',text:''},{kind:'ready',text:''},{kind:'reconstruct-ready',text:''}])).toEqual(['shield','affinity','reaction','reconstruct','burst']);
});

it.each([{speed:1,reduced:false},{speed:1.5,reduced:false},{speed:1.5,reduced:true}])('알림 큐 $speed배/저감 $reduced는 중복을 제거하고 전투 연출 중 숨긴다',({speed,reduced})=>{
  const notice={id:'one',kind:'discovery' as const,title:'NEW DISCOVERY!',text:'새 발견'};
  function Harness({paused}:{paused:boolean}){const q=useNotices(paused,speed,reduced);return <><button onClick={()=>q.enqueue([notice,notice])}>enqueue</button>{q.notice&&<UxNotice notice={q.notice} dismiss={q.dismiss} skipGuides={q.skipGuides}/>}</>;}
  const view=render(<Harness paused/>);fireEvent.click(screen.getByText('enqueue'));expect(screen.queryByText('NEW DISCOVERY!')).toBeNull();view.rerender(<Harness paused={false}/>);expect(screen.getAllByText('NEW DISCOVERY!')).toHaveLength(1);finish();expect(screen.queryByText('NEW DISCOVERY!')).toBeNull();fireEvent.click(screen.getByText('enqueue'));expect(screen.queryByText('NEW DISCOVERY!')).toBeNull();
});

it('연출 콜백 실패에도 타이머가 진행되어 입력 잠금을 해제한다',()=>{
  const controller=new PlaybackController(),done=vi.fn();controller.start([{kind:'ready',text:''}],()=>{throw Error('render/audio unavailable');},done);finish();expect(done).toHaveBeenCalledOnce();expect(controller.running).toBe(false);
  const g=newGame(()=>.5);expect(battleSequence(g,false,true).events[0].kind).toBe('turn-banner');
});
