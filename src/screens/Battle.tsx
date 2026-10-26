import { useRef, useState, type CSSProperties } from 'react';
import { ELEMENTS } from '../data/elements';
import '../styles/reconstruction.css';
import { REACTIONS } from '../data/reactions';
import { AFFINITIES } from '../data/affinities';
import { PlayerStatus } from '../components/CombatStatus';
import { SPELLS } from '../data/spells';
import { previewSpell } from '../game/preview';
import { BattleNotice } from '../components/BattleNotice';
import { Icon } from '../components/PixelArt';
import { ElementTile } from '../components/Elements';
import { CombatScene, HealthBar } from '../components/CombatScene';
import { BALANCE as B } from '../data/balance';
import { matchRecipe } from '../game/recipes';
import { recipeIds, suggestions } from '../game/suggestions';
import type { Action, GameEvent, GameState, SpellId } from '../game/types';

type Props = {
  game: GameState; selected: number[]; discoveries: SpellId[]; busy: boolean; tutorial: number;
  event: GameEvent | null; eventIndex: number; speed: number; discovery: SpellId | null;
  select: (ids: number[]) => void; act: (action: Action) => void; skip: () => void;
  detail: (title: string, text: string) => void; hint?: () => void;
};
export function Battle({ game: g, selected, discoveries, busy, tutorial, event, eventIndex, speed, discovery, select, act, skip, detail, hint }: Props) {
  const [reconstructing, setReconstructing] = useState(false);
  const [reconstructId, setReconstructId] = useState<number | null>(null);
  const reconstructLock = useRef(false);
  const chosen = g.inventory.find(t => t.id === reconstructId);
  const blocked = busy || reconstructing;
  const openReconstruction = () => {
    if (busy) return;
    if (g.reconstruction < 100) { detail('원소 재구성', `현재 ${g.reconstruction}% · ${100 - g.reconstruction}% 더 충전하면 사용할 수 있어요.\n적 행동이 끝나고 내 차례가 되면 +35%. 전투 사이에도 유지됩니다.\n실제 화학 반응이 아닌 연금술 마법입니다.`); return; }
    if (!g.inventory.length) { detail('원소 재구성', '가방에 원소가 1개 이상 있어야 사용할 수 있어요.'); return; }
    reconstructLock.current = false; setReconstructId(null); setReconstructing(true);
  };
  const reconstruct = () => {
    if (busy || reconstructLock.current || !chosen || g.reconstruction !== 100) return;
    reconstructLock.current = true; act({type:'reconstruct', id:chosen.id}); setReconstructing(false); setReconstructId(null);
  };
  const tiles = selected.map(id => g.inventory.find(t => t.id === id)!).filter(Boolean);
  const spell = matchRecipe(tiles.map(t => t.element));
  const preview = spell && !busy ? previewSpell(g, selected) : null;
  const shortEffect = preview ? preview.shield ? `보호막 +${preview.shield} · 총 ${preview.totalShield}` : `예상 피해 ${preview.damage}${preview.blocked ? ` · 방어막 ${preview.blocked}` : ''}${preview.multiplier !== 1 ? ` · ×${preview.multiplier}` : ''}${preview.combo ? ' · COMBO 가능' : ''}${preview.reactionShield ? ` · 보호막 +${preview.reactionShield}` : ''}` : spell?.effect.split(' · ')[0];
  const craftable = SPELLS.filter(s => recipeIds(g.inventory, s));
  const canAttack = craftable.some(s => s.attack);
  const notice = busy && (event?.kind === 'turn-banner' || event?.kind === 'ready' || event?.kind === 'reconstruct-ready');
  const known = suggestions(g.inventory, discoveries);
  const left = Math.max(0, B.spellsPerTurn - g.spellsUsed);
  const toggle = (id: number) => { if (busy) return; if (reconstructing) { setReconstructId(id); return; } select(selected.includes(id) ? selected.filter(x => x !== id) : selected.length < B.maxSlots ? [...selected, id] : selected); };
  const guide = tutorial === 0 ? 'H 두 개와 O 하나를 눌러 조합해 보세요.' : tutorial === 1 ? '완성! 아래 마법 발동을 눌러 보세요.' : '한 번 더 시전하거나, 턴을 끝내세요.';
  return <main className="battle phase-three" style={{ '--rate': speed } as CSSProperties}>
    {busy && event && <BattleNotice event={event} />}
    <div className="battle-progress"><span>실험실 {g.stage + 1} <small>/ 5</small></span><div aria-label={`5전투 중 ${g.stage + 1}번째`}>{g.route.map((_, i) => <i key={i} className={i <= g.stage ? 'lit' : ''} />)}</div><span>턴 {g.turn}</span></div>
    <CombatScene game={g} event={event} eventIndex={eventIndex} busy={busy} speed={speed} detail={detail} />
    {tutorial < 3 && g.stage === 0 && <div className="first-lesson" role="status"><span>{tutorial + 1}/3</span>{guide}</div>}
    <section className={`instant-composer ${spell ? 'complete' : ''}`} aria-label="마법 조합">
      <div className="instant-slots">{Array.from({ length: B.maxSlots }, (_, i) => tiles[i] ? <ElementTile key={i} tile={tiles[i]} slot onClick={() => toggle(tiles[i].id)} disabled={blocked} /> : <span className="instant-empty" key={i} aria-hidden="true">{tutorial === 0 && i < 3 ? ['H', 'H', 'O'][i] : '+'}</span>)}<button className="clear-selection" aria-label="선택 해제" disabled={blocked || !selected.length} onClick={() => select([])}><Icon name="close" size={14} /></button></div>
      <div className="instant-result" aria-live="polite">{spell ? <><b style={{ color: spell.color }}>{spell.display} <span>{preview?.reaction ? REACTIONS[preview.reaction].name + ' 가능!' : spell.name}</span>{discovery === spell.id && <em>NEW</em>}</b><button aria-label={`${spell.name} 효과 자세히`} onClick={() => detail(spell.name, `${AFFINITIES[spell.affinity].name} 속성 · ${spell.effect}${spell.id === 'water' && g.upgrades.waterDamage ? ` · 강화 피해 +${g.upgrades.waterDamage}` : ''}\n${spell.fact}${!spell.attack && spell.id !== 'oxygen' && g.upgrades.shieldBonus ? `\n보호막 강화 +${g.upgrades.shieldBonus}` : ''}`)}>효과 ⓘ</button></> : <span>{busy ? '마법이 펼쳐지는 중…' : selected.length ? '조합을 바꿔 보세요. 원소는 소모되지 않아요.' : '원소를 골라 마법을 만드세요'}</span>}</div>
      {busy ? <button className="primary-button instant-cast casting-button" disabled={notice} onClick={skip}>연출 넘기기 <small>»</small></button> : <button className="primary-button instant-cast" disabled={blocked || !spell || !left} onClick={() => act({ type: 'cast', ids: selected })}><Icon name="spark" size={17} /><span>마법 발동{spell && <small className="cast-estimate">{shortEffect}</small>}</span></button>}
    </section>
    <div className="spell-suggestions" aria-label="발견한 마법 추천"><span>빠른 조합</span>{known.map(s => <button key={s.id} disabled={blocked} title={s.name} aria-label={`${s.name} 자동 선택`} onClick={() => select(recipeIds(g.inventory, s)!)} style={{ color: s.color }}>{s.display}</button>)}{!known.length && !hint && <small>{craftable.length ? '발견한 조합 없음 · 직접 조합해 보세요' : '조합 가능한 마법 없음'}</small>}{hint && !blocked && <button className="discovery-hint" aria-label="새로운 마법을 발견할 수 있습니다! 힌트 보기" title="새로운 마법을 발견할 수 있습니다!" onClick={hint}><Icon name="bulb" size={15} /><span>발견 힌트</span></button>}</div>
    <section className={`compact-bag ${event?.kind === 'convert' && busy ? 'converting' : ''}`} aria-label="원소 보관함">
      <div className="bag-label"><span><Icon name="bag" size={13} /> 원소 가방</span><small>{g.inventory.length} / {g.upgrades.capacity}</small><button className={`reconstruction-control ${g.reconstruction === 100 ? 'ready' : ''}`} style={{'--charge': `${g.reconstruction * 3.6}deg`} as CSSProperties} aria-label={`원소 재구성 ${g.reconstruction}%`} aria-pressed={reconstructing} disabled={busy || reconstructing} onClick={openReconstruction}><span className="reconstruction-ring"><svg width="19" height="19" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4h9l-2-2m2 2-2 2M16 16H7l2 2m-2-2 2-2M3 6v7m14-6v7" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M8 8h4v4H8z" fill="currentColor"/></svg></span><small>재구성 {g.reconstruction}%</small></button>{event?.kind === 'convert' && busy && <strong className="conversion-note" role="status">{event.text}</strong>}</div>
      {reconstructing && <div className="reconstruction-choice" role="group" aria-label="재구성 원소 선택"><b>사용할 원소를 선택해주세요</b><small>원소 1개를 소모하고 무작위의 다른 원소 1개를 얻습니다.</small><div><span>{chosen ? `${ELEMENTS[chosen.element].name} ${chosen.element} → ?` : '가방에서 하나를 골라주세요'}</span><button onClick={() => { setReconstructing(false); setReconstructId(null); }}>취소</button><button disabled={!chosen || busy} onClick={reconstruct}>재구성 실행</button></div></div>}
      <div className={`inventory ${reconstructing ? 'reconstruction-selecting' : ''}`}>{g.inventory.map(tile => <ElementTile key={tile.id} tile={tile} selected={reconstructing ? reconstructId === tile.id : selected.includes(tile.id)} fresh={g.freshIds.includes(tile.id)} hint={!reconstructing && tutorial === 0 && !selected.includes(tile.id) && (tile.element === 'H' || tile.element === 'O')} onClick={() => toggle(tile.id)} disabled={busy || (!reconstructing && !selected.includes(tile.id) && selected.length >= B.maxSlots)} />)}{g.inventory.length === 0 && <p className="empty-bag">원소를 모두 썼어요. 턴을 마치면 새 원소를 얻어요.</p>}</div>
      {event?.kind === 'convert' && busy && <div className="conversion-tiles" aria-hidden="true">{event.tiles?.map((tile, i) => <i key={tile.id} style={{ animationDelay: `${i * 40 / speed}ms`, animationDuration: `${300 / speed}ms` }}>{tile.element}</i>)}</div>}
    </section>
    <footer className="player-dashboard">
      <PlayerStatus game={g} detail={detail} />
      <div className="player-vitals"><span><Icon name="heart" size={13} />HP</span><HealthBar value={g.hp} max={B.maxHp} player /><div className="spell-uses" aria-label={`남은 마법 ${left}회`}><span>마법</span>{[0, 1].map(i => <i key={i} className={i < left ? 'available' : ''} />)}<b>{left}/2</b></div></div>
      <div className={`mana-line ${g.mana === 100 ? 'full' : ''}`}><span>마력</span><div role="meter" aria-label="마력" aria-valuemin={0} aria-valuemax={100} aria-valuenow={g.mana}><i style={{ width: `${g.mana}%` }} /></div><b>{g.mana}<small>/100</small></b></div>
      <div className="turn-actions"><button className={`end-turn ${!canAttack && !busy ? 'suggested' : ''}`} disabled={blocked} onClick={() => act({ type: 'endTurn' })}><Icon name="wait" size={16} /><span>턴 종료</span></button><button className={`burst-button ${g.mana === 100 ? 'ready' : ''}`} disabled={blocked || g.mana < 100} onClick={() => act({ type: 'burst' })} aria-label="ZERO BURST"><Icon name="spark" size={14} /><span>ZERO BURST</span></button></div>
    </footer>
  </main>;
}
