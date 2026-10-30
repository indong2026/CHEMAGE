import { SPELLS, SPELL_BY_ID, type Spell } from '../data/spells';
import { REACTIONS } from '../data/reactions';
import { ENEMIES } from '../data/enemies';
import { AFFINITIES } from '../data/affinities';
import { recipeIds } from '../game/suggestions';
import type { GameEvent, GameState, ReactionId, SpellId } from '../game/types';

export type SpellRole = 'attack' | 'defense' | 'support' | 'hybrid';
// Role is independent of elemental affinity and projectile colour.
const wards = new Set<SpellId>(['iron','carbon','graphite','nitrogen','sulfide']);
export function spellRole(spell: Spell): SpellRole {
  return spell.attack ? wards.has(spell.id) ? 'hybrid' : 'attack' : wards.has(spell.id) ? 'defense' : 'support';
}
export function smartGuide(game: GameState, blocked: boolean, selected: number[]) {
  if (blocked || game.screen !== 'battle' || game.spellsUsed >= 2 || selected.length) return null;
  if (SPELLS.some(spell => recipeIds(game.inventory, spell))) return null;
  const choices = [game.reconstruction === 100 && game.inventory.length ? '재구성으로 원소를 바꾸거나' : '', game.mana === 100 ? 'ZERO BURST를 사용하거나' : ''].filter(Boolean);
  return { title:'지금은 조합할 수 있는 마법이 없어요.', text: choices.length ? `${choices.join(' ')} 턴을 종료할 수 있어요.` : '원소를 보관하고 턴 종료를 눌러 다음 턴으로 넘어가세요.' };
}
export type UxNotice = { id:string; kind:'discovery'|'reaction-discovery'|'guide'|'stage'; title:string; text:string; detail?:string; formula?:string; name?:string; highlight?:'bag'|'uses'|'end'; };
export function discoveryNotices(events: GameEvent[]): UxNotice[] {
  const result: UxNotice[]=[];
  for(const event of events) {
    if(event.freshSpell && event.spell) {const spell=SPELL_BY_ID[event.spell];result.push({id:`discovery:${spell.id}`,kind:'discovery',title:'NEW DISCOVERY!',text:'새로운 화학식을 발견했습니다!',formula:spell.display,name:spell.name,detail:'마법 도감에 등록되었습니다.'});}
    if(event.freshReaction && event.reaction) {const reaction=REACTIONS[event.reaction];result.push({id:`reaction:${event.reaction}`,kind:'reaction-discovery',title:'NEW REACTION!',text:'새로운 화학 반응을 발견했습니다!',name:reaction.name,formula:reaction.equation ?? reaction.spells,detail:'반응 기록에 등록되었습니다.'});}
  }
  return result;
}
export const GUIDES = {
  combine:{title:'원소를 조합해 마법을 만들어 보세요!',text:'가방의 원소를 골라 조합한 뒤 발동하세요.',highlight:'bag'},
  twice:{title:'한 턴에 마법을 최대 2번 사용할 수 있어요!',text:'원소가 충분하다면 한 번 더 마법을 사용할 수 있습니다.',highlight:'uses'},
  keep:{title:'원소를 전부 사용할 필요는 없어요!',text:'남은 원소는 다음 턴에도 사용할 수 있습니다. 턴 종료를 누르면 적의 차례로 넘어갑니다. 무료 보호막은 생기지 않아요.',highlight:'end'},
  shield:{title:'보호막은 적의 공격을 막아줍니다.',text:'방어 마법을 여러 번 사용하면 보호막이 중첩됩니다. 남은 보호막은 적 행동이 끝나면 사라져요.'},
  affinity:{title:'적의 약점을 노려보세요!',text:'적의 약점 속성으로 공격하면 더 큰 피해를 줄 수 있어요!'},
  reaction:{title:'화학 반응을 발견해 보세요!',text:'마법을 특정 순서로 사용하면 특별한 반응이 발생합니다. 도감의 반응 기록에서 힌트를 확인하세요.'},
  reconstruct:{title:'원소 재구성',text:'가방의 원소 1개를 무작위의 다른 원소로 바꿀 수 있어요. 시전 횟수는 소모하지 않아요.'},
  burst:{title:'ZERO BURST',text:'마력 100으로 방어력을 무시하는 피해 30! 사용하면 내 턴이 끝납니다.'},
  inferno:{title:'인페르노 코어 · 화염',text:ENEMIES.inferno.boss!.guide},
  warden:{title:'아이언 워든 · 금속',text:ENEMIES.warden.boss!.guide},
} satisfies Record<string, Omit<UxNotice,'id'|'kind'>>;
export type GuideId=keyof typeof GUIDES;
export const GUIDE_IDS=Object.keys(GUIDES) as GuideId[];
export function contextualGuides(events:GameEvent[]):GuideId[] {
  const ids:GuideId[]=[];
  if(events.some(e=>e.kind==='shield'&&e.target==='player'))ids.push('shield');
  if(events.some(e=>(e.multiplier??1)>1))ids.push('affinity');
  if(events.some(e=>e.kind==='reaction'))ids.push('reaction');
  if(events.some(e=>e.kind==='reconstruct-ready'))ids.push('reconstruct');
  if(events.some(e=>e.kind==='ready'))ids.push('burst');
  return ids;
}
export function stageNotice(game:GameState, adventure:number):UxNotice|undefined {
  // Only the first ordinary encounter needs this reminder in each adventure.
  if(game.stage>0 && game.stage<3)return;
  if(game.stage===4){const data=ENEMIES[game.enemy.id];return {id:`stage:${adventure}:4`,kind:'stage',title:`BOSS BATTLE! · ${data.name}`,text:`${AFFINITIES[data.affinity].name} · ${data.boss?.intro??'적의 약점과 공격 예고를 확인하세요.'}`};}
  return {id:`stage:${adventure}:${game.stage}`,kind:'stage',title:game.stage===4?'BOSS BATTLE!':game.stage===3?'강력한 적이 등장했습니다!':'전투 시작',text:game.stage===4?'적의 약점과 공격 예고를 확인하세요.':game.stage===3?'다음 공격을 확인하고 방어를 준비하세요.':'상대의 속성과 다음 행동을 확인해 보세요.'};
}
export const UNREAD_KEY='chemage.unread.v1', GUIDE_KEY='chemage.guides.v1';
export type Unread={magic:SpellId[];reaction:ReactionId[]};
export type GuideProgress={seen:GuideId[];disabled:boolean};
function read(key:string):unknown {try{return JSON.parse(localStorage.getItem(key)??'null');}catch{return null;}}
export function loadUnread():Unread {
  const data=read(UNREAD_KEY) as Partial<Unread>|null;
  return {magic:SPELLS.filter(s=>Array.isArray(data?.magic)&&data.magic.includes(s.id)).map(s=>s.id),reaction:(Object.keys(REACTIONS) as ReactionId[]).filter(id=>Array.isArray(data?.reaction)&&data.reaction.includes(id))};
}
export function loadGuideProgress(existingPlayer:boolean):GuideProgress {
  const data=read(GUIDE_KEY) as Partial<GuideProgress>|null;
  return data && Array.isArray(data.seen) ? {seen:GUIDE_IDS.filter(id=>data.seen!.includes(id)),disabled:data.disabled===true} : {seen:existingPlayer?[...GUIDE_IDS]:[],disabled:existingPlayer};
}
export function saveUx(key:string,value:Unread|GuideProgress){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
