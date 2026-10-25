import { AFFINITIES } from '../data/affinities';
import { Icon } from '../components/PixelArt';
import { SPELLS } from '../data/spells';
import type { SpellId } from '../game/types';
import { Modal } from '../components/Modal';
export function Codex({ discoveries, onClose, storageError }: { discoveries: SpellId[]; onClose: () => void; storageError: boolean }) {
  return <Modal title="화학 마법 도감" eyebrow={`THE ALCHEMIST'S ARCHIVE · ${discoveries.length} / ${SPELLS.length}`} onClose={onClose}>
    <p className="muted">화학식을 완성하고 마법을 사용하면 기록됩니다.</p>
    {storageError && <p className="warning">브라우저 저장소를 사용할 수 없어 이번 접속 중에만 기록됩니다.</p>}
    <div className="codex-list">{SPELLS.map((spell, i) => discoveries.includes(spell.id) ? <article key={spell.id} className="codex-entry">
      <span className="codex-formula" style={{ color: spell.color }}>{spell.display}</span><div><span className="eyebrow">{spell.substance}</span><h3>{spell.name}</h3><p className="recipe-line">{Object.entries(spell.recipe).map(([e, n]) => `${e} × ${n}`).join(' + ')}</p><p><b>화학 사실</b> · {spell.fact}</p><p className="codex-effect"><Icon name={AFFINITIES[spell.affinity].icon} size={13} /> 게임 설정 · {AFFINITIES[spell.affinity].name} 속성<br />{spell.effect}</p></div>
    </article> : <article key={spell.id} className="codex-entry undiscovered"><span className="codex-formula">?</span><div><span className="eyebrow">기록 {String(i + 1).padStart(2, '0')}</span><h3>아직 발견하지 못한 마법</h3><p>원소 속에 숨은 가능성을 찾아보세요.</p></div></article>)}</div>
    <p className="fine-print">물 → 화염, 부식 → 금속, 금속 → 결정은 게임에서 유리한 상성입니다. 화염 → 화염, 결정 → 금속, 물 → 결정은 저항입니다. 이 관계는 보편적인 화학 반응 법칙이 아닌 게임 설정입니다. 물질의 설명은 실제 화학에 기반합니다. 전투 효과는 판타지적 표현이며 실제 실험을 안내하지 않습니다.</p>
  </Modal>;
}
