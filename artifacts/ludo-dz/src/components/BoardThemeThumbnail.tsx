import { memo, type CSSProperties } from 'react';
import type { BoardStyle } from '../App';
import * as DZ from '../lib/board-theme-dz';
import * as NM from '../lib/board-theme-normal';

// ─── Shared mini-board thumbnails ─────────────────────────────────────────────
// One 60×60 mini-board SVG per BoardStyle, rendered at any size. This is the
// single source for theme previews everywhere: the Settings picker shows them
// at 42px inside its option rows, and the compact pre-match switcher reuses
// the exact same artwork at ~26px so "what you pick is what you saw" holds
// across both surfaces.

/** Per-theme accent colour — matches the badge/tint each theme uses in Settings. */
export const BOARD_THEME_ACCENTS: Record<BoardStyle, string> = {
  neon: '#00FFEE',
  classic: '#C8960A',
  dz: '#C9A227',
  normal: '#4472C4',
};

const NeonBoardArt = memo(function NeonBoardArt() {
  return (
    <>
      <rect width="60" height="60" fill="#06101e"/>
      {/* Corner home areas */}
      <rect x="1"  y="1"  width="22" height="22" rx="3.5" fill="#DC143C" opacity="0.80"/>
      <rect x="37" y="1"  width="22" height="22" rx="3.5" fill="#1E90FF" opacity="0.80"/>
      <rect x="1"  y="37" width="22" height="22" rx="3.5" fill="#00A550" opacity="0.80"/>
      <rect x="37" y="37" width="22" height="22" rx="3.5" fill="#FFD700" opacity="0.80"/>
      {/* Pawn slots */}
      <circle cx="8"  cy="8"  r="2.8" fill="#ff9999" opacity="0.85"/>
      <circle cx="16" cy="8"  r="2.8" fill="#ff9999" opacity="0.85"/>
      <circle cx="8"  cy="16" r="2.8" fill="#ff9999" opacity="0.85"/>
      <circle cx="16" cy="16" r="2.8" fill="#ff9999" opacity="0.85"/>
      <circle cx="44" cy="8"  r="2.8" fill="#99ccff" opacity="0.85"/>
      <circle cx="52" cy="8"  r="2.8" fill="#99ccff" opacity="0.85"/>
      <circle cx="44" cy="16" r="2.8" fill="#99ccff" opacity="0.85"/>
      <circle cx="52" cy="16" r="2.8" fill="#99ccff" opacity="0.85"/>
      <circle cx="8"  cy="44" r="2.8" fill="#66dd99" opacity="0.85"/>
      <circle cx="16" cy="44" r="2.8" fill="#66dd99" opacity="0.85"/>
      <circle cx="8"  cy="52" r="2.8" fill="#66dd99" opacity="0.85"/>
      <circle cx="16" cy="52" r="2.8" fill="#66dd99" opacity="0.85"/>
      <circle cx="44" cy="44" r="2.8" fill="#ffe680" opacity="0.85"/>
      <circle cx="52" cy="44" r="2.8" fill="#ffe680" opacity="0.85"/>
      <circle cx="44" cy="52" r="2.8" fill="#ffe680" opacity="0.85"/>
      <circle cx="52" cy="52" r="2.8" fill="#ffe680" opacity="0.85"/>
      {/* Cross lanes */}
      <rect x="23" y="1"  width="14" height="58" fill="#071422"/>
      <rect x="1"  y="23" width="58" height="14" fill="#071422"/>
      {/* Home stretch tints */}
      <rect x="23" y="1"  width="14" height="20" fill="#DC143C" opacity="0.20"/>
      <rect x="23" y="39" width="14" height="20" fill="#1E90FF" opacity="0.20"/>
      <rect x="1"  y="23" width="20" height="14" fill="#00A550" opacity="0.20"/>
      <rect x="39" y="23" width="20" height="14" fill="#FFD700" opacity="0.20"/>
      {/* Center area */}
      <rect x="23" y="23" width="14" height="14" rx="2" fill="#06101e"/>
      <polygon points="30,24.5 35.5,30 30,35.5 24.5,30" fill="#00FFEE" opacity="0.60"/>
      {/* Neon grid lines */}
      <line x1="23" y1="0" x2="23" y2="60" stroke="#00FFEE" strokeWidth="0.5" opacity="0.22"/>
      <line x1="37" y1="0" x2="37" y2="60" stroke="#00FFEE" strokeWidth="0.5" opacity="0.22"/>
      <line x1="0" y1="23" x2="60" y2="23" stroke="#00FFEE" strokeWidth="0.5" opacity="0.22"/>
      <line x1="0" y1="37" x2="60" y2="37" stroke="#00FFEE" strokeWidth="0.5" opacity="0.22"/>
      {/* Outer border */}
      <rect x="0.5" y="0.5" width="59" height="59" stroke="#00FFEE" strokeWidth="0.8" fill="none" opacity="0.45"/>
    </>
  );
});

