import { PALETTE, SPRITES } from '../assets/sprites';
export function Sprite({ name, className = '' }: { name: string; className?: string }) {
  const grid = SPRITES[name === 'elite' ? 'beetle' : name] ?? SPRITES.mage;
  return <svg aria-hidden="true" className={`sprite ${className} ${name === 'elite' ? 'elite-sprite' : ''}`} viewBox={`0 0 ${grid[0].length} ${grid.length}`} shapeRendering="crispEdges">
    {grid.flatMap((row, y) => [...row].map((p, x) => p !== '.' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={PALETTE[p]} /> : null))}
  </svg>;
}
const ICONS: Record<string, string> = {
  lock: 'M5 0h6v2h2v4h2v10H1V6h2V2h2z M5 2v4h6V2z M7 9v4h2V9z',
  bulb: 'M5 0h6v2h2v2h1v5h-2v3H4V9H2V4h1V2h2z M6 13h4v2H6z M5 3v5h2V3z',
  circle: 'M4 1h8v2h2v2h2v6h-2v2h-2v2H4v-2H2v-2H0V5h2V3h2z M5 5v6h6V5z',
  settings: 'M6 0h4v3h2V2h2v2h-1v2h3v4h-3v2h1v2h-2v-1h-2v3H6v-3H4v1H2v-2h1v-2H0V6h3V4H2V2h2v1h2z M6 6v4h4V6z',
  sword: 'M11 1h4v4h-2v2h-2v2H9v2H7v2H5v2H1v-4h2V9h2V7h2V5h2V3h2z M3 5h2v2h2v2h2v2H7V9H5V7H3z',
  shield: 'M2 1h12v9h-2v2h-2v2H6v-2H4v-2H2z M5 4v5h2v2h2V9h2V4z',
  fire: 'M8 0h2v4h2v2h2v7h-2v2H4v-2H2V7h2V5h2v5h2V7H6V4h2z',
  spark: 'M7 0h2v5h2v2h5v2h-5v2H9v5H7v-5H5V9H0V7h5V5h2z',
  book: 'M1 2h5v1h4V2h5v12h-5v1H6v-1H1z M3 4v8h3V4z M10 4v8h3V4z',
  heart: 'M2 2h4v2h4V2h4v2h2v6h-2v2h-2v2h-2v2H6v-2H4v-2H2v-2H0V4h2z',
  warning: 'M7 0h2v2h2v3h2v3h2v5h1v3H0v-3h1V8h2V5h2V2h2z M7 5v5h2V5z M7 12v2h2v-2z',
  flask: 'M5 0h6v2h-1v4l5 7v3H1v-3l5-7V2H5z M7 7l-3 5h8L9 7V2H7z',
  refine: 'M3 0h8v2h2v2h2V2h1v7H9V7h4V5h-2V3H5v2H3z M0 7h7v2H3v2h2v2h6v-2h2v5H5v-2H3v-2H1v2H0z',
  bag: 'M5 0h6v2h2v3h2v10H1V5h2V2h2z M5 2v3h6V2z M3 7v6h10V7z',
  drop: 'M7 0h2v3h2v3h2v3h2v4h-2v2H3v-2H1V9h2V6h2V3h2z',
  wait: 'M2 7h3v3H2z M7 7h3v3H7z M12 7h3v3h-3z',
  close: 'M2 0h2v2h2v2h2V2h2V0h2v4h-2v2H8v2h2v2h2v4h-2v-2H8v-2H6v2H4v2H2v-4h2V8h2V6H4V4H2z',
  check: 'M13 2h3v3h-2v2h-2v2h-2v2H8v2H5v-2H3V9H1V6h3v2h2v2h1V8h2V6h2V4h2z',
};
export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges"><path fill="currentColor" fillRule="evenodd" d={ICONS[name] ?? ICONS.spark} /></svg>;
}
export function LabBackground() {
  return <svg className="lab-background" viewBox="0 0 432 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true" shapeRendering="crispEdges">
    <defs><pattern id="brick" width="48" height="24" patternUnits="userSpaceOnUse"><path fill="#191c33" d="M0 0h48v24H0z"/><path fill="#242640" d="M1 1h45v20H1z"/><path stroke="#2b2d48" d="M2 2h42"/></pattern><radialGradient id="glow"><stop stopColor="#8e73cf" stopOpacity=".25"/><stop offset="1" stopColor="#14172b" stopOpacity="0"/></radialGradient></defs>
    <path fill="url(#brick)" d="M0 0h432v240H0z"/>
    <path fill="#30304b" d="M104 166V62h8V46h12V30h16V18h24V10h104v8h24v12h16v16h12v16h8v104z"/>
    <path fill="#101525" d="M116 166V65h8V50h14V35h24V25h108v10h24v15h14v15h8v101z"/>
    <path fill="#191d35" d="M128 166V68h8V54h24V42h112v12h24v14h8v98z"/>
    <path stroke="#383552" strokeWidth="3" d="M216 25v140M128 90h176M158 46v120M274 46v120"/>
    <path fill="#a99bd1" opacity=".45" d="M177 58h3v3h-3zM249 75h2v2h-2zM232 44h3v3h-3zM146 116h2v2h-2zM284 128h3v3h-3z"/>
    <path fill="#15192c" d="M0 170h432v70H0z"/><path stroke="#2f2e48" d="M0 188h432M0 214h432M90 170L64 240M342 170l26 70M170 170l-8 70M262 170l8 70"/>
    <path fill="#343047" d="M0 116h78v8H0zM352 116h80v8h-80zM4 60h60v7H4zM364 60h68v7h-68z"/>
    <path fill="#21243a" d="M10 124h60v46H10zM362 124h60v46h-60z"/><path stroke="#4c4053" strokeWidth="3" d="M12 129h56M364 129h56M40 135v28M392 135v28"/>
    <path fill="#64556f" d="M14 87h16v28H14zM40 97h14v18H40zM366 84h14v31h-14zM395 93h19v22h-19z"/>
    <path fill="#78b6b0" d="M17 96h10v16H17zM43 105h8v7h-8zM369 92h8v20h-8z"/><path fill="#a47ba8" d="M398 100h13v12h-13z"/>
    <path fill="#61506d" d="M15 38h8v20h-8zM26 32h7v26h-7zM37 39h9v19h-9zM378 36h7v22h-7zM388 31h8v27h-8zM400 37h7v21h-7z"/>
    <path fill="#605366" d="M83 77h8v28h-8zM341 77h8v28h-8z"/><path fill="#edb780" d="M84 69h6v18h-6zM342 69h6v18h-6z"/><path fill="#fff1ba" d="M86 64h2v12h-2zM344 64h2v12h-2z"/>
    <ellipse cx="216" cy="130" rx="180" ry="130" fill="url(#glow)"/>
    <path stroke="#6b608e" strokeWidth="2" fill="none" opacity=".6" d="M142 194l26-12h96l26 12-26 12h-96zM165 194l51-12 51 12-51 12z"/>
  </svg>;
}
