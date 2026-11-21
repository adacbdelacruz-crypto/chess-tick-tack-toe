import React from 'react';
import type { PieceType, PlayerColor } from '../shared/gameEngine';

interface ChessPieceGlyphProps {
  type: PieceType;
  color: PlayerColor;
  className?: string;
}

export const PIECE_LABELS: Record<PieceType, string> = {
  rook: 'Rook',
  bishop: 'Bishop',
  knight: 'Knight',
  pawn: 'Pawn',
  queen: 'Queen',
};

export function ChessPieceGlyph({
  type,
  color,
  className = 'w-10 h-10',
}: ChessPieceGlyphProps) {
  const isWhite = color === 'white';
  const fill = isWhite ? '#fafafa' : '#09090b';
  const stroke = isWhite ? '#09090b' : '#e4e4e7';
  const detail = isWhite ? '#18181b' : '#a1a1aa';

  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      aria-label={`${color} ${type}`}
      role="img"
    >
      {type === 'rook' && (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path
            d="M11 40h26v-4H11v4zm3-4l2-17h16l2 17H14zm-1-17V10h5v4h3v-4h6v4h3v-4h5v9H13z"
            fill={fill}
            stroke={stroke}
            strokeWidth="2.2"
          />
          <line x1="16" y1="32" x2="32" y2="32" stroke={detail} strokeWidth="1.5" />
          <line x1="15" y1="21" x2="33" y2="21" stroke={detail} strokeWidth="1.5" />
        </g>
      )}

      {type === 'bishop' && (
        <g strokeLinejoin="round" strokeLinecap="round">
          <circle cx="24" cy="9" r="3" fill={fill} stroke={stroke} strokeWidth="2" />
          <path
            d="M13 40h22v-4H13v4zm3-4c0-6 2-11 8-22 6 11 8 16 8 22H16z"
            fill={fill}
            stroke={stroke}
            strokeWidth="2.2"
          />
          <path
            d="M21 21l6 6m0-6l-6 6"
            stroke={detail}
            strokeWidth="1.8"
          />
          <line x1="16" y1="33" x2="32" y2="33" stroke={detail} strokeWidth="1.5" />
        </g>
      )}

      {type === 'knight' && (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path
            d="M12 40h24v-4H12v4zm3-4c0-7 3-11 7-14l-6 2-3-5 6-7 2-4 5 2c6 1 10 6 10 15 0 4-1 8-3 11H15z"
            fill={fill}
            stroke={stroke}
            strokeWidth="2.2"
          />
          <circle cx="22" cy="15" r="1.4" fill={detail} />
          <path d="M17 33h15" stroke={detail} strokeWidth="1.5" />
        </g>
      )}

      {type === 'pawn' && (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path
            d="M14 40h20v-4H14v4zm3-4c1-6 3-10 4-13h6c1 3 3 7 4 13H17z"
            fill={fill}
            stroke={stroke}
            strokeWidth="2.2"
          />
          <circle cx="24" cy="16" r="6" fill={fill} stroke={stroke} strokeWidth="2.2" />
          <line x1="19" y1="23" x2="29" y2="23" stroke={detail} strokeWidth="1.6" />
        </g>
      )}

      {type === 'queen' && (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path
            d="M11 40h26v-4H11v4zm3-4L9 16l8 7 7-11 7 11 8-7-5 20H14z"
            fill={fill}
            stroke={stroke}
            strokeWidth="2.2"
          />
          <circle cx="9" cy="14" r="2" fill={fill} stroke={stroke} strokeWidth="1.6" />
          <circle cx="24" cy="10" r="2.3" fill={fill} stroke={stroke} strokeWidth="1.6" />
          <circle cx="39" cy="14" r="2" fill={fill} stroke={stroke} strokeWidth="1.6" />
          <line x1="15" y1="32" x2="33" y2="32" stroke={detail} strokeWidth="1.5" />
        </g>
      )}
    </svg>
  );
}
