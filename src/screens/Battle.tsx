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
  detail: (title: string, text: string) => void;
};
export function Battle({ game: g, selected, discoveries, busy, tutorial, event, eventIndex, speed, discovery, select, act, skip, detail }: Props) {
  const tiles = selected.map(id => g.inventory.find(t => t.id === id)!).filter(Boolean);
  const spell = matchRecipe(tiles.map(t => t.element));
  const shortEffect = spell?.id === 'water' ? `기본 피해 ${B.water.damage + g.upgrades.waterDamage}` : spell?.effect.split(' · ')[0].replace(/^피해/, '기본 피해');
  const known = suggestions(g.inventory, discoveries);
  const left = Math.max(0, B.spellsPerTurn - g.spellsUsed);
  const toggle = (id: number) => { if (!busy) select(selected.includes(id) ? selected.filter(x => x !== id) : selected.length < B.maxSlots ? [...selected, id] : selected); };
  const guide = tutorial === 0 ? 'H 두 개와 O 하나를 눌러 조합해 보세요.' : tutorial === 1 ? '완성! 아래 마법 발동을 눌러 보세요.' : '한 번 더 시전하거나, 턴을 끝내 적의 공격을 확인하세요.';
  return <main className="battle phase-three">
    <div className="battle-progress"><span>실험실 {g.stage + 1} <small>/ 5</small></span><div aria-label={`5전투 중 ${g.stage + 1}번째`}>{g.route.map((_, i) => <i key={i} className={i <= g.stage ? 'lit' : ''} />)}</div><span>턴 {g.turn}</span></div>
    <CombatScene game={g} event={event} eventIndex={eventIndex} busy={busy} speed={speed} detail={detail} />
    {tutorial < 3 && g.stage === 0 && <div className="first-lesson" role="status"><span>{tutorial + 1}/3</span>{guide}</div>}
    <section className={`instant-composer ${spell ? 'complete' : ''}`} aria-label="마법 조합">
      <div className="instant-slots">{Array.from({ length: B.maxSlots }, (_, i) => tiles[i] ? <ElementTile key={i} tile={tiles[i]} slot onClick={() => toggle(tiles[i].id)} disabled={busy} /> : <span className="instant-empty" key={i} aria-hidden="true">{tutorial === 0 && i < 3 ? ['H', 'H', 'O'][i] : '+'}</span>)}<button className="clear-selection" aria-label="선택 해제" disabled={busy || !selected.length} onClick={() => select([])}><Icon name="close" size={14} /></button></div>
      <div className="instant-result" aria-live="polite">{spell ? <><b style={{ color: spell.color }}>{spell.display} <span>{spell.name}</span>{discovery === spell.id && <em>NEW</em>}</b><button aria-label={`${spell.name} 효과 자세히`} onClick={() => detail(spell.name, `${spell.effect}${spell.id === 'water' && g.upgrades.waterDamage ? ` · 강화 피해 +${g.upgrades.waterDamage}` : ''}\n${spell.fact}`)}>효과 ⓘ</button></> : <span>{busy ? '마법이 펼쳐지는 중…' : selected.length ? '조합을 바꿔 보세요. 원소는 소모되지 않아요.' : '원소를 골라 마법을 만드세요'}</span>}</div>
      {busy ? <button className="primary-button instant-cast casting-button" onClick={skip}>연출 넘기기 <small>»</small></button> : <button className="primary-button instant-cast" disabled={!spell || !left} onClick={() => act({ type: 'cast', ids: selected })}><Icon name="spark" size={17} />마법 발동{spell && <small>{shortEffect}</small>}</button>}
    </section>
    <div className="spell-suggestions" aria-label="발견한 마법 추천"><span>빠른 조합</span>{known.map(s => <button key={s.id} disabled={busy} title={s.name} aria-label={`${s.name} 자동 선택`} onClick={() => select(recipeIds(g.inventory, s)!)} style={{ color: s.color }}>{s.display}</button>)}{!known.length && <small>{discoveries.length ? '원소를 더 모아 보세요' : '발견한 마법이 여기에 표시돼요'}</small>}</div>
    <section className={`compact-bag ${event?.kind === 'convert' && busy ? 'converting' : ''}`} aria-label="원소 보관함">
      <div className="bag-label"><span><Icon name="bag" size={13} /> 원소 가방</span><small>{g.inventory.length} / {g.upgrades.capacity}</small>{event?.kind === 'convert' && busy && <strong className="conversion-note" role="status">{event.text}</strong>}</div>
      <div className="inventory">{g.inventory.map(tile => <ElementTile key={tile.id} tile={tile} selected={selected.includes(tile.id)} fresh={g.freshIds.includes(tile.id)} hint={tutorial === 0 && !selected.includes(tile.id) && (tile.element === 'H' || tile.element === 'O')} onClick={() => toggle(tile.id)} disabled={busy || (!selected.includes(tile.id) && selected.length >= B.maxSlots)} />)}{g.inventory.length === 0 && <p className="empty-bag">원소를 모두 썼어요. 턴을 마치면 새 원소를 얻어요.</p>}</div>
      {event?.kind === 'convert' && busy && <div className="conversion-tiles" aria-hidden="true">{event.tiles?.map((tile, i) => <i key={tile.id} style={{ animationDelay: `${i * 40 / speed}ms`, animationDuration: `${300 / speed}ms` }}>{tile.element}</i>)}</div>}
    </section>
    <footer className="player-dashboard">
      <div className="player-vitals"><span><Icon name="heart" size={13} />HP</span><HealthBar value={g.hp} max={B.maxHp} player /><div className="spell-uses" aria-label={`남은 마법 ${left}회`}><span>마법</span>{[0, 1].map(i => <i key={i} className={i < left ? 'available' : ''} />)}<b>{left}/2</b></div></div>
      <div className={`mana-line ${g.mana === 100 ? 'full' : ''}`}><span>마력</span><div role="meter" aria-label="마력" aria-valuemin={0} aria-valuemax={100} aria-valuenow={g.mana}><i style={{ width: `${g.mana}%` }} /></div><b>{g.mana}<small>/100</small></b></div>
      <div className="turn-actions"><button disabled={busy} onClick={() => act({ type: 'guard' })}><Icon name="shield" size={14} />방어<small>+{g.upgrades.guard}</small></button><button disabled={busy} onClick={() => act({ type: 'endTurn' })}>턴 종료<small>→</small></button><button className={`burst-button ${g.mana === 100 ? 'ready' : ''}`} disabled={busy || g.mana < 100} onClick={() => act({ type: 'burst' })} aria-label="ZERO BURST"><Icon name="spark" size={14} /><span>ZERO BURST</span></button></div>
    </footer>
  </main>;
}
