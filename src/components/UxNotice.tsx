import { Icon } from './PixelArt';
import type { UxNotice as Notice } from '../presentation/ux';
export function UxNotice({notice,dismiss,skipGuides}:{notice:Notice;dismiss:()=>void;skipGuides:()=>void}) {
  return <aside className={`ux-notice ux-${notice.kind}`} role="status" aria-live="polite">
    <div className="ux-notice-card"><button className="ux-close" aria-label="알림 닫기" onClick={dismiss}>×</button>
      <b className="ux-title"><Icon name={notice.kind==='reaction-discovery'?'flask':notice.kind==='discovery'?'spark':'bulb'} size={15}/>{notice.title}</b>
      <p>{notice.text}</p>{notice.formula&&<strong className="ux-formula">{notice.formula}</strong>}{notice.name&&<b className="ux-name">{notice.name}</b>}{notice.detail&&<small>{notice.detail}</small>}
      {notice.kind==='guide'&&<div className="ux-guide-actions"><button onClick={skipGuides}>가이드 건너뛰기</button><button onClick={dismiss}>확인</button></div>}
      {(notice.kind==='discovery'||notice.kind==='reaction-discovery')&&<div className="ux-pixels" aria-hidden="true"><i/><i/><i/><i/></div>}
    </div>
  </aside>;
}
