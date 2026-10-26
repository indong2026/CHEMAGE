import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../App';
import { Rewards } from '../screens/Results';
import { newGame } from '../game/engine';
import type { Element } from '../game/types';
const scenario=vi.hoisted(()=>({charge:100}));
vi.mock('../game/engine',async importOriginal=>{
  const original=await importOriginal<typeof import('../game/engine')>();
  return {...original,newGame:(...args:Parameters<typeof original.newGame>)=>{
    const s=original.newGame(...args);s.reconstruction=scenario.charge;s.enemy.hp=500;s.mana=0;
    const elements:Element[]=['H','H','O','Cl','Cl','N','S','Fe'];s.inventory=elements.map(element=>({id:s.nextId++,element}));return s;
  }};
});
beforeEach(()=>{scenario.charge=100;localStorage.clear();vi.useFakeTimers();vi.spyOn(Math,'random').mockReturnValue(.5);});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
const finish=()=>act(()=>vi.runAllTimers());
const start=()=>{render(<App/>);fireEvent.click(screen.getByRole('button',{name:/새로운 모험/}));finish();};
const bag=()=>within(screen.getByRole('region',{name:'원소 보관함'}));
const open=()=>fireEvent.click(screen.getByRole('button',{name:'원소 재구성 100%'}));