const ClassicBoardArt = memo(function ClassicBoardArt() {
  return (
    <>
      <rect width="60" height="60" fill="#EDD9A3"/>
      <rect x="1"  y="1"  width="22" height="22" rx="2" fill="#C41E2A" opacity="0.80"/>
      <rect x="37" y="1"  width="22" height="22" rx="2" fill="#1055A0" opacity="0.80"/>
      <rect x="1"  y="37" width="22" height="22" rx="2" fill="#1A7838" opacity="0.80"/>
      <rect x="37" y="37" width="22" height="22" rx="2" fill="#C89600" opacity="0.80"/>
      <rect x="2.5"  y="2.5"  width="19" height="19" rx="1.5" fill="#F8D8D8" opacity="0.90"/>
      <rect x="38.5" y="2.5"  width="19" height="19" rx="1.5" fill="#D0DCF8" opacity="0.90"/>
      <rect x="2.5"  y="38.5" width="19" height="19" rx="1.5" fill="#C8F0D8" opacity="0.90"/>
      <rect x="38.5" y="38.5" width="19" height="19" rx="1.5" fill="#F8ECC4" opacity="0.90"/>
      <circle cx="8"  cy="8"  r="3" fill="#C41E2A" opacity="0.70"/>
      <circle cx="16" cy="8"  r="3" fill="#C41E2A" opacity="0.70"/>
      <circle cx="8"  cy="16" r="3" fill="#C41E2A" opacity="0.70"/>
      <circle cx="16" cy="16" r="3" fill="#C41E2A" opacity="0.70"/>
      <circle cx="44" cy="8"  r="3" fill="#1055A0" opacity="0.70"/>
      <circle cx="52" cy="8"  r="3" fill="#1055A0" opacity="0.70"/>
      <circle cx="44" cy="16" r="3" fill="#1055A0" opacity="0.70"/>
      <circle cx="52" cy="16" r="3" fill="#1055A0" opacity="0.70"/>
      <circle cx="8"  cy="44" r="3" fill="#1A7838" opacity="0.70"/>
      <circle cx="16" cy="44" r="3" fill="#1A7838" opacity="0.70"/>
      <circle cx="8"  cy="52" r="3" fill="#1A7838" opacity="0.70"/>
      <circle cx="16" cy="52" r="3" fill="#1A7838" opacity="0.70"/>
      <circle cx="44" cy="44" r="3" fill="#C89600" opacity="0.70"/>
      <circle cx="52" cy="44" r="3" fill="#C89600" opacity="0.70"/>
      <circle cx="44" cy="52" r="3" fill="#C89600" opacity="0.70"/>
      <circle cx="52" cy="52" r="3" fill="#C89600" opacity="0.70"/>
      <rect x="23" y="1"  width="14" height="58" fill="#F5EDD0"/>
      <rect x="1"  y="23" width="58" height="14" fill="#F5EDD0"/>
      <rect x="25" y="1"  width="10" height="20" fill="#C41E2A" opacity="0.20"/>
      <rect x="25" y="39" width="10" height="20" fill="#1055A0" opacity="0.20"/>
      <rect x="1"  y="25" width="20" height="10" fill="#1A7838" opacity="0.20"/>
      <rect x="39" y="25" width="20" height="10" fill="#C89600" opacity="0.20"/>
      <rect x="23" y="23" width="14" height="14" rx="1.5" fill="#EDD9A3"/>
      <polygon points="23,23 37,23 30,30" fill="#1055A0" opacity="0.76"/>
      <polygon points="37,23 37,37 30,30" fill="#C89600" opacity="0.76"/>
      <polygon points="37,37 23,37 30,30" fill="#1A7838" opacity="0.76"/>
      <polygon points="23,37 23,23 30,30" fill="#C41E2A" opacity="0.76"/>
      <polygon points="30,25.5 31.4,28.8 35,28.8 32.3,30.9 33.3,34.1 30,32.2 26.7,34.1 27.7,30.9 25,28.8 28.6,28.8" fill="#7A5018" opacity="0.80"/>
      <line x1="23" y1="0" x2="23" y2="60" stroke="#9B7630" strokeWidth="0.7" opacity="0.30"/>
      <line x1="37" y1="0" x2="37" y2="60" stroke="#9B7630" strokeWidth="0.7" opacity="0.30"/>
      <line x1="0" y1="23" x2="60" y2="23" stroke="#9B7630" strokeWidth="0.7" opacity="0.30"/>
      <line x1="0" y1="37" x2="60" y2="37" stroke="#9B7630" strokeWidth="0.7" opacity="0.30"/>
      <rect x="0.5" y="0.5" width="59" height="59" stroke="#7A5018" strokeWidth="1" fill="none" opacity="0.62"/>
    </>
  );
});

