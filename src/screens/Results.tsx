import { useRef, useState } from 'react';
import { SPELLS } from '../data/spells';
import { ELEMENTS, ELEMENT_KEYS } from '../data/elements';
import { elementProbabilities } from '../game/random';
import { Icon, Sprite } from '../components/PixelArt';
import { REWARDS } from '../data/rewards';
import { ENEMIES } from '../data/enemies';
import type { GameState, RewardId, Element } from '../game/types';
export function Rewards({ game: g, choose }: { game: GameState; choose: (id: RewardId, element?: Element) => void }) {
  const [resonance, setResonance] = useState(false);
  const [element, setElement] = useState<Element | null>(null);
  const submitted = useRef(false);
  const rates = elementProbabilities(g.upgrades.resonance);
  const confirm = (id: RewardId, e?: Element) => {
    if (submitted.current) return;
    submitted.current = true; choose(id, e);
  };
  const related = element ? SPELLS.filter(s => !!s.recipe[element]) : [];
  return <main className="reward-screen"><span className="eyebrow">ENCOUNTER 0{g.stage + 1} COMPLETE</span><div className="victory-rune"><Icon name="spark" size={42} /></div><h1>멋진 합성이었어요.</h1><p className="muted">{ENEMIES[g.enemy.id].name} 격파</p><div className="heal-badge"><Icon name="heart" />승리 회복 적용 · 현재 HP {g.hp} / 60</div><div className="reward-title"><h2>다음 실험을 위한 선물</h2><p>하나를 선택하세요. 공명은 원소를 고른 뒤 확정합니다.</p></div>
    <div className="reward-options">{g.rewards.map(id => {
      const r = REWARDS.find(r => r.id === id)!;
      if (id === 'resonance') return <div key={id} className="resonance-reward pixel-panel">
        <button className="reward-option" onClick={() => setResonance(v => !v)} aria-expanded={resonance}><span className="reward-icon"><Icon name="spark" size={25} /></span><span><b>{r.name}</b><small>{r.description}</small></span></button>
        {resonance && <>
          <div className="resonance-options" aria-label="공명 원소">{ELEMENT_KEYS.map(e => {
            const before = g.upgrades.resonance[e] ?? 1, after = Math.min(2, before + .5);
            const next = elementProbabilities({ ...g.upgrades.resonance, [e]: after });
            return <button key={e} disabled={before >= 2} aria-pressed={e === element} onClick={() => setElement(e)} aria-label={e + ' 공명 선택'}><b style={{ color: ELEMENTS[e].color }}>{e} · {ELEMENTS[e].name}</b><small>{before >= 2 ? '최대 2배' : (rates[e] * 100).toFixed(1) + '% → ' + (next[e] * 100).toFixed(1) + '%'}</small></button>;
          })}</div>
          {element ? <section className="resonance-preview" aria-label="원소 공명 미리보기" aria-live="polite">
            <h3>{element} · {ELEMENTS[element].name}</h3>
            <p>다음 전투 시작: <b>{element} 2개 확정 + 무작위 3개</b><br />총 5개 · 확정 지급은 이번 한 번</p>
            <p>추첨 가중치 {(g.upgrades.resonance[element] ?? 1).toFixed(1)}배 → {Math.min(2, (g.upgrades.resonance[element] ?? 1) + .5).toFixed(1)}배 · 모험 종료까지<br /><small>표시된 확률은 전체 원소 가중치를 재정규화한 값입니다.</small></p>
            <b className="related-title">관련 마법</b><ul>{related.map(s => <li key={s.id}>{g.discoveries.includes(s.id) ? <><b>{s.display}</b> {s.name}</> : <span>??? · 미발견 마법</span>}</li>)}</ul>
            <button className="primary-button" onClick={() => confirm('resonance', element)}>{element} 공명 확정 · 다음 전투</button>
          </section> : <p className="resonance-prompt">원소를 고르면 관련 마법을 미리 볼 수 있어요.</p>}
        </>}
      </div>;
      return <button key={id} className="reward-option pixel-panel" onClick={() => confirm(id)}><span className={'reward-icon reward-' + id}><Icon name={r.rune} size={25} /></span><span><b>{r.name}</b><small>{r.description}</small>{id === 'heal' && g.hp === 60 && <em>체력이 가득 차 효과가 없습니다</em>}</span><span className="reward-arrow">→</span></button>;
    })}</div><p className="next-enemy">다음 전투 <b>{ENEMIES[g.route[g.stage + 1]].name}</b></p>
  </main>;
}
export function Ending({ game: g, restart, menu, codex }: { game: GameState; restart: () => void; menu: () => void; codex: () => void }) {
  const win = g.screen === 'victory';
  return <main className={`ending-screen ${win ? 'won' : ''}`}><span className="eyebrow">{win ? 'THE CRYSTAL IS QUIET AGAIN' : 'EVERY EXPERIMENT TEACHES YOU'}</span><div className="ending-art"><Sprite name={win ? 'flask' : 'mage'} /></div><h1>{win ? '마법은, 당신 안에.' : '아직 끝나지 않은 실험'}</h1><p>{win ? '크리스탈 골렘을 쓰러뜨렸습니다.\n다섯 번의 전투, 당신만의 해답을 찾았어요.' : '이번 모험은 여기까지.\n발견한 마법과 함께 다시 도전해 보세요.'}</p><div className="run-stats"><span><strong>{g.stats.defeated}<small>/5</small></strong>완료한 전투</span><span><strong>{g.stats.casts}</strong>사용한 마법</span><span><strong>{g.stats.turns}</strong>지나온 턴</span></div><button className="primary-button" onClick={restart}><Icon name="refine" />다시 모험하기</button><button className="secondary-button" onClick={codex}><Icon name="book" />발견한 마법 보기</button><button className="text-button" onClick={menu}>메인 메뉴</button></main>;
}