it('선택·변경·취소는 카드/게이지/기존 조합을 보존하고 선택 모드에서 전투 입력을 막는다',()=>{
  start();fireEvent.click(bag().getAllByRole('button',{name:'수소 H'})[0]);const before=document.querySelector('.instant-slots')!.textContent;
  open();expect(screen.getByText('사용할 원소를 선택해주세요')).toBeInTheDocument();expect(screen.getByRole('button',{name:'재구성 실행'})).toBeDisabled();
  fireEvent.click(bag().getAllByRole('button',{name:'염소 Cl'})[0]);expect(screen.getByText('염소 Cl → ?')).toBeInTheDocument();
  fireEvent.click(bag().getByRole('button',{name:'황 S'}));expect(screen.getByText('황 S → ?')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'턴 종료'})).toBeDisabled();expect(screen.getByRole('button',{name:'ZERO BURST'})).toBeDisabled();expect(screen.getByRole('button',{name:/마법 발동/})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'취소'}));expect(document.querySelector('.instant-slots')!.textContent).toBe(before);expect(screen.getByRole('button',{name:'원소 재구성 100%'})).toBeEnabled();expect(bag().getAllByRole('button',{name:'염소 Cl'})).toHaveLength(2);
});
it('확정은 한 장만 교체하고 연속 입력·연출 중 충돌 방지 및 선택 슬롯 동기화',()=>{
  start();fireEvent.click(bag().getAllByRole('button',{name:'수소 H'})[0]);fireEvent.click(bag().getAllByRole('button',{name:'염소 Cl'})[0]);
  open();fireEvent.click(bag().getAllByRole('button',{name:'염소 Cl'})[0]);const confirm=screen.getByRole('button',{name:'재구성 실행'});fireEvent.click(confirm);fireEvent.click(confirm);
  expect(screen.getByText('원소 재구성 성공!')).toBeInTheDocument();expect(screen.getByRole('button',{name:'턴 종료'})).toBeDisabled();expect(screen.getByRole('button',{name:'원소 재구성 0%'})).toBeDisabled();
  expect(bag().getAllByRole('button',{name:'염소 Cl'})).toHaveLength(1);expect(bag().getAllByRole('button',{name:'나트륨 Na'})).toHaveLength(1);
  finish();expect(screen.getByRole('button',{name:'턴 종료'})).toBeEnabled();expect(document.querySelector('.instant-slots')!.textContent).toContain('H');expect(document.querySelector('.instant-slots')!.textContent).not.toContain('Cl');
  expect(screen.getByLabelText('마력')).toHaveAttribute('aria-valuenow','0');expect(screen.getByLabelText('남은 마법 2회')).toBeInTheDocument();expect(screen.getByText('턴 1')).toBeInTheDocument();expect(screen.getByRole('region',{name:'원소 보관함'})).toHaveTextContent('8 / 12');
});
it('미충전 터치는 충전 안내를 보여주고 3라운드 뒤 준비 알림 한 번·입력 잠금',()=>{
  scenario.charge=0;start();fireEvent.click(screen.getByRole('button',{name:'원소 재구성 0%'}));expect(screen.getByRole('dialog')).toHaveTextContent('100% 더 충전');fireEvent.click(screen.getByRole('button',{name:'닫기'}));
  for(const charge of [35,70]){fireEvent.click(screen.getByRole('button',{name:'턴 종료'}));finish();expect(screen.getByRole('button',{name:`원소 재구성 ${charge}%`})).toBeEnabled();}
  fireEvent.click(screen.getByRole('button',{name:'턴 종료'}));
  let noticed=0;for(let i=0;i<30&&screen.getByRole('button',{name:'턴 종료'}).hasAttribute('disabled');i++){act(()=>vi.advanceTimersToNextTimer());if(screen.queryByText('원소 재구성을 사용할 수 있습니다!')){noticed++;expect(screen.getByRole('button',{name:'턴 종료'})).toBeDisabled();}}
  expect(noticed).toBe(1);expect(screen.getByRole('button',{name:'원소 재구성 100%'})).toBeEnabled();
  fireEvent.click(screen.getByRole('button',{name:'턴 종료'}));finish();expect(screen.queryByText('원소 재구성을 사용할 수 있습니다!')).toBeNull();
});
it.each([{speed:1,reduced:false},{speed:1.5,reduced:false},{speed:1.5,reduced:true}])('$speed배속 / 움직임 줄이기 $reduced에서 상태 변경은 한 번이고 잠금이 풀린다',({speed,reduced})=>{
  start();fireEvent.click(screen.getByRole('button',{name:'효과음 및 움직임 설정'}));if(speed===1.5)fireEvent.click(screen.getByRole('button',{name:'연출 속도 1배'}));
  const rows=document.querySelectorAll('.settings-row');if(reduced)fireEvent.click(within(rows[2] as HTMLElement).getByRole('button'));fireEvent.click(screen.getByRole('button',{name:'닫기'}));
  open();fireEvent.click(bag().getByRole('button',{name:'질소 N'}));fireEvent.click(screen.getByRole('button',{name:'재구성 실행'}));finish();
  expect(screen.getByRole('button',{name:'원소 재구성 0%'})).toBeEnabled();expect(screen.getByText('턴 1')).toBeInTheDocument();expect(screen.getByLabelText('남은 마법 2회')).toBeInTheDocument();
});
it.each(['N','S'] as Element[])('%s 공명 UI는 관련 3마법 미발견을 숨기고 확정 원소를 전달한다',element=>{
  const s=newGame(()=>.5);s.screen='reward';s.rewards=['resonance'];s.discoveries=[];const choose=vi.fn();render(<Rewards game={s} choose={choose}/>);
  fireEvent.click(screen.getByRole('button',{name:/원소 공명/}));fireEvent.click(screen.getByRole('button',{name:`${element} 공명 선택`}));
  const preview=within(screen.getByRole('region',{name:'원소 공명 미리보기'}));expect(preview.getAllByText('??? · 미발견 마법')).toHaveLength(3);expect(preview.getByText(`${element} 2개 확정 + 무작위 3개`)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:`${element} 공명 확정 · 다음 전투`}));expect(choose).toHaveBeenCalledExactlyOnceWith('resonance',element);
});
it('도감에 19개 마법·4개 반응과 신규 힌트가 있고 읽어도 해금하지 않는다',()=>{
  render(<App/>);fireEvent.click(screen.getByRole('button',{name:'마법 도감'}));expect(screen.getByRole('tab',{name:'전체 마법 0/19'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'미발견 마법 19 힌트'}));for(const n of [1,2,3])fireEvent.click(screen.getByRole('button',{name:`${n}단계 힌트 열기 무료`}));expect(screen.getByText(/철 1개와 황 1개를 조합/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab',{name:'반응 기록 0/4'}));fireEvent.click(screen.getByRole('button',{name:'미발견 반응 4 힌트'}));for(const n of [1,2,3])fireEvent.click(screen.getByRole('button',{name:`${n}단계 힌트 열기 무료`}));expect(screen.getByText(/NH₃를 먼저 시전하고 HCl/)).toBeInTheDocument();expect(screen.getByRole('tab',{name:'전체 마법 0/19'})).toBeInTheDocument();
});
