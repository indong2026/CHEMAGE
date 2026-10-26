import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Battle } from '../screens/Battle';
import { Codex } from '../screens/Codex';
import { Rewards } from '../screens/Results';
import { SPELLS } from '../data/spells';
import { newGame, performAction } from '../game/engine';
import type { GameEvent, GameState } from '../game/types';
const noop = () => {};
function battle(s: GameState, selected: number[], event: GameEvent | null = null) {
  return <Battle game={{...s,...event?.frame}} selected={selected} discoveries={SPELLS.map(s=>s.id)} busy={!!event} tutorial={3} event={event} eventIndex={0} speed={1} discovery={null} select={noop} act={noop} skip={noop} detail={noop} />;
}
it('NaOH 조합 시에만 중화 가능과 합산 예측을 표시하고 반응식은 실제 연출에서 한 번 보인다', () => {
  const s=newGame(()=>.5);s.inventory=[{id:1,element:'H'},{id:2,element:'Cl'},{id:3,element:'Na'},{id:4,element:'O'},{id:5,element:'H'}];
  const first=performAction(s,{type:'cast',ids:[1,2]},s.revision,()=>.5);
  const view=render(battle(first,[3,4,5]));
  expect(screen.getByText('중화 반응 가능!')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:/마법 발동/})).toHaveTextContent('예상 피해 17 · 보호막 +6');
  expect(screen.queryByText('HCl + NaOH → NaCl + H₂O')).toBeNull();
  const n=performAction(first,{type:'cast',ids:[3,4,5]},first.revision,()=>.5);
  const e=n.events.find(e=>e.kind==='reaction')!;view.rerender(battle(n,[],e));
  expect(screen.getAllByText('HCl + NaOH → NaCl + H₂O')).toHaveLength(1);expect(screen.getByText('NEW REACTION')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'턴 종료'})).toBeDisabled();view.rerender(battle(n,[]));
  expect(screen.queryByText('HCl + NaOH → NaCl + H₂O')).toBeNull();
});
it('반응 기록 탭은 발견한 반응만 열고 화학식과 게임 효과를 구분한다', () => {
  render(<Codex discoveries={['water','iron']} reactions={['neutralization','crystallization']} storageError={false} onClose={noop} />);
  expect(screen.getByRole('tab',{name:'전체 마법 2/19'})).toHaveAttribute('aria-selected','true');
  fireEvent.click(screen.getByRole('tab',{name:'반응 기록 2/4'}));
  expect(screen.getByText('HCl + NaOH → NaCl + H₂O')).toBeInTheDocument();
  expect(screen.getAllByText('? 미발견 반응')).toHaveLength(2);
  expect(screen.getByText(/새로운 물질이 생기는 화학 반응식으로 취급하지 않습니다/)).toBeInTheDocument();
  expect(screen.queryByText('CH₄ + 2O₂ → CO₂ + 2H₂O')).toBeNull();
});
it('원소 공명은 같은 보상 화면에서 원소를 고른 후에만 적용하고 최대 가중치는 비활성화한다', () => {
  const s=newGame(()=>.5);s.screen='reward';s.rewards=['reaction','research','resonance'];s.upgrades.resonance.H=2;
  const choose=vi.fn();render(<Rewards game={s} choose={choose} />);
  fireEvent.click(screen.getByRole('button',{name:/원소 공명/}));expect(choose).not.toHaveBeenCalled();
  expect(screen.getByRole('button',{name:'H 공명 선택'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Cl 공명 선택'}));expect(choose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Cl 공명 확정 · 다음 전투'}));expect(choose).toHaveBeenCalledOnce();expect(choose).toHaveBeenCalledWith('resonance','Cl');
});
it('공격 약화와 취약을 각각 적과 내 상태에 표시하고 예고 피해를 보정한다', () => {
  const s=newGame(()=>.5);s.enemy.id='gel';s.enemy.weaken=1;s.vulnerable=true;s.enemy.intent={type:'attack',value:14,label:'부식 강타'};
  render(battle(s,[]));expect(screen.getByLabelText('공격 약화 설명')).toBeInTheDocument();expect(screen.getByLabelText('취약 설명')).toHaveTextContent('피해 +3');
  expect(document.querySelector('.combat-intent')).toHaveTextContent('부식 강타 14');
});