const DzBoardArt = memo(function DzBoardArt() {
  return (
    <>
      <rect width="60" height="60" fill={DZ.BOARD_BG}/>
      {/* Corner home areas — TL=P0, TR=P1, BR=P2, BL=P3 (matches engine corner assignment) */}
      <rect x="1"  y="1"  width="22" height="22" rx="2" fill={DZ.HOME_COLORS[0]} opacity="0.92"/>
      <rect x="37" y="1"  width="22" height="22" rx="2" fill={DZ.HOME_COLORS[1]} opacity="0.92"/>
      <rect x="37" y="37" width="22" height="22" rx="2" fill={DZ.HOME_COLORS[2]} opacity="0.92"/>
      <rect x="1"  y="37" width="22" height="22" rx="2" fill={DZ.HOME_COLORS[3]} opacity="0.92"/>
      {/* Cream cross lanes */}
      <rect x="23" y="1"  width="14" height="58" fill={DZ.PATH_CREAM}/>
      <rect x="1"  y="23" width="58" height="14" fill={DZ.PATH_CREAM}/>
      {/* Home-stretch tints (top=P0, bottom=P1, left=P3, right=P2 — matches Neon/Classic thumbnail convention) */}
      <rect x="25" y="1"  width="10" height="20" fill={DZ.STRIP_COLORS[0]} opacity="0.55"/>
      <rect x="25" y="39" width="10" height="20" fill={DZ.STRIP_COLORS[1]} opacity="0.55"/>
      <rect x="1"  y="25" width="20" height="10" fill={DZ.STRIP_COLORS[3]} opacity="0.55"/>
      <rect x="39" y="25" width="20" height="10" fill={DZ.STRIP_COLORS[2]} opacity="0.55"/>
      {/* Center — flat gold field, Phase 1 has no ornamentation */}
      <rect x="23" y="23" width="14" height="14" fill={DZ.CENTER_GOLD}/>
      {/* Outer deep-green frame + inner gold accent line */}
      <rect x="0.5" y="0.5" width="59" height="59" rx="2" stroke={DZ.BORDER_DEEP} strokeWidth="1.6" fill="none"/>
      <rect x="2.6" y="2.6" width="54.8" height="54.8" rx="1.5" stroke={DZ.BORDER_GOLD} strokeWidth="0.6" fill="none" opacity="0.85"/>
    </>
  );
});

