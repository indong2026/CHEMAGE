import { useState, type CSSProperties } from 'react';
import { ELEMENTS, ELEMENT_KEYS } from '../data/elements';
import { spellsForElement } from '../game/codex';
import '../styles/codex.css';
import { REACTIONS, REACTION_IDS } from '../data/reactions';
import { AFFINITIES } from '../data/affinities';
import { Icon } from '../components/PixelArt';
import { SPELLS, type Spell } from '../data/spells';
import type { Element, SpellId, ReactionId } from '../game/types';
import { Modal } from '../components/Modal';
import { HintDetail } from '../components/HintDetail';
import { emptyHints, hintLevel, type HintProgress, type HintTarget } from '../game/hints';

function SpellEntry({ spell }: { spell: Spell }) {
  return <article className="codex-entry"><span className="codex-formula" style={{ color: spell.color }}>{spell.display}</span><div><span className="eyebrow">{spell.substance}</span><h3>{spell.name}</h3><p className="recipe-line">{Object.entries(spell.recipe).map(([e, n]) => `${e} × ${n}`).join(' + ')}</p><p><b>화학 사실</b> · {spell.fact}</p><p className="codex-effect"><Icon name={AFFINITIES[spell.affinity].icon} size={13} /> 게임 설정 · {AFFINITIES[spell.affinity].name} 속성<br />{spell.effect}</p></div></article>;
}
export function Codex({ discoveries, reactions = [], onClose, storageError, hints = emptyHints(), onReveal = () => {}, initialTarget = null }: {
  discoveries: SpellId[]; reactions?: ReactionId[]; onClose: () => void; storageError: boolean;
  hints?: HintProgress; onReveal?: (target: HintTarget) => void; initialTarget?: HintTarget | null;
}) {
  const [tab, setTab] = useState<'magic' | 'element' | 'reaction'>(initialTarget?.kind ?? 'magic');
  const [element, setElement] = useState<Element>(ELEMENT_KEYS[0]);
  const [target, setTarget] = useState<HintTarget | null>(initialTarget);
  const [returnTo, setReturnTo] = useState<HintTarget | null>(null);
  const switchTab = (value: 'magic' | 'element' | 'reaction') => { setTab(value); setTarget(null); setReturnTo(null); };
  const back = () => { setTarget(returnTo); if (returnTo) setTab(returnTo.kind); setReturnTo(null); };
  const knownTarget = target?.kind === 'magic' && discoveries.includes(target.id) ? SPELLS.find(s => s.id === target.id) : undefined;
  const known = new Set(discoveries);
  const discoveredCount = SPELLS.filter(spell => known.has(spell.id)).length;
  const visibleSpells = tab === 'element' ? spellsForElement(element) : SPELLS;
  return <Modal title="CHEMAGE 도감" eyebrow={`THE ALCHEMIST'S ARCHIVE · ${discoveredCount} / ${SPELLS.length}`} onClose={onClose}>
    <div className="codex-tabs" role="tablist" aria-label="도감 종류"><button role="tab" aria-selected={tab === 'magic'} onClick={() => switchTab('magic')}>전체 마법 <small>{discoveredCount}/{SPELLS.length}</small></button><button role="tab" aria-selected={tab === 'element'} onClick={() => switchTab('element')}>원소별 보기</button><button role="tab" aria-selected={tab === 'reaction'} onClick={() => switchTab('reaction')}>반응 기록 <small>{reactions.length}/{REACTION_IDS.length}</small></button></div>
    {storageError && <p className="warning">브라우저 저장소를 사용할 수 없어 이번 접속 중에만 기록됩니다.</p>}
    {target ? knownTarget ? <><button className="text-button" onClick={back}>← 목록으로</button><SpellEntry spell={knownTarget} /></> : <HintDetail target={target} hints={hints} discoveries={discoveries} reveal={onReveal} back={back} openMagic={id => { setReturnTo(target); setTab('magic'); setTarget({ kind: 'magic', id }); }} /> : tab === 'reaction' ? <div className="reaction-records">{REACTION_IDS.map((id, i) => reactions.includes(id) ? <article key={id}><h3>{REACTIONS[id].name}</h3><b>{REACTIONS[id].spells}</b>{REACTIONS[id].equation && <p className="reaction-equation">{REACTIONS[id].equation}</p>}<p>{REACTIONS[id].concept}</p><p className="codex-effect">게임 효과 · {REACTIONS[id].effect}</p></article> : <button key={id} className="unknown-reaction" aria-label={`미발견 반응 ${i + 1} 힌트`} onClick={() => setTarget({kind:'reaction', id})}><b>? 미발견 반응</b><small>연구 힌트 {hints.reaction[id] ?? 0}/3 →</small></button>)}</div> : <>
      {tab === 'element' ? <>
        <div className="codex-elements" role="group" aria-label="원소 선택">{ELEMENT_KEYS.map(key => <button key={key} className={`element-tile ${element === key ? 'selected' : ''}`} style={{ '--element': ELEMENTS[key].color } as CSSProperties} aria-pressed={element === key} aria-label={`${ELEMENTS[key].name} ${key} · ${spellsForElement(key).length}종`} onClick={() => setElement(key)}><b>{key}</b><small>{spellsForElement(key).length}종</small></button>)}</div>
        <p className="element-progress" aria-live="polite">{ELEMENTS[element].name}({element}) 관련 마법 <b>{visibleSpells.filter(spell => known.has(spell.id)).length}/{visibleSpells.length}</b> 발견</p>
      </> : <p className="muted">직접 화학식을 조합한 뒤 시전하면 마법이 기록됩니다. 막히면 미발견 항목의 힌트를 열어 보세요.</p>}
      <div className={`codex-list ${tab === 'element' ? 'element-spells' : ''}`} aria-label={tab === 'element' ? `${ELEMENTS[element].name} 관련 마법` : '전체 마법 목록'}>{visibleSpells.map(spell => {
        const index = SPELLS.indexOf(spell) + 1;
        if (known.has(spell.id)) return tab === 'element' ? <button key={spell.id} className="codex-entry codex-summary" onClick={() => setTarget({kind:'magic',id:spell.id})}><span className="codex-formula" style={{color:spell.color}}>{spell.display}</span><span><strong>{spell.name}</strong><small>상세 보기 →</small></span></button> : <SpellEntry key={spell.id} spell={spell} />;
        return <button key={spell.id} className="codex-entry undiscovered" aria-label={`미발견 마법 ${index} 힌트`} onClick={() => setTarget({kind:'magic',id:spell.id})}><span className="codex-formula">???</span><span><span className="eyebrow"><Icon name="lock" size={11} /> 기록 {String(index).padStart(2, '0')}</span><strong>미발견 마법</strong><small>연구 힌트 {hintLevel(hints,{kind:'magic',id:spell.id})}/3 →</small></span></button>;
      })}</div>
      {tab === 'magic' && <p className="fine-print">물 → 화염, 부식 → 금속, 금속 → 결정은 게임에서 유리한 상성입니다. 화염 → 화염, 결정 → 금속, 물 → 결정은 저항입니다. 이 관계는 보편적인 화학 반응 법칙이 아닌 게임 설정입니다. 전투 효과는 판타지적 표현이며 실제 실험을 안내하지 않습니다.</p>}
    </>}
  </Modal>;
}
