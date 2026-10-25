import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../App';
import { Rewards } from '../screens/Results';
import { newGame } from '../game/engine';
import { CODEX_KEY, REACTIONS_KEY } from '../game/codex';
import { HINTS_KEY } from '../game/hints';

beforeEach(() => {localStorage.clear();vi.useFakeTimers();vi.spyOn(Math,'random').mockReturnValue(.99);});
afterEach(() => {vi.useRealTimers();vi.restoreAllMocks();});
const finish = () => act(()=>vi.runAllTimers());
function start() {const view=render(<App/>);fireEvent.click(screen.getByRole('button',{name:/새로운 모험/}));finish();return view;}
function openMagic() {fireEvent.click(screen.getByRole('button',{name:'마법 도감'}));fireEvent.click(screen.getByRole('button',{name:'미발견 마법 1 힌트'}));}

it('미발견 마법은 단계별 공개·저장·재접속 복구하며 읽기만 해서는 발견되지 않는다', () => {
  const view=render(<App/>);openMagic();let modal=within(screen.getByRole('dialog'));
  expect(modal.queryByText(/수소 2개와 산소 1개/)).toBeNull();expect(modal.queryByText('워터 블래스트')).toBeNull();
  fireEvent.click(modal.getByRole('button',{name:'1단계 힌트 열기 무료'}));expect(modal.getByText(/생명 유지에 필수적인 액체/)).toBeInTheDocument();
  expect(modal.queryByText(/총 3개/)).toBeNull();expect(modal.queryByRole('button',{name:'3단계 힌트 열기 무료'})).toBeNull();
  fireEvent.click(modal.getByRole('button',{name:'2단계 힌트 열기 무료'}));expect(modal.getByText(/총 3개/)).toBeInTheDocument();
  fireEvent.click(modal.getByRole('button',{name:'3단계 힌트 열기 무료'}));expect(modal.getByText(/수소 2개와 산소 1개를 조합/)).toBeInTheDocument();
  expect(localStorage.getItem(CODEX_KEY)).toBeNull();expect(JSON.parse(localStorage.getItem(HINTS_KEY)!).magic.water).toBe(3);
  view.unmount();render(<App/>);openMagic();modal=within(screen.getByRole('dialog'));expect(modal.getByText(/수소 2개와 산소 1개를 조합/)).toBeInTheDocument();expect(modal.queryByRole('button',{name:/단계 힌트 열기/})).toBeNull();
});
it('손패 안내는 한 개이며 힌트가 조합·가방·마력·턴을 보존하고 실제 시전 때만 해금한다', () => {
  start();const bag=within(screen.getByRole('region',{name:'원소 보관함'}));fireEvent.click(bag.getAllByRole('button',{name:'수소 H'})[0]);
  const before=document.querySelector('.instant-slots')!.textContent;
  expect(screen.getAllByRole('button',{name:'새로운 마법을 발견할 수 있습니다! 힌트 보기'})).toHaveLength(1);
  fireEvent.click(screen.getByRole('button',{name:/새로운 마법을 발견/}));expect(screen.getByRole('region',{name:'마법 연구 힌트'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'1단계 힌트 열기 무료'}));fireEvent.click(screen.getByRole('button',{name:'닫기'}));
  expect(document.querySelector('.instant-slots')!.textContent).toBe(before);expect(screen.getByLabelText('마력')).toHaveAttribute('aria-valuenow','0');
  expect(screen.getByLabelText('남은 마법 2회')).toBeInTheDocument();expect(screen.getByText('턴 1')).toBeInTheDocument();expect(screen.getByRole('region',{name:'원소 보관함'})).toHaveTextContent('5 / 12');
  fireEvent.click(bag.getAllByRole('button',{name:'수소 H'})[1]);fireEvent.click(bag.getByRole('button',{name:'산소 O'}));
  expect(localStorage.getItem(CODEX_KEY)).toBeNull();fireEvent.click(screen.getByRole('button',{name:/마법 발동/}));
  expect(screen.getByText('NEW MAGIC!')).toBeInTheDocument();finish();expect(JSON.parse(localStorage.getItem(CODEX_KEY)!)).toEqual(['water']);
  fireEvent.click(screen.getByRole('button',{name:'마법 도감'}));expect(screen.getByText('워터 블래스트')).toBeInTheDocument();expect(screen.queryByRole('button',{name:'미발견 마법 1 힌트'})).toBeNull();
});
it('반응 2단계는 미발견 관련 마법을 숨기고 힌트로 이동하며 정확한 순서는 3단계에서만 공개한다', () => {
  localStorage.setItem(CODEX_KEY,'["acid"]');render(<App/>);fireEvent.click(screen.getByRole('button',{name:'마법 도감'}));fireEvent.click(screen.getByRole('tab',{name:'반응 기록 0/3'}));
  fireEvent.click(screen.getByRole('button',{name:'미발견 반응 1 힌트'}));fireEvent.click(screen.getByRole('button',{name:'1단계 힌트 열기 무료'}));
  expect(screen.queryByText(/같은 플레이어 턴에 HCl/)).toBeNull();fireEvent.click(screen.getByRole('button',{name:'2단계 힌트 열기 무료'}));
  expect(screen.getByRole('button',{name:'1번째 관련 마법 HCl 보기'})).toBeInTheDocument();expect(screen.queryByText(/NaOH/)).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'2번째 관련 마법 ??? 보기'}));expect(screen.getByRole('region',{name:'마법 연구 힌트'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'1단계 힌트 열기 무료'}));expect(screen.getByText(/수산화 나트륨입니다/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'← 목록으로'}));expect(screen.getByRole('region',{name:'반응 연구 힌트'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'3단계 힌트 열기 무료'}));expect(screen.getByText(/같은 플레이어 턴에 HCl.*NaOH/)).toBeInTheDocument();
  expect(localStorage.getItem(REACTIONS_KEY)).toBeNull();expect(JSON.parse(localStorage.getItem(CODEX_KEY)!)).toEqual(['acid']);
});
it('저장 차단 때에도 힌트를 세션에서 사용하고 전투를 계속할 수 있다', () => {
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('blocked');});start();
  fireEvent.click(screen.getByRole('button',{name:/새로운 마법을 발견/}));fireEvent.click(screen.getByRole('button',{name:'1단계 힌트 열기 무료'}));
  expect(screen.getByText(/이번 접속 중에만 기록/)).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'닫기'}));
  fireEvent.click(screen.getByRole('button',{name:'턴 종료'}));finish();expect(screen.getByText('턴 2')).toBeInTheDocument();
});
it('공명 미리보기는 발견한 관련 마법만 표시하고 원소 변경 뒤 확정해야 한 번 적용한다', () => {
  const s=newGame(()=>.5);s.screen='reward';s.rewards=['resonance'];s.discoveries=['iron','ironOxide'];const choose=vi.fn();
  render(<Rewards game={s} choose={choose}/>);fireEvent.click(screen.getByRole('button',{name:/원소 공명/}));
  fireEvent.click(screen.getByRole('button',{name:'Fe 공명 선택'}));const preview=screen.getByRole('region',{name:'원소 공명 미리보기'});
  expect(preview).toHaveTextContent('Fe 2개 확정 + 무작위 3개');expect(preview).toHaveTextContent('아이언 가드');expect(preview).toHaveTextContent('아이언 스트라이크');
  expect(preview).not.toHaveTextContent('FeCl₂');expect(preview).not.toHaveTextContent('페러스 체인');expect(within(preview).getAllByText('??? · 미발견 마법')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button',{name:'Cl 공명 선택'}));expect(choose).not.toHaveBeenCalled();expect(preview).toHaveTextContent('Cl 2개 확정');
  fireEvent.click(screen.getByRole('button',{name:'Cl 공명 확정 · 다음 전투'}));fireEvent.click(screen.getByRole('button',{name:'Cl 공명 확정 · 다음 전투'}));
  expect(choose).toHaveBeenCalledExactlyOnceWith('resonance','Cl');
});
