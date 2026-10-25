import { SPELL_BY_ID } from '../data/spells';
import { REACTION_HINTS, spellHints } from '../data/hints';
import { hintLevel, type HintProgress, type HintTarget } from '../game/hints';
import type { SpellId } from '../game/types';
import { Icon } from './PixelArt';

export function HintDetail({ target, hints, discoveries, reveal, openMagic, back }: {
  target: HintTarget; hints: HintProgress; discoveries: SpellId[];
  reveal: (target: HintTarget) => void; openMagic: (id: SpellId) => void; back: () => void;
}) {
  const level = hintLevel(hints, target);
  const reaction = target.kind === 'reaction' ? REACTION_HINTS[target.id] : null;
  const stages = target.kind === 'magic' ? spellHints(target.id) : [reaction!.principle, reaction!.clue, reaction!.order];
  const titles = target.kind === 'magic' ? ['물질의 특징', '필요한 원소', '정확한 조합'] : ['반응 원리', '관련 마법', '정확한 사용 순서'];
  return <section className="hint-detail" aria-label={target.kind === 'magic' ? '마법 연구 힌트' : '반응 연구 힌트'}>
    <button className="text-button" onClick={back}>← 목록으로</button>
    <h3><Icon name="bulb" size={18} /> {target.kind === 'magic' ? '미발견 마법' : '미발견 반응'} <small>{level}/3</small></h3>
    {level === 0 && <p className="muted">원할 때 하나씩 열어 보세요. 힌트는 무료이며 원소나 턴을 소모하지 않아요.</p>}
    <div aria-live="polite">{stages.slice(0, level).map((text, i) => <article key={i}><b>{i + 1}단계 · {titles[i]}</b><p>{text}</p>{i === 1 && reaction && <div className="hint-links" aria-label="관련 마법 힌트">{reaction.pair.map((id, n) => <button key={id} onClick={() => openMagic(id)} aria-label={`${n + 1}번째 관련 마법 ${discoveries.includes(id) ? SPELL_BY_ID[id].display : '???'} 보기`}>{n + 1}. {discoveries.includes(id) ? SPELL_BY_ID[id].display : '???'} <small>{discoveries.includes(id) ? '상세 보기' : '마법 힌트'}</small></button>)}</div>}</article>)}</div>
    {level < 3 && <button className="secondary-button" onClick={() => reveal(target)}>{level + 1}단계 힌트 열기 <small>무료</small></button>}
    <p className="fine-print">힌트를 읽어도 발견되지 않습니다. {target.kind === 'magic' ? '직접 조합한 뒤 마법을 발동해 보세요.' : '전투에서 실제 연계를 성공시켜 보세요.'}</p>
  </section>;
}
