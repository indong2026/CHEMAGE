import {render,screen} from '@testing-library/react';
import {it,expect} from 'vitest';
import {CombatScene} from '../components/CombatScene';
import {Ending} from '../screens/Results';
import {ENEMIES,BOSS_IDS} from '../data/enemies';
import {SPRITES,PALETTE} from '../assets/sprites';
import {newGame} from '../game/engine';
import type {BossId} from '../game/types';
const game=(id:BossId)=>{const s=newGame(()=>.5,{boss:id});s.stage=4;s.enemy={...s.enemy,id,hp:ENEMIES[id].hp,intent:ENEMIES[id].pattern[0]};return s;};
it.each(BOSS_IDS)('%s renders its own identity, phase effect and boss sprite',id=>{
 const s=game(id);s.enemy.phase=2;
 const {container}=render(<CombatScene game={s} event={{kind:'phase',text:ENEMIES[id].boss!.phaseTitle}} eventIndex={1} busy speed={1.5}/>);
 expect(screen.getByRole('heading',{name:new RegExp(ENEMIES[id].name)})).toBeInTheDocument();
 expect(container.querySelector(`.enemy-${id}.boss .sprite`)).not.toBeNull();
 expect(container.querySelector('.phase-banner')).toHaveTextContent(ENEMIES[id].boss!.phaseTitle);
 expect(container.querySelector('.phase-banner')).toHaveTextContent(ENEMIES[id].boss!.english);
});
it.each(BOSS_IDS)('%s victory names the defeated boss rather than always naming golem',id=>{
 const s=game(id);s.screen='victory';s.stats.defeated=5;
 render(<Ending game={s} restart={()=>{}} menu={()=>{}} codex={()=>{}}/>);
 expect(screen.getByText(new RegExp(`${ENEMIES[id].name} 격파!`))).toBeInTheDocument();
});
it.each(['inferno','warden'] as const)('%s shows future charged damage and distinct original pixel art',id=>{
 const s=game(id),data=ENEMIES[id];s.enemy.patternIndex=data.pattern.findIndex(i=>i.type==='charge');s.enemy.intent=data.pattern[s.enemy.patternIndex];
 const {container}=render(<CombatScene game={s} event={null} eventIndex={0} busy={false} speed={1}/>);
 expect(container.querySelector('.combat-intent')).toHaveTextContent(`다음 공격 ${data.pattern[s.enemy.patternIndex+1].value}`);
 expect(SPRITES[id]).not.toEqual(SPRITES.flame);expect(SPRITES[id]).not.toEqual(SPRITES.beetle);
 for(const row of SPRITES[id])for(const pixel of row)expect(PALETTE[pixel]).toBeDefined();
});
