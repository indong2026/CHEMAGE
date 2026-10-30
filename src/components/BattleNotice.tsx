import { ENEMIES } from '../data/enemies';
import type { GameEvent } from '../game/types';
import { ELEMENTS } from '../data/elements';

export function BattleNotice({ event }: { event: GameEvent }) {
  if (event.kind === 'reconstruct-ready' || event.kind === 'reconstruct') return <div className={`battle-notice reconstruction-notice ${event.kind === 'reconstruct' ? 'reconstruction-result' : ''}`} role="status">
    <div className="notice-band"><b>{event.text}</b>{event.kind === 'reconstruct' ? <><div className="reconstruction-symbols"><i>{event.fromElement}</i><span>→</span><i>{event.toElement}</i></div><span>{event.toElement && ELEMENTS[event.toElement].name} {event.toElement} 원소를 획득했습니다.</span></> : <span>가방의 원소 1개를 다른 원소로 바꿔보세요.</span>}</div>
  </div>;
  const turn = event.kind === 'turn-banner', ready = event.kind === 'ready', death = event.kind === 'death';
  if (!turn && !ready && !death) return null;
  const enemy = event.target === 'enemy';
  return <div className={`battle-notice ${turn ? enemy ? 'enemy-turn' : 'player-turn' : ready ? 'burst-ready' : 'enemy-defeated'} ${death && (event.frame && !!ENEMIES[event.frame.enemy.id].boss) ? 'boss-defeated' : ''}`} key={`${event.kind}-${event.target}`} role="status" aria-live="polite">
    <div className="notice-band"><b>{turn ? enemy ? 'ENEMY TURN' : 'YOUR TURN' : ready ? 'ZERO BURST READY!' : 'ENEMY DEFEATED!'}</b><span>{turn ? enemy ? '적의 차례' : '당신의 차례' : ready ? '필살기 준비 완료!' : '적을 쓰러뜨렸습니다'}</span></div>
    {ready && <div className="ready-pixels" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ rotate: `${i * 45}deg` }} />)}</div>}
  </div>;
}