const NormalBoardArt = memo(function NormalBoardArt() {
  return (
    <>
      <rect width="60" height="60" fill={NM.PATH_WHITE}/>
      {/* Corner home areas — TL=P0, TR=P1, BR=P2, BL=P3 (matches engine corner assignment) */}
      <rect x="1"  y="1"  width="22" height="22" rx="2" fill={NM.HOME_COLORS[0]}/>
      <rect x="37" y="1"  width="22" height="22" rx="2" fill={NM.HOME_COLORS[1]}/>
      <rect x="37" y="37" width="22" height="22" rx="2" fill={NM.HOME_COLORS[2]}/>
      <rect x="1"  y="37" width="22" height="22" rx="2" fill={NM.HOME_COLORS[3]}/>
      {/* White base insets with coloured borders */}
      <rect x="3"  y="3"  width="18" height="18" rx="2" fill="#FFFFFF"/>
      <rect x="39" y="3"  width="18" height="18" rx="2" fill="#FFFFFF"/>
      <rect x="39" y="39" width="18" height="18" rx="2" fill="#FFFFFF"/>
      <rect x="3"  y="39" width="18" height="18" rx="2" fill="#FFFFFF"/>
      <rect x="3"  y="3"  width="18" height="18" rx="2" fill="none" stroke={NM.HOME_BASE_BORDER[0]} strokeWidth="0.8"/>
      <rect x="39" y="3"  width="18" height="18" rx="2" fill="none" stroke={NM.HOME_BASE_BORDER[1]} strokeWidth="0.8"/>
      <rect x="39" y="39" width="18" height="18" rx="2" fill="none" stroke={NM.HOME_BASE_BORDER[2]} strokeWidth="0.8"/>
      <rect x="3"  y="39" width="18" height="18" rx="2" fill="none" stroke={NM.HOME_BASE_BORDER[3]} strokeWidth="0.8"/>
      {/* White cross lanes */}
      <rect x="23" y="1"  width="14" height="58" fill={NM.PATH_WHITE}/>
      <rect x="1"  y="23" width="58" height="14" fill={NM.PATH_WHITE}/>
      {/* Home-stretch tints (top=P0, bottom=P1, left=P3, right=P2) */}
      <rect x="25" y="1"  width="10" height="20" fill={NM.STRIP_COLORS[0]}/>
      <rect x="25" y="39" width="10" height="20" fill={NM.STRIP_COLORS[1]}/>
      <rect x="1"  y="25" width="20" height="10" fill={NM.STRIP_COLORS[3]}/>
      <rect x="39" y="25" width="20" height="10" fill={NM.STRIP_COLORS[2]}/>
      {/* Center — flat white with four flat triangles */}
      <rect x="23" y="23" width="14" height="14" fill={NM.PATH_WHITE}/>
      <polygon points="23,23 37,23 30,30" fill={NM.HOME_COLORS[0]}/>
      <polygon points="37,23 37,37 30,30" fill={NM.HOME_COLORS[2]}/>
      <polygon points="37,37 23,37 30,30" fill={NM.HOME_COLORS[3]}/>
      <polygon points="23,37 23,23 30,30" fill={NM.HOME_COLORS[1]}/>
      {/* Flat hairline grid */}
      <line x1="23" y1="0" x2="23" y2="60" stroke={NM.PATH_HAIRLINE} strokeWidth="0.7"/>
      <line x1="37" y1="0" x2="37" y2="60" stroke={NM.PATH_HAIRLINE} strokeWidth="0.7"/>
      <line x1="0" y1="23" x2="60" y2="23" stroke={NM.PATH_HAIRLINE} strokeWidth="0.7"/>
      <line x1="0" y1="37" x2="60" y2="37" stroke={NM.PATH_HAIRLINE} strokeWidth="0.7"/>
      {/* Flat outer border */}
      <rect x="0.5" y="0.5" width="59" height="59" rx="2" stroke={NM.BORDER_DARK} strokeWidth="1.4" fill="none"/>
    </>
  );
});

const ART: Record<BoardStyle, React.ComponentType> = {
  neon: NeonBoardArt,
  classic: ClassicBoardArt,
  dz: DzBoardArt,
  normal: NormalBoardArt,
};

/**
 * A theme's mini-board preview. Renders the exact artwork the Settings
 * picker shows, at `size` px — pass 42 for Settings rows, ~26 for the
 * compact pre-match switcher.
 */
export function BoardThemeThumbnail({ boardStyle, size, style: svgStyle }: { boardStyle: BoardStyle; size: number; style?: CSSProperties }) {
  const Art = ART[boardStyle];
  return (
    <svg viewBox="0 0 60 60" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" style={svgStyle}>
      <Art/>
    </svg>
  );
}
