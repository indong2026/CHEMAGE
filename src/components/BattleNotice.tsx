import type { GameEvent } from '../game/types';

export function BattleNotice({ event }: { event: GameEvent }) {
  const turn = event.kind === 'turn-banner', ready = event.kind === 'ready', death = event.kind === 'death';
  if (!turn && !ready && !death) return null;
  const enemy = event.target === 'enemy';
  return <div className={`battle-notice ${turn ? enemy ? 'enemy-turn' : 'player-turn' : ready ? 'burst-ready' : 'enemy-defeated'} ${death && event.frame?.enemy.id === 'golem' ? 'boss-defeated' : ''}`} key={`${event.kind}-${event.target}`} role="status" aria-live="polite">
    <div className="notice-band"><b>{turn ? enemy ? 'ENEMY TURN' : 'YOUR TURN' : ready ? 'ZERO BURST READY!' : 'ENEMY DEFEATED!'}</b><span>{turn ? enemy ? '적의 차례' : '당신의 차례' : ready ? '필살기 준비 완료!' : '적을 쓰러뜨렸습니다'}</span></div>
    {ready && <div className="ready-pixels" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ rotate: `${i * 45}deg` }} />)}</div>}
  </div>;
}
