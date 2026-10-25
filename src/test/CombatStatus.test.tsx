import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Battle } from '../screens/Battle';
import { ENEMIES } from '../data/enemies';
import { newGame, performAction } from '../game/engine';
import type { GameEvent, GameState } from '../game/types';

function scene(s: GameState, event: GameEvent | null = null, detail = vi.fn()) {
  return <Battle game={{ ...s, ...event?.frame }} selected={[]} discoveries={[]} busy={!!event} tutorial={3} event={event} eventIndex={0} speed={1.5} discovery={null} select={() => {}} act={() => {}} skip={() => {}} detail={detail} />;
}
describe('PHASE 4 전투 정보와 연속 타격', () => {
  it('적 방어력·보호막·상태와 내 보호막·강화를 다른 영역에 표시하고 설명은 터치할 때만 연다', () => {
    const s = newGame(() => .5), detail = vi.fn();
    s.enemy.id = 'beetle'; s.enemy.shield = 8; s.enemy.wet = 1; s.enemy.acid = 2; s.playerShield = 28; s.boost = true;
    render(scene(s, null, detail));
    const enemy = within(screen.getByLabelText('적 전투 상태')), player = within(screen.getByLabelText('플레이어 전투 상태'));
    expect(enemy.getByLabelText('적 방어력 설명')).toHaveTextContent('방어력 2');
    expect(enemy.getByLabelText('적 보호막 설명')).toHaveTextContent('보호막 8');
    expect(enemy.getByLabelText('젖음 설명')).toHaveTextContent('1');
    expect(enemy.getByLabelText('부식 설명')).toHaveTextContent('2');
    expect(player.getByLabelText('내 보호막 설명')).toHaveTextContent('28');
    expect(player.getByLabelText('옥시 강화 설명')).toHaveTextContent('+10');
    expect(player.queryByLabelText('적 보호막 설명')).toBeNull();
    expect(detail).not.toHaveBeenCalled(); fireEvent.click(screen.getByLabelText('약점 부식'));
    expect(detail).toHaveBeenCalledWith('약점', expect.stringContaining('1.5배'));
    expect(screen.getByRole('button', { name: '턴 종료' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /방어하고/ })).toBeNull();
  });
  it('0 방어력과 보호막을 숨겨 중립 적의 기본 정보를 간결하게 표시한다', () => {
    const s = newGame(() => .5); render(scene(s));
    expect(screen.queryByLabelText('적 방어력 설명')).toBeNull();
    expect(screen.queryByLabelText('적 보호막 설명')).toBeNull();
    expect(screen.queryByLabelText('플레이어 전투 상태')).toBeNull();
    expect(screen.getByLabelText('적 속성 중립')).toBeInTheDocument();
  });
  it('부식 명중 시 HP·흡수 피해·방어력 감소·상성·파괴를 구분한다', () => {
    const s = newGame(() => .5); s.enemy.id = 'beetle'; s.enemy.hp = 60; s.enemy.shield = 3;
    s.inventory = [{ id: 1, element: 'H' }, { id: 2, element: 'Cl' }];
    const n = performAction(s, { type: 'cast', ids: [1, 2] }, s.revision, () => .5), e = n.events.find(e => e.cue === 'impact')!;
    const view = render(scene(n, e));
    expect(screen.getByLabelText('적 체력')).toHaveAttribute('aria-valuenow', '58');
    expect(screen.getByText('−2')).toBeInTheDocument(); expect(screen.getByText('보호막 −3')).toBeInTheDocument();
    expect(screen.getByText('방어력 5 → 2')).toBeInTheDocument(); expect(screen.getByText('효과가 굉장하다!')).toBeInTheDocument();
    expect(screen.getByText('SHIELD BREAK!')).toBeInTheDocument();
    view.rerender(scene(n)); expect(screen.queryByText('SHIELD BREAK!')).toBeNull(); expect(screen.queryByText('효과가 굉장하다!')).toBeNull();
  });
  it('정예 3연타는 타격마다 보호막 32→25→18→11을 표시하고 마지막에만 만료된다', () => {
    const s = newGame(() => .5); s.enemy.id = 'elite'; s.enemy.intent = ENEMIES.elite.pattern[2]; s.playerShield = 32;
    const n = performAction(s, { type: 'endTurn' }, s.revision, () => .5);
    const hits = n.events.filter(e => e.target === 'player' && e.cue === 'impact');
    const view = render(scene(s));
    expect(document.querySelector('.combat-intent')).toHaveTextContent('3연타 7 + 7 + 7');
    hits.forEach((e, i) => {
      view.rerender(scene(n, e)); expect(screen.getByText(`${i + 1}/3 타격`)).toBeInTheDocument();
      expect(screen.getByLabelText('내 보호막 설명')).toHaveTextContent(String(32 - 7 * (i + 1)));
      expect(screen.getByText('보호막 −7')).toBeInTheDocument(); expect(screen.getByText('BLOCK!')).toBeInTheDocument();
      expect(screen.getByLabelText('내 체력')).toHaveAttribute('aria-valuenow', '60');
    });
    expect(n.events.filter(e => e.kind === 'shield-end')).toHaveLength(1);
    view.rerender(scene(n)); expect(screen.queryByLabelText('내 보호막 설명')).toBeNull(); expect(n.turn).toBe(2);
  });
});
