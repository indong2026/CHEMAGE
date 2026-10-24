import type { CSSProperties } from 'react';
import { ELEMENTS } from '../data/elements';
import type { Tile } from '../game/types';
export function ElementTile({ tile, selected = false, onClick, disabled = false, slot = false, fresh = false, hint = false }: { tile: Tile; selected?: boolean; onClick: () => void; disabled?: boolean; slot?: boolean; fresh?: boolean; hint?: boolean }) {
  const data = ELEMENTS[tile.element];
  return <button type="button" className={`element-tile ${selected ? 'selected' : ''} ${slot ? 'slot-tile' : ''} ${fresh ? 'fresh-tile' : ''} ${hint ? 'hint-tile' : ''}`} style={{ '--element': data.color } as CSSProperties} onClick={onClick} disabled={disabled} aria-label={`${data.name} ${tile.element}${slot ? ' 선택 취소' : ''}`} aria-pressed={selected}>
    <span className="atomic-number">{data.number}</span><strong>{tile.element}</strong><span className="element-name">{data.name}</span>{selected && <span className="selected-mark">✓</span>}
  </button>;
}
