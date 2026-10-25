import { Icon, LabBackground, Sprite } from '../components/PixelArt';
import { SPELLS } from '../data/spells';
export function Menu({ start, codex, help, found }: { start: () => void; codex: () => void; help: () => void; found: number }) {
  return <main className="menu-screen"><div className="menu-kicker"><span /> A LITTLE ALCHEMY ADVENTURE <span /></div><h1>CHEMAGE<span>원소의 마법사</span></h1><p className="menu-description">우연히 만난 원소로,<br />당신만의 마법을 만드세요.</p>
    <div className="menu-scene"><LabBackground /><div className="orbit orbit-one">H</div><div className="orbit orbit-two">O</div><div className="orbit orbit-three">Fe</div><div className="menu-flask"><Sprite name="flask" /></div><div className="menu-mage"><Sprite name="mage" /></div><div className="menu-spark s1" /><div className="menu-spark s2" /><div className="menu-spark s3" /></div>
    <div className="menu-copy"><span className="eyebrow">SIX ELEMENTS. ENDLESS POSSIBILITY.</span><p>원소를 고르고 · 마법을 발견하세요</p></div>
    <div className="menu-buttons"><button className="primary-button" onClick={start}><Icon name="spark" />새로운 모험<span>→</span></button><button className="secondary-button" onClick={codex}><Icon name="book" />화학 마법 도감<small>{found} / {SPELLS.length} 발견</small></button><button className="text-button" onClick={help}>처음 오셨나요? 플레이 방법</button></div>
    <div className="menu-footer"><span>5개의 전투</span><i /> <span>{SPELLS.length}개의 마법</span><i /> <span>한 번의 모험</span></div><p className="save-note">모험은 새로 시작돼요. 발견한 마법은 남아요.</p>
  </main>;
}


