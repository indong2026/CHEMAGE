import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import App from '../App';
import { Codex } from '../screens/Codex';
import { ELEMENTS, ELEMENT_KEYS } from '../data/elements';
import { SPELLS } from '../data/spells';
import { CODEX_KEY, REACTIONS_KEY, spellsForElement } from '../game/codex';
import { HINTS_KEY } from '../game/hints';
import type { Element } from '../game/types';

beforeEach(() => localStorage.clear());
const expected: Record<Element, string[]> = {
  H: ['water','acid','peroxide','methane','hydrogen','alkali','ammonia','sulfide'],
  O: ['water','carbon','oxygen','peroxide','ironOxide','alkali','nitro','sulfur'],
  C: ['carbon','graphite','methane'], Na: ['salt','alkali'], Cl: ['salt','acid','ferrous'],
  Fe: ['iron','ironOxide','ferrous','ironSulfide'], N: ['nitrogen','ammonia','nitro'],
  S: ['sulfide','sulfur','ironSulfide'],
};
const selectElement = (element: Element) => fireEvent.click(screen.getByRole('button', {name: `${ELEMENTS[element].name} ${element} · ${expected[element].length}종`}));
const elementTab = () => fireEvent.click(screen.getByRole('tab', {name:'원소별 보기'}));

it.each(ELEMENT_KEYS)('%s의 모든 관련 마법을 레시피로 분류하고 8종 버튼에서 선택한다', element => {
  expect(spellsForElement(element).map(spell => spell.id)).toEqual(expected[element]);
  render(<Codex discoveries={SPELLS.map(s => s.id)} storageError={false} onClose={() => {}} />);
  elementTab(); expect(within(screen.getByRole('group',{name:'원소 선택'})).getAllByRole('button')).toHaveLength(8);
  selectElement(element);
  const list = screen.getByLabelText(`${ELEMENTS[element].name} 관련 마법`);
  expect(within(list).getAllByRole('button')).toHaveLength(expected[element].length);
  for (const spell of SPELLS) {
    expect(within(list).queryByText(spell.display) !== null).toBe(expected[element].includes(spell.id));
  }
  expect(screen.getByText(`${ELEMENTS[element].name}(${element}) 관련 마법`,{exact:false})).toHaveTextContent(`${expected[element].length}/${expected[element].length} 발견`);
});

it('복수 원소 분류와 중복 저장 ID가 전체 19종 진행도를 늘리지 않는다', () => {
  render(<Codex discoveries={['water','water','ironSulfide']} storageError={false} onClose={() => {}} />);
  expect(screen.getByRole('tab',{name:'전체 마법 2/19'})).toBeInTheDocument();
  elementTab();selectElement('H');expect(screen.getByText('H₂O')).toBeInTheDocument();
  expect(screen.getByText(/수소\(H\) 관련 마법/)).toHaveTextContent('1/8 발견');
  selectElement('O');expect(screen.getByText('H₂O')).toBeInTheDocument();
  selectElement('Fe');expect(screen.getByText('FeS')).toBeInTheDocument();
  selectElement('S');expect(screen.getByText(/황\(S\) 관련 마법/)).toHaveTextContent('1/3 발견');
  fireEvent.click(screen.getByRole('tab',{name:'전체 마법 2/19'}));
  expect(screen.getByLabelText('전체 마법 목록').children).toHaveLength(19);
});

it('미발견 목록의 텍스트와 접근성 속성에는 정확한 화학식·이름을 노출하지 않는다', () => {
  render(<Codex discoveries={[]} storageError={false} onClose={() => {}} />);elementTab();
  for (const element of ELEMENT_KEYS) {
    selectElement(element); const list=screen.getByLabelText(`${ELEMENTS[element].name} 관련 마법`);
    expect(within(list).getAllByText('???')).toHaveLength(expected[element].length);
    expect(within(list).getAllByText('미발견 마법')).toHaveLength(expected[element].length);
    for(const button of within(list).getAllByRole('button')) {
      expect(button).toHaveAccessibleName(/^미발견 마법 \d+ 힌트$/);
      expect(button.querySelector('svg')).not.toBeNull();
      expect(button).not.toHaveAttribute('title');
    }
    for(const spell of SPELLS) {
      expect(within(list).queryByText(spell.display)).toBeNull();
      expect(list.textContent).not.toContain(spell.name);
      expect(list.textContent).not.toContain(spell.fact);
    }
  }
});

it('기존 저장 기록을 유지하고 원소별 상세/3단계 힌트에서 같은 목록으로 돌아온다', () => {
  const saved='["sulfide","water"]';localStorage.setItem(CODEX_KEY,saved);
  localStorage.setItem(REACTIONS_KEY,'["ammonium"]');
  let view=render(<App/>);fireEvent.click(screen.getByRole('button',{name:'마법 도감'}));elementTab();selectElement('S');
  fireEvent.click(screen.getByRole('button',{name:/H₂S 설퍼 베일/}));
  expect(screen.getByText('황화 수소')).toBeInTheDocument();expect(screen.getByText(/화학 사실/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'← 목록으로'}));
  expect(screen.getByRole('tab',{name:'원소별 보기'})).toHaveAttribute('aria-selected','true');
  expect(screen.getByText(/황\(S\) 관련 마법/)).toHaveTextContent('1/3 발견');
  fireEvent.click(screen.getByRole('button',{name:'미발견 마법 18 힌트'}));
  expect(screen.getByRole('region',{name:'마법 연구 힌트'})).toBeInTheDocument();
  for(const n of [1,2,3])fireEvent.click(screen.getByRole('button',{name:`${n}단계 힌트 열기 무료`}));
  expect(screen.getByText(/황 1개와 산소 2개를 조합/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'← 목록으로'}));
  expect(screen.queryByText('SO₂')).toBeNull();expect(screen.queryByText('설퍼 미스트')).toBeNull();
  expect(screen.getByText(/황\(S\) 관련 마법/)).toHaveTextContent('1/3 발견');
  expect(localStorage.getItem(CODEX_KEY)).toBe(saved);
  expect(JSON.parse(localStorage.getItem(HINTS_KEY)!).magic.sulfur).toBe(3);
  fireEvent.click(screen.getByRole('tab',{name:'반응 기록 1/4'}));
  expect(screen.getByText('NH₃ + HCl → NH₄Cl')).toBeInTheDocument();
  expect(screen.getAllByRole('button',{name:/미발견 반응/})).toHaveLength(3);
  view.unmount();view=render(<App/>);fireEvent.click(screen.getByRole('button',{name:'마법 도감'}));
  expect(screen.getByRole('tab',{name:'전체 마법 2/19'})).toBeInTheDocument();elementTab();selectElement('S');
  fireEvent.click(screen.getByRole('button',{name:'미발견 마법 18 힌트'}));
  expect(screen.getByText(/황 1개와 산소 2개를 조합/)).toBeInTheDocument();
  expect(localStorage.getItem(REACTIONS_KEY)).toBe('["ammonium"]');
});
