/// <reference types="vite/client" />
// Development-only fixtures use the real engine, event sequencer and mobile Battle.
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Battle } from '../src/screens/Battle';
import { newGame, performAction } from '../src/game/engine';
import { SPELLS } from '../src/data/spells';
import { ENEMIES } from '../src/data/enemies';
import { battleSequence } from '../src/presentation/sequence';
import { PlaybackController } from '../src/presentation/playback';
import { SynthAudio } from '../src/presentation/sound';
import type { Action, Element, GameState } from '../src/game/types';
import '../src/styles/game.css';
import '../src/styles/combat.css';

function fixture(name: string): GameState {
  const s = newGame(() => .99);
  if (name === 'start') return { ...s, events: battleSequence(s, false, true).events };
  s.stage = 4; s.route[4] = 'golem'; s.enemy = { ...s.enemy, id: 'golem', hp: ENEMIES.golem.hp, intent: ENEMIES.golem.pattern[2] };
  let elements: Element[], action: Action;
  if (name === 'weak' || name === 'resist') { elements = name === 'weak' ? ['H','H','O'] : ['C','H','H','H','H']; action = { type: 'cast', ids: elements.map((_,i)=>i+1) }; s.enemy.id = 'flame'; s.enemy.hp = 54; s.enemy.intent = ENEMIES.flame.pattern[2]; }
  else if (name === 'armor') { elements = ['H','Cl']; action = { type: 'cast', ids: [1,2] }; s.enemy.id = 'beetle'; s.enemy.hp = 60; s.enemy.shield = 3; s.enemy.intent = ENEMIES.beetle.pattern[2]; }
  else if (name === 'triple') { elements = ['Fe','Fe']; action = { type: 'cast', ids: [1] }; s.enemy.id = 'elite'; s.enemy.hp = 86; s.enemy.intent = ENEMIES.elite.pattern[2]; }
  else if (name === 'combo') { elements = ['H','H','O','Na','Cl']; action = { type: 'cast', ids: [1,2,3] }; }
  else if (name === 'multi') { elements = ['Fe']; s.playerShield = 8; action = { type: 'cast', ids: [1] }; s.enemy.intent = { type: 'attack', value: 30, label: '연속 타격 검증', hits: [{ type: 'attack', value: 10 }, { type: 'attack', value: 20 }] }; }
  else if (name === 'shields') { elements = ['Fe','C','O','O']; action = { type: 'cast', ids: [1] }; }
  else if (name === 'ready' || name === 'death') { elements = ['H','H','O']; action = { type: 'cast', ids: [1,2,3] }; if (name === 'ready') s.mana = 90; else s.enemy.hp = 1; }
  else if (name === 'zero') { elements = []; s.mana = 100; action = { type: 'burst' }; }
  else if (name === 'overflow') { elements = Array(12).fill('Na'); s.mana = 90; action = { type: 'endTurn' }; }
  else if (name.startsWith('enemy-')) {
    elements = [];
    const type = name.slice(6) as 'attack' | 'fire' | 'shield' | 'charge';
    s.enemy.intent = { type, value: type === 'charge' ? 0 : type === 'shield' ? 10 : 24, label: { attack: '결정 강타', fire: '화염 분출', shield: '방어막', charge: '다음 공격 준비' }[type] };
    action = { type: 'endTurn' };
  } else {
    const spell = SPELLS.find(spell => spell.id === name)!;
    elements = Object.entries(spell.recipe).flatMap(([element, count]) => Array(count).fill(element) as Element[]);
    action = { type: 'cast', ids: elements.map((_, i) => i + 1) };
  }
  s.stage = s.enemy.id === 'beetle' ? 1 : s.enemy.id === 'flame' ? 2 : s.enemy.id === 'elite' ? 3 : 4;
  s.route[s.stage] = s.enemy.id; s.enemy.patternIndex = Math.max(0, ENEMIES[s.enemy.id].pattern.indexOf(s.enemy.intent));
  s.inventory = elements.map((element, i) => ({ id: i + 1, element })); s.freshIds = []; s.nextId = 100;
  const first = performAction(s, action, s.revision, () => .5);
  const seq = battleSequence(first, false);
  if (name !== 'combo' && name !== 'shields' && name !== 'multi' && name !== 'triple') return { ...first, events: seq.events };
  const second = performAction(first, name === 'multi' ? { type: 'endTurn' } : { type: 'cast', ids: name === 'triple' ? [2] : name === 'combo' ? [4,5] : [2,3,4] }, first.revision, () => .5);
  return { ...second, events: [...seq.events, ...battleSequence(second, seq.announced).events] };
}
function Preview() {
  const [name, setName] = useState('start');
  const [result, setResult] = useState(() => fixture('start'));
  const [index, setIndex] = useState(0), [run, setRun] = useState(false), [speed, setSpeed] = useState(1), [reduced, setReduced] = useState(false), [simple, setSimple] = useState(false);
  const player = useRef(new PlaybackController()), audio = useRef(new SynthAudio());
  useEffect(() => { const p = player.current, a = audio.current; return () => { p.cancel(); a.close(); }; }, []);
  const event = result.events[index];
  const show = (value: string) => { player.current.cancel(); setRun(false); setName(value); setResult(fixture(value)); setIndex(0); };
  const play = () => {
    audio.current.unlock(); player.current.speed = speed; player.current.reducedMotion = reduced; player.current.simpleBanners = simple; setRun(true);
    player.current.start(result.events, (event, i) => { setIndex(i); audio.current.event(event); }, () => setRun(false));
  };
  return <><div className={`world rework ${reduced ? 'reduced-motion' : ''} ${simple ? 'simple-banners' : ''} ${run ? '' : 'qa-paused'}`} style={{ padding: 0, display: 'block', minHeight: 0 }}>
    <style>{'.qa-paused .battle *,.qa-paused .battle *:before,.qa-paused .battle *:after{animation-play-state:paused!important;animation-delay:-.14s!important;transition:none!important}'}</style>
    <div className="game-shell in-battle" style={{ maxWidth: 430, margin: 'auto', height: '100dvh' }}>
      <header style={{ height:44, display:'flex', gap:6, alignItems:'center', padding:'0 8px', fontSize:11 }}>
        <select aria-label="검증 시나리오" style={{ flex:1, minWidth:0, maxWidth:'65%', height:34 }} value={name} onChange={e => show(e.target.value)}>
          <option value="weak">물 → 화염 1.5배</option><option value="resist">화염 저항 0.75배</option><option value="armor">부식 · 방어력 5 → 2</option><option value="triple">Fe + Fe · 3연타 7 + 7 + 7</option><option value="start">YOUR TURN · 전투 시작</option><option value="combo">H₂O → NaCl → 적 턴</option><option value="shields">Fe + CO₂ · 보호막 28</option><option value="multi">보호막 24 · 연속 10 + 20</option><option value="ready">ZERO BURST READY</option><option value="death">보스 처치</option><option value="zero">ZERO BURST</option><option value="overflow">넘침 → 마력 100</option>
          {SPELLS.map(s => <option key={s.id} value={s.id}>{s.display} · {s.name}</option>)}{['attack','fire','shield','charge'].map(type => <option key={type} value={`enemy-${type}`}>적 {type}</option>)}
        </select>
        <button aria-label="이전 이벤트" disabled={run || index === 0} onClick={() => setIndex(i => i - 1)}>◀</button>
        <span>{index + 1}/{result.events.length}</span><button aria-label="다음 이벤트" disabled={run || index === result.events.length - 1} onClick={() => setIndex(i => i + 1)}>▶</button>
      </header>
      <Battle game={{ ...result, ...event.frame!, screen: 'battle' }} selected={[]} discoveries={SPELLS.map(s => s.id)} busy tutorial={3} event={event} eventIndex={index} speed={speed} discovery={null} select={() => {}} act={() => {}} skip={() => player.current.skip()} detail={() => {}} />
    </div>
  </div><div style={{ maxWidth:430, padding:14, margin:'auto', display:'grid', gap:10 }}>
    <button className="primary-button" onClick={play}>처음부터 재생</button>
    <button className="secondary-button" disabled={run} onClick={() => setSpeed(v => v === 1 ? 1.5 : 1)}>속도 {speed}배</button>
    <button className="secondary-button" disabled={run} onClick={() => setReduced(v => !v)}>움직임 줄이기 {reduced ? '켜짐' : '꺼짐'}</button>
    <button className="secondary-button" disabled={run} onClick={() => setSimple(v => !v)}>턴 알림 간소화 {simple ? '켜짐' : '꺼짐'}</button>
    <p>{event.kind} · {event.effect} · {event.text}</p><p>개발용 고정 시나리오. 실제 게임 엔진과 UI 사용. 밸런스 측정에 사용하지 않으며 배포 빌드에 포함되지 않습니다.</p>
  </div></>;
}
const root = createRoot(document.getElementById('root')!); root.render(<Preview />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
