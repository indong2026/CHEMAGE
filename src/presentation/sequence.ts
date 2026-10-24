import { battleFrame } from '../game/engine';
import type { GameEvent, GameState } from '../game/types';

/** Presentation only: boundary notices never execute game rules. */
export function battleSequence(game: GameState, announced: boolean, opening = false) {
  const events: GameEvent[] = [];
  let playerTurn: GameEvent | undefined;
  const source: GameEvent[] = opening
    ? [{ kind: 'turn', target: 'player', cue: 'system', text: '당신의 차례', frame: battleFrame(game) }]
    : game.events;
  for (const event of source) {
    if (event.frame && event.frame.mana < 100) announced = false;
    if (event.kind === 'turn' && event.target === 'player') { playerTurn = event; continue; }
    events.push(event.kind === 'turn' ? { ...event, kind: 'turn-banner' } : event);
  }
  // Notifications follow actions/overflow, never overlap an enemy attack or a death.
  if (game.screen === 'battle') {
    if (playerTurn) events.push({ ...playerTurn, kind: 'turn-banner', frame: battleFrame(game) });
    if (game.mana === 100 && !announced) {
      events.push({ kind: 'ready', cue: 'system', text: '필살기 준비 완료!', frame: battleFrame(game) });
      announced = true;
    }
  }
  return { events, announced };
}
