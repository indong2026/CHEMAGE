import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { CODEX_KEY } from '../game/codex';
import type { Element } from '../game/types';
const scenario = vi.hoisted(() => ({ mode: 'normal' }));
vi.mock('../game/engine', async importOriginal => {
  const original = await importOriginal<typeof import('../game/engine')>();
  return { ...original, newGame: () => {
    const s = original.newGame(() => .99);
    const elements: Element[] = scenario.mode === 'overflow' ? Array(12).fill('Na') : scenario.mode === 'shield' ? ['Fe', 'C', 'O', 'O', 'Na'] : ['H', 'H', 'O', 'Na', 'Cl'];
    s.inventory = elements.map((element, i) => ({ id: i + 1, element })); s.nextId = 100;
    if (scenario.mode === 'boss') { s.stage = 4; s.enemy.id = 'golem'; s.enemy.hp = 1; }
    if (scenario.mode === 'burst') { s.mana = 100; s.enemy.id = 'golem'; s.enemy.hp = 120; }
    if (scenario.mode === 'ready') s.mana = 90;
    if (scenario.mode === 'shield') s.enemy.intent = { type: 'attack', value: 24, label: '결정 강타' };
    if (scenario.mode === 'defeat') { s.hp = 1; s.enemy.intent = { type: 'attack', value: 20, label: '공격' }; }
    if (scenario.mode === 'reward') { s.screen = 'reward'; s.rewards = ['bag', 'water', 'heal']; s.hp = 60; }
    return s;
  } };
});
beforeEach(() => { localStorage.clear(); scenario.mode = 'normal'; vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());
function start(opening = false) { render(<App />); fireEvent.click(screen.getByRole('button', { name: /새로운 모험/ })); if (!opening) finish(); }
function select(name: string, index = 0) { fireEvent.click(within(screen.getByRole('region', { name: '원소 보관함' })).getAllByRole('button', { name })[index]); }
function water() { select('수소 H'); select('수소 H', 1); select('산소 O'); }
function finish() { act(() => vi.runAllTimers()); }
function cast() { fireEvent.click(screen.getByRole('button', { name: /마법 발동/ })); }

describe('즉시 시전 UI', { timeout: 15_000 }, () => {
  it('시작 배너 동안 입력 잠금, 첫 마법에는 배너 없이 두 번째 뒤 적 턴으로 전환한다', () => {
    start(true); expect(screen.getByText('YOUR TURN', { selector: '.notice-band b' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /턴 종료/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /연출 넘기기/ })).toBeDisabled(); finish();
    expect(screen.queryByRole('button', { name: /방어하고/ })).not.toBeInTheDocument();
    water(); cast(); finish(); expect(document.querySelector('.battle-notice')).toBeNull();
    select('나트륨 Na'); select('염소 Cl'); expect(screen.getByText('예상 피해 15 · COMBO 가능')).toBeInTheDocument(); cast();
    act(() => vi.advanceTimersByTime(580)); expect(screen.getByText('ENEMY TURN')).toBeInTheDocument();
    expect(screen.getByLabelText('내 체력')).toHaveAttribute('aria-valuenow', '60'); finish();
    expect(screen.getByText('턴 2')).toBeInTheDocument(); expect(screen.getByLabelText('내 체력')).toHaveAttribute('aria-valuenow', '52');
  });
  it('턴 종료 연타는 무료 보호막 없이 적이 한 번만 행동한다', () => {
    start(); const button = screen.getByRole('button', { name: /턴 종료/ });
    fireEvent.click(button); fireEvent.click(button); fireEvent.click(button);
    expect(screen.queryByLabelText('내 보호막 설명')).not.toBeInTheDocument(); finish();
    expect(screen.getByText('턴 2')).toBeInTheDocument(); expect(screen.getByLabelText('내 체력')).toHaveAttribute('aria-valuenow', '52');
    expect(screen.queryByLabelText('내 보호막 설명')).not.toBeInTheDocument();
  });
  it('READY는 100 도달 시 한 번 표시되고 같은 100에서 재알림하지 않는다', () => {
    scenario.mode = 'ready'; start(); water(); cast(); act(() => vi.advanceTimersByTime(580));
    expect(screen.getByText('ZERO BURST READY!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ZERO BURST' })).toBeDisabled(); finish();
    expect(screen.getByRole('button', { name: 'ZERO BURST' })).toHaveClass('ready');
    fireEvent.click(screen.getByRole('button', { name: /턴 종료/ }));
    for (let i = 0; i < 25; i++) { act(() => vi.advanceTimersByTime(100)); expect(screen.queryByText('ZERO BURST READY!')).not.toBeInTheDocument(); }
    finish(); expect(screen.getByRole('button', { name: 'ZERO BURST' })).toBeEnabled();
  });
  it('보호막은 총합 하나와 증가량, 강공격은 실제 예고 수치를 표시한다', () => {
    scenario.mode = 'shield'; start(); expect(screen.getByText('강공격 준비!')).toBeInTheDocument();
    expect(document.querySelector('.combat-intent')).toHaveTextContent('결정 강타 24');
    select('철 Fe'); expect(screen.getByText('보호막 +16 · 총 16')).toBeInTheDocument(); cast(); finish();
    select('탄소 C'); select('산소 O'); select('산소 O', 1);
    expect(screen.getByText('보호막 +12 · 총 28')).toBeInTheDocument(); cast(); act(() => vi.advanceTimersByTime(270));
    expect(screen.getByLabelText('내 보호막 설명')).toHaveTextContent('28'); expect(document.querySelector('.shield-gain')).toHaveTextContent('+12');
    expect(document.querySelector('.persistent-ward')).toHaveClass('ward-gain'); finish(); expect(screen.getByLabelText('내 체력')).toHaveAttribute('aria-valuenow', '60');
  });
  it('조합이 없으면 안내와 턴 종료 버튼을 강조한다', () => {
    scenario.mode = 'overflow'; start(); expect(screen.getByText('조합 가능한 마법 없음')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /턴 종료/ })).toHaveClass('suggested');
  });
  it('첫 전투는 예약 목록 없이 조합을 안내하고, 화학식 완성 즉시 발견을 저장한다', () => {
    start(); expect(screen.getByText(/H 두 개와 O 하나/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '연쇄 목록' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '정제' })).not.toBeInTheDocument();
    water(); expect(screen.getByText(/완성! 아래 마법 발동/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(CODEX_KEY)!)).toEqual(['water']);
    expect(screen.getByRole('region', { name: '원소 보관함' })).toHaveTextContent('5 / 12');
    fireEvent.click(screen.getByRole('button', { name: '선택 해제' }));
    expect(screen.getByRole('button', { name: /마법 발동/ })).toBeDisabled();
    expect(JSON.parse(localStorage.getItem(CODEX_KEY)!)).toEqual(['water']);
  });
  it('첫 시전 발사 때 HP를 유지하고 명중 때 감소, 이후 적 턴 없이 남은 마법 1회', () => {
    start(); const hp = Number(screen.getByLabelText('적 체력').getAttribute('aria-valuenow'));
    water(); cast(); expect(screen.getByLabelText('적 체력')).toHaveAttribute('aria-valuenow', String(hp));
    act(() => vi.advanceTimersByTime(270)); expect(screen.getByLabelText('적 체력')).toHaveAttribute('aria-valuenow', String(hp - 13));
    finish(); expect(screen.getByLabelText('남은 마법 1회')).toBeInTheDocument(); expect(screen.getByText('턴 1')).toBeInTheDocument();
    expect(screen.getByLabelText('내 체력')).toHaveAttribute('aria-valuenow', '60');
    expect(screen.getByLabelText('마력')).toHaveAttribute('aria-valuenow', '10');
    expect(screen.getByText(/한 번 더 시전하거나/)).toBeInTheDocument();
  });
  it('두 번째 마법을 바로 사용하면 COMBO 뒤 적 행동과 새 턴으로 이어진다', () => {
    start(); water(); cast(); finish(); select('나트륨 Na'); select('염소 Cl'); cast();
    act(() => vi.advanceTimersByTime(270)); expect(screen.getAllByText(/COMBO!/).length).toBeGreaterThan(0);
    finish(); expect(screen.getByText('턴 2')).toBeInTheDocument(); expect(screen.getByLabelText('남은 마법 2회')).toBeInTheDocument();
    expect(screen.queryByText(/한 번 더 시전하거나/)).not.toBeInTheDocument(); expect(screen.getByLabelText('내 체력')).toHaveAttribute('aria-valuenow', '52');
  });
  it('발견한 마법만 추천하고 추천 클릭은 원소 선택만 하며 시전하지 않는다', () => {
    localStorage.setItem(CODEX_KEY, '["water"]'); start();
    expect(screen.queryByRole('button', { name: '솔트 스파이크 자동 선택' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '워터 블래스트 자동 선택' }));
    expect(screen.getByRole('button', { name: /마법 발동/ })).toBeEnabled();
    expect(screen.getByLabelText('마력')).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByRole('region', { name: '원소 보관함' })).toHaveTextContent('5 / 12');
    cast(); finish(); expect(screen.queryByRole('button', { name: '워터 블래스트 자동 선택' })).not.toBeInTheDocument();
  });
  it('잘못된 조합과 개별 선택 취소는 원소를 소모하지 않는다', () => {
    start(); select('수소 H'); select('산소 O'); expect(screen.getByRole('button', { name: /마법 발동/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '산소 O 선택 취소' }));
    expect(screen.queryByRole('button', { name: '산소 O 선택 취소' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '원소 보관함' })).toHaveTextContent('5 / 12');
  });
  it('한 번 시전 후에도 방어하고 턴을 마칠 수 있다', () => {
    start(); water(); cast(); finish(); fireEvent.click(screen.getByRole('button', { name: /턴 종료/ })); finish();
    expect(screen.getByText('턴 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /턴 종료/ })); finish(); expect(screen.getByText('턴 3')).toBeInTheDocument();
  });
  it('빠른 중복 클릭과 연출 넘기기는 마법·적 행동을 중복 처리하지 않는다', () => {
    start(); water(); const button = screen.getByRole('button', { name: /마법 발동/ }); fireEvent.click(button);
    expect(screen.getByRole('button', { name: /턴 종료/ })).toBeDisabled();
    fireEvent.click(button); finish();
    expect(screen.getByLabelText('마력')).toHaveAttribute('aria-valuenow', '10'); expect(screen.getByLabelText('남은 마법 1회')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /턴 종료/ })); finish(); expect(screen.getByText('턴 2')).toBeInTheDocument();
  });
  it('첫 마법을 배우기 전에 방어해도 조합 튜토리얼이 유지된다', () => {
    start(); fireEvent.click(screen.getByRole('button', { name: /턴 종료/ })); finish();
    expect(screen.getByText('H 두 개와 O 하나를 눌러 조합해 보세요.')).toBeInTheDocument();
  });
  it('초과 원소를 팝업 없이 변환하며 가방을 보존하고 마력을 표시한다', () => {
    scenario.mode = 'overflow'; start(); fireEvent.click(screen.getByRole('button', { name: /턴 종료/ })); finish();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(screen.getByRole('region', { name: '원소 보관함' })).toHaveTextContent('12 / 12');
    expect(screen.getByLabelText('마력')).toHaveAttribute('aria-valuenow', '45');
    expect(screen.getByRole('button', { name: 'ZERO BURST' })).toBeDisabled();
  });
  it('마력 100에서만 ZERO 버튼이 켜지고 발동 후 30 피해와 턴 종료가 일어난다', () => {
    scenario.mode = 'burst'; start(); fireEvent.click(screen.getByRole('button', { name: 'ZERO BURST' })); finish();
    expect(screen.getByLabelText('적 체력')).toHaveAttribute('aria-valuenow', '90'); expect(screen.getByLabelText('마력')).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText('턴 2')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'ZERO BURST' })).toBeDisabled();
  });
  it('긴 로그 대신 상태 아이콘과 효과를 누를 때만 상세 설명을 연다', () => {
    start(); water(); fireEvent.click(screen.getByRole('button', { name: '워터 블래스트 효과 자세히' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('피해 13'); fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    cast(); finish(); fireEvent.click(screen.getByRole('button', { name: '젖음 설명' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('NaCl'); fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: '기록' })).not.toBeInTheDocument();
  });
  it('보스 처치 후 사망 모션, 클리어와 재시작이 정상 동작한다', () => {
    scenario.mode = 'boss'; start(); water(); cast();
    act(() => vi.advanceTimersByTime(270 + 310)); expect(document.querySelector('.combat-enemy.dying')).not.toBeNull(); expect(document.querySelector('.combat-intent.danger')).toBeNull();
    finish(); expect(screen.getByRole('heading', { name: '마법은, 당신 안에.' })).toBeInTheDocument();
    scenario.mode = 'normal'; fireEvent.click(screen.getByRole('button', { name: '다시 모험하기' })); expect(screen.getByLabelText('내 체력')).toHaveAttribute('aria-valuenow', '60');
  });
  it('게임 오버 후 재시작하며 보상 효과와 중복 선택 거절을 유지한다', () => {
    scenario.mode = 'defeat'; start(); fireEvent.click(screen.getByRole('button', { name: /턴 종료/ })); finish();
    expect(screen.getByRole('heading', { name: '아직 끝나지 않은 실험' })).toBeInTheDocument();
    scenario.mode = 'reward'; fireEvent.click(screen.getByRole('button', { name: '다시 모험하기' }));
    expect(screen.getByText('체력이 가득 차 효과가 없습니다')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /확장 가방/ }); fireEvent.click(button); fireEvent.click(button);
    expect(screen.getByLabelText('5전투 중 2번째')).toBeInTheDocument(); expect(screen.getByRole('region', { name: '원소 보관함' })).toHaveTextContent('5 / 14');
  });
  it('음소거·1.5배속·움직임 줄이기와 선택형 도움말이 동작한다', () => {
    start(); fireEvent.click(screen.getByRole('button', { name: '효과음 및 움직임 설정' }));
    const modal = within(screen.getByRole('dialog')); fireEvent.click(modal.getByRole('button', { name: '켜짐' }));
    fireEvent.click(modal.getByRole('button', { name: '연출 속도 1배' })); fireEvent.click(modal.getAllByRole('button', { name: '꺼짐' })[1]);
    expect(screen.getByRole('button', { name: '연출 속도 1.5배' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '닫기' })); water(); cast(); finish();
    expect(screen.getByLabelText('남은 마법 1회')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '도움말' })); expect(screen.getByRole('dialog')).toHaveTextContent('한 턴에 마법 두 번');
  });
});

