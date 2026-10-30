import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './components/PixelArt';
import { Modal } from './components/Modal';
import { Menu } from './screens/Menu';
import { Battle } from './screens/Battle';
import { Rewards, Ending } from './screens/Results';
import { Codex } from './screens/Codex';
import { Help } from './screens/Help';
import { chooseReward, newGame, performAction } from './game/engine';
import { discoverableSpell, loadHints, revealHint, saveHints, type HintTarget } from './game/hints';
import { matchRecipe } from './game/recipes';
import { loadDiscoveries, saveDiscoveries, loadReactions, saveReactions, hasAdventured, markAdventure } from './game/codex';
import { PlaybackController } from './presentation/playback';
import { battleSequence } from './presentation/sequence';
import { SynthAudio } from './presentation/sound';
import { UxNotice } from './components/UxNotice';
import { useNotices } from './presentation/useNotices';
import { contextualGuides, discoveryNotices, GUIDES, GUIDE_IDS, GUIDE_KEY, UNREAD_KEY, loadGuideProgress, loadUnread, saveUx, stageNotice, type GuideId } from './presentation/ux';
import './styles/ux.css';
import type { Action, GameEvent, GameState, RewardId, SpellId, ReactionId, Element } from './game/types';

type Playback = { event: GameEvent; index: number };
export default function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [tutorial, setTutorial] = useState(0);
  const [overlay, setOverlay] = useState<'codex' | 'help' | 'leave' | 'settings' | null>(null);
  const [detail, setDetail] = useState<{ title: string; text: string } | null>(null);
  const [discoveries, setDiscoveries] = useState<SpellId[]>(loadDiscoveries);
  const [reactions, setReactions] = useState<ReactionId[]>(loadReactions);
  const [hints, setHints] = useState(loadHints);
  const [hintTarget, setHintTarget] = useState<HintTarget | null>(null);
  const started = useRef(hasAdventured());
  const [unread,setUnread]=useState(loadUnread);
  const [guideProgress,setGuideProgress]=useState(()=>loadGuideProgress(hasAdventured()));
  const guideRef=useRef(guideProgress);
  const adventure=useRef(0);
  const [reconstructionMode,setReconstructionMode]=useState(false);
  const [discovery, setDiscovery] = useState<SpellId | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [speed, setSpeed] = useState(1), [sound, setSound] = useState(true);
  const [simpleBanners, setSimpleBanners] = useState(false);
  const readyAnnounced = useRef(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const lock = useRef(false), controller = useRef(new PlaybackController()), audio = useRef(new SynthAudio());
  useEffect(() => {
    const player = controller.current, synth = audio.current;
    return () => { player.cancel(); synth.close(); };
  }, []);
  controller.current.speed = speed; controller.current.reducedMotion = reducedMotion; controller.current.simpleBanners = simpleBanners; audio.current.enabled = sound;
  const closeOverlay = useCallback(() => { setOverlay(null); setDetail(null); setHintTarget(null); }, []);
  const busy = playback !== null;
  const notices=useNotices(busy || !!overlay || !!detail || reconstructionMode,speed,reducedMotion);
  useEffect(()=>{saveUx(GUIDE_KEY,guideProgress);},[guideProgress]);
  const guide=(ids:GuideId[])=>{
    if(guideRef.current.disabled)return;
    const fresh=ids.filter(id=>!guideRef.current.seen.includes(id));
    if(!fresh.length)return;
    const updated={...guideRef.current,seen:[...guideRef.current.seen,...fresh]};
    guideRef.current=updated;setGuideProgress(updated);
    notices.enqueue(fresh.map(id=>({id:`guide:${id}`,kind:'guide',...GUIDES[id]})));
  };
  const skipGuides=()=>{const updated={seen:[...GUIDE_IDS],disabled:true};guideRef.current=updated;setGuideProgress(updated);notices.skipGuides();};
  const markRead=(target:HintTarget)=>{const next={...unread,[target.kind]:unread[target.kind].filter(id=>id!==target.id)};setUnread(next);if(!saveUx(UNREAD_KEY,next))setStorageError(true);};
  const visibleGame = game && playback?.event.frame ? { ...game, ...playback.event.frame, screen: 'battle' as const } : game;
  const discover = (ids: SpellId[]) => {
    const fresh = ids.filter(id => !discoveries.includes(id));
    if (!fresh.length) return;
    const updated = [...new Set([...loadDiscoveries(), ...discoveries, ...fresh])];
    setDiscoveries(updated); setStorageError(!saveDiscoveries(updated)); setDiscovery(fresh[0]);
  };
  const start = () => {
    notices.clear(); adventure.current++;setReconstructionMode(false);
    controller.current.cancel(); lock.current = false; audio.current.unlock();
    const firstAdventure = !started.current;
    const next = newGame(Math.random, { firstAdventure, discoveries, reactions }); readyAnnounced.current = false; started.current = true; markAdventure();
    setGame(next); setSelected([]); setPlayback(null); setTutorial(firstAdventure && !discoveries.includes('water') ? 0 : 3); setOverlay(null); setDetail(null); setDiscovery(null);
    play(next, true); if(firstAdventure)guide(['combine']);
  };
  const play = (next: GameState, opening = false, complete?: () => void) => {
    const sequence = battleSequence(next, readyAnnounced.current, opening);
    readyAnnounced.current = sequence.announced; lock.current = true;
    if(next.screen==='battle')guide(contextualGuides(sequence.events));else notices.skipGuides();
    if(opening){const entry=stageNotice(next,adventure.current);if(entry && !(next.stage===0 && !guideRef.current.disabled))notices.enqueue([entry]);}
    if(opening && next.stage===4 && (next.enemy.id==='inferno'||next.enemy.id==='warden'))guide([next.enemy.id]);
    controller.current.start(sequence.events, (event, index) => {
      setPlayback({ event, index: next.revision * 100 + index }); audio.current.event(event);
    }, () => { setPlayback(null); lock.current = false; complete?.(); });
  };
  const select = (ids: number[]) => {
    if (lock.current || !game) return;
    audio.current.unlock(); audio.current.select(); setSelected(ids);
    const spell = matchRecipe(ids.map(id => game.inventory.find(t => t.id === id)!.element));
    if (spell) audio.current.complete();
    if (tutorial < 2) setTutorial(spell ? 1 : 0);
  };
  const act = (action: Action) => {
    if (!game || lock.current) return;
    const next = performAction(game, action, game.revision);
    if (next === game) return;
    lock.current = true; audio.current.unlock(); setGame(next); setSelected(action.type === 'reconstruct' ? selected.filter(id => next.inventory.some(t => t.id === id)) : []);
    discover(next.discoveries);
    notices.enqueue(discoveryNotices(next.events));
    const updatedUnread={magic:[...new Set([...unread.magic,...next.events.filter(e=>e.freshSpell&&e.spell).map(e=>e.spell!)])],reaction:[...new Set([...unread.reaction,...next.events.filter(e=>e.freshReaction&&e.reaction).map(e=>e.reaction!)])]};
    setUnread(updatedUnread);if(!saveUx(UNREAD_KEY,updatedUnread))setStorageError(true);
    const found = [...new Set([...loadReactions(), ...reactions, ...next.reactionDiscoveries])];
    setReactions(found); if (!saveReactions(found)) setStorageError(true);
    if (action.type === 'cast') {notices.remove(['guide:combine']);if(tutorial<2)setTutorial(2);if(next.screen==='battle')guide(next.spellsUsed===1?['twice','keep']:['keep']);}
    if(action.type==='endTurn'&&next.screen==='battle')guide(['keep']);
    if(next.spellsUsed!==1||action.type==='endTurn'||action.type==='burst')notices.remove(['guide:twice']);
    const enemyActed = next.events.some(e => e.kind === 'enemy');
    play(next, false, () => {
      if ((enemyActed && (tutorial >= 2 || action.type === 'cast')) || next.screen !== 'battle') setTutorial(3);
    });
  };
  const openCodex = (target: HintTarget | null = null) => {
    if (lock.current) return;
    setHintTarget(target); setOverlay('codex');
  };
  const reveal = (target: HintTarget) => {
    const next = revealHint(hints, target); setHints(next);
    if (!saveHints(next)) setStorageError(true);
  };
  const hintSpell = game ? discoverableSpell(game.inventory, discoveries, hints) : undefined;
  const choose = (id: RewardId, element?: Element) => {
    if (!game || lock.current) return;
    const next = chooseReward(game, id, Math.random, element); if (next === game) return;
    setGame(next); setSelected([]); setDiscovery(null); setTutorial(3); play(next, true);
  };
  return <div className={`world rework ${reducedMotion ? 'reduced-motion' : ''} ${simpleBanners ? 'simple-banners' : ''}`}><div className="ambient-orb orb-a" /><div className="ambient-orb orb-b" /><div className="desktop-label">CHEMAGE <span>MAKE A LITTLE MAGIC · XI</span></div><div className={`game-shell ${visibleGame?.screen === 'battle' ? 'in-battle' : ''}`}>
    <header className="topbar"><button className="brand" disabled={busy} onClick={() => game && setOverlay('leave')} aria-label={game ? '메인 메뉴로 돌아가기' : 'CHEMAGE'}><Icon name="spark" size={18} /><span>CHEMAGE</span><small>XI</small></button><div><button className="icon-button" disabled={busy} onClick={() => openCodex()} aria-label="마법 도감"><Icon name="book" size={17} /></button><button className="icon-button" onClick={() => setOverlay('settings')} aria-label="효과음 및 움직임 설정"><Icon name="settings" size={17} /></button><button className="icon-button help-button" onClick={() => setOverlay('help')} aria-label="도움말">?</button></div></header>
    {!visibleGame ? <Menu start={start} codex={() => openCodex()} help={() => setOverlay('help')} found={discoveries.length} /> : visibleGame.screen === 'battle' ? <Battle noticeActive={!!notices.notice} guideHighlight={notices.notice?.highlight} onReconstructionMode={setReconstructionMode} hint={hintSpell ? () => openCodex({kind:'magic', id:hintSpell.id}) : undefined} game={visibleGame} selected={selected} discoveries={discoveries} busy={busy} tutorial={tutorial} select={select} act={act} skip={() => controller.current.skip()} event={playback?.event ?? null} eventIndex={playback?.index ?? -1} speed={speed} discovery={discovery} detail={(title, text) => setDetail({ title, text })} /> : visibleGame.screen === 'reward' ? <Rewards game={visibleGame} choose={choose} /> : <Ending game={visibleGame} restart={start} menu={() => {notices.clear();setGame(null);}} codex={() => setOverlay('codex')} />}
    {game && notices.notice && <UxNotice notice={notices.notice} dismiss={notices.dismiss} skipGuides={skipGuides}/>}
    {overlay === 'codex' && <Codex unread={unread} onRead={markRead} hints={hints} onReveal={reveal} initialTarget={hintTarget} reactions={reactions} discoveries={discoveries} onClose={closeOverlay} storageError={storageError} />}
    {overlay === 'help' && <Help onClose={closeOverlay} />}
    {overlay === 'settings' && <Modal title="소리와 움직임" onClose={closeOverlay}><div className="settings-row"><span>효과음</span><button aria-pressed={sound} onClick={() => { const next = !sound; setSound(next); audio.current.enabled = next; if (next) { audio.current.unlock(); audio.current.select(); } }}>{sound ? '켜짐' : '꺼짐'}</button></div><div className="settings-row"><span>연출 속도</span><button onClick={() => setSpeed(v => v === 1 ? 1.5 : 1)} aria-label={`연출 속도 ${speed}배`}>{speed}×</button></div><div className="settings-row"><span>움직임 줄이기</span><button aria-pressed={reducedMotion} onClick={() => setReducedMotion(v => !v)}>{reducedMotion ? '켜짐' : '꺼짐'}</button></div><div className="settings-row"><span>턴 알림 간소화</span><button aria-pressed={simpleBanners} onClick={() => setSimpleBanners(v => !v)}>{simpleBanners ? '켜짐' : '꺼짐'}</button></div><p className="fine-print">재생 중 발동 버튼을 누르면 연출을 넘깁니다. 소리가 지원되지 않아도 게임은 진행됩니다.</p></Modal>}
    {detail && <Modal title={detail.title} onClose={closeOverlay}><p className="detail-copy">{detail.text}</p></Modal>}
    {overlay === 'leave' && <Modal title="이번 모험을 마칠까요?" onClose={closeOverlay}><p className="muted">발견한 마법은 남습니다.<br />진행 중인 모험은 저장되지 않습니다.</p><button className="primary-button" onClick={closeOverlay}>모험 계속하기</button><button className="secondary-button" onClick={() => { controller.current.cancel(); lock.current = false; setPlayback(null); setGame(null); setOverlay(null); }}>메인 메뉴로</button></Modal>}
  </div><div className="desktop-footnote">두 번의 마법. 당신만의 조합.</div></div>;
}
