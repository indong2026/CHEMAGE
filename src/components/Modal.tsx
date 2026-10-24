import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './PixelArt';
export function Modal({ title, eyebrow, onClose, children }: { title: string; eyebrow?: string; onClose?: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current!;
    root.focus();
    function key(event: KeyboardEvent) {
      if (event.key === 'Escape' && onClose) { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const items = [...root.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]')];
      const first = items[0], last = items.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root)) { event.preventDefault(); first.focus(); }
    }
    root.addEventListener('keydown', key);
    return () => { root.removeEventListener('keydown', key); previous?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop"><section className="modal pixel-panel" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
    <header className="modal-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>{onClose && <button className="icon-button" onClick={onClose} aria-label="닫기"><Icon name="close" /></button>}</header>
    {children}
  </section></div>;
}
