import { memo } from "react";

interface GamePieceProps {
  color?: string;
  className?: string;
}

// Plain SVG: every caller that needs motion already wraps this in a
// motion.div. Using motion.svg here added a Framer subscriber with no
// animate props of its own — extra work, identical pixels.
export const GamePiece = memo(function GamePiece({ color = "#DC143C", className = "" }: GamePieceProps) {
  const id = color.replace('#', '');
  return (
    <svg
      viewBox="0 0 100 160"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={`gp-body-${id}`} cx="30%" cy="22%" r="80%">
          <stop offset="0%"   stopColor="white" stopOpacity="0.98"/>
          <stop offset="18%"  stopColor={color} stopOpacity="0.90"/>
          <stop offset="55%"  stopColor={color}/>
          <stop offset="100%" stopColor={color} stopOpacity="0.50"/>
        </radialGradient>
        <radialGradient id={`gp-jwl-${id}`} cx="32%" cy="25%" r="74%">
          <stop offset="0%"   stopColor="white" stopOpacity="1.0"/>
          <stop offset="30%"  stopColor={color}/>
          <stop offset="100%" stopColor={color} stopOpacity="0.75"/>
        </radialGradient>
        <linearGradient id={`gp-rim-${id}`} x1="15%" y1="15%" x2="90%" y2="90%">
          <stop offset="0%"   stopColor="white" stopOpacity="0.95"/>
          <stop offset="40%"  stopColor={color} stopOpacity="0.80"/>
          <stop offset="100%" stopColor="rgba(0,0,0,0.20)"/>
        </linearGradient>
        <linearGradient id={`gp-base-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor={color} stopOpacity="0.85"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.38"/>
        </linearGradient>
        <linearGradient id={`gp-crwn-${id}`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%"   stopColor="white" stopOpacity="0.98"/>
          <stop offset="45%"  stopColor={color} stopOpacity="0.90"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.65"/>
        </linearGradient>
      </defs>

      {/* Drop shadow */}
      <ellipse cx="50" cy="155" rx="34" ry="6" fill="rgba(0,0,0,0.35)"/>

      {/* Base platform */}
      <path
        d="M 14 148 Q 12 140 20 135 L 80 135 Q 88 140 86 148 Q 85 157 50 157 Q 15 157 14 148 Z"
        fill={`url(#gp-base-${id})`}
        stroke="rgba(255,255,255,0.22)" strokeWidth="1.5"
      />
      {/* Base sheen */}
      <path d="M 22 138 Q 50 133 78 138"
        stroke="rgba(255,255,255,0.40)" strokeWidth="2" fill="none" strokeLinecap="round"/>

      {/* Stem */}
      <path d="M 35 135 Q 33 112 38 98 L 62 98 Q 67 112 65 135 Z"
        fill={color} fillOpacity="0.78"
        stroke="rgba(255,255,255,0.14)" strokeWidth="1.5"/>
      {/* Stem highlight */}
      <line x1="43" y1="133" x2="41" y2="99"
        stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" strokeLinecap="round"/>

      {/* Neck collar */}
      <ellipse cx="50" cy="98" rx="20" ry="7.5"
        fill={color} fillOpacity="0.90"
        stroke="rgba(255,255,255,0.20)" strokeWidth="1.5"/>
      <ellipse cx="50" cy="96" rx="17" ry="5"
        fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.0"/>

      {/* Main head sphere */}
      <circle cx="50" cy="60" r="33"
        fill={`url(#gp-body-${id})`}
        stroke="rgba(255,255,255,0.18)" strokeWidth="1.8"/>

      {/* Metallic rim */}
      <circle cx="50" cy="60" r="31.5"
        fill="none" stroke={`url(#gp-rim-${id})`} strokeWidth="1.8"/>

      {/* Inner jewel table */}
      <circle cx="50" cy="57" r="15"
        fill={`url(#gp-jwl-${id})`} opacity="0.90"/>
      <circle cx="50" cy="57" r="15"
        fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.2"/>

      {/* Gem facet lines */}
      <line x1="30" y1="44" x2="60" y2="83"
        stroke="rgba(255,255,255,0.14)" strokeWidth="1.2"/>
      <line x1="26" y1="61" x2="74" y2="61"
        stroke="rgba(255,255,255,0.10)" strokeWidth="1.0"/>
      <line x1="70" y1="44" x2="40" y2="83"
        stroke="rgba(255,255,255,0.10)" strokeWidth="1.0"/>

      {/* Crown — 3 spikes */}
      <polygon
        points="50,16 44,36 50,26 56,36"
        fill={`url(#gp-crwn-${id})`}
        stroke="rgba(255,255,255,0.65)" strokeWidth="1.2" strokeLinejoin="round"/>
      <polygon
        points="22,28 18,48 27,34"
        fill={`url(#gp-crwn-${id})`}
        stroke="rgba(255,255,255,0.45)" strokeWidth="1.0" strokeLinejoin="round"/>
      <polygon
        points="78,28 82,48 73,34"
        fill={`url(#gp-crwn-${id})`}
        stroke="rgba(255,255,255,0.45)" strokeWidth="1.0" strokeLinejoin="round"/>
      {/* Crown base arc connecting spikes */}
      <path d="M 18 48 Q 35 38 50 36 Q 65 38 82 48"
        stroke="rgba(255,255,255,0.30)" strokeWidth="1.2"
        fill="none" strokeLinecap="round"/>

      {/* Primary specular */}
      <ellipse cx="36" cy="44" rx="9" ry="6.5" fill="white" opacity="0.82"/>
      {/* Secondary specular */}
      <circle cx="60" cy="36" r="4.5" fill="white" opacity="0.58"/>
      {/* Micro rim glint */}
      <circle cx="22" cy="60" r="2.5" fill="white" opacity="0.45"/>
    </svg>
  );
});
