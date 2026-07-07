import { motion } from "framer-motion";

interface GamePieceProps {
  color?: string;
  className?: string;
}

export function GamePiece({ color = "#DC143C", className = "" }: GamePieceProps) {
  return (
    <motion.svg 
      viewBox="0 0 100 150" 
      className={className} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <g stroke="rgba(0,0,0,0.3)" strokeWidth="4" strokeLinejoin="round">
        {/* Base / Body */}
        <path 
          d="M 25 130 Q 30 100 40 70 Q 40 50 50 40 Q 60 50 60 70 Q 70 100 75 130 Q 90 130 90 145 L 10 145 Q 10 130 25 130 Z" 
          fill={color} 
        />
        {/* Head */}
        <circle cx="50" cy="40" r="28" fill={color} />
      </g>
      
      {/* Glossy Highlights */}
      <circle cx="42" cy="32" r="8" fill="white" opacity="0.5" />
      <path 
        d="M 25 130 C 35 125, 65 125, 75 130" 
        stroke="white" 
        strokeWidth="4" 
        fill="none" 
        strokeLinecap="round"
        opacity="0.4" 
      />
      <path 
        d="M 15 140 L 85 140" 
        stroke="white" 
        strokeWidth="3" 
        fill="none" 
        strokeLinecap="round"
        opacity="0.3" 
      />
      <path 
        d="M 38 70 Q 40 50 48 43" 
        stroke="white" 
        strokeWidth="3" 
        fill="none" 
        strokeLinecap="round"
        opacity="0.4" 
      />
    </motion.svg>
  );
}
