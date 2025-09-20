// client/src/games/StableChessBoard.jsx
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";

const pieceToUnicode = {
  p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚",
  P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔",
};

function useResizeWidth(ref, initial = 480) {
  const [w, setW] = useState(initial);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const width = Math.floor(entries[0].contentRect.width);
      setW(width);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return w;
}

export default function StableChessBoard({
  /** "w" | "b" — which side is at the bottom visually */
  orientation = "w",
  /** Called with SAN when a legal move is made. Return false to reject. */
  onMove,
  /** Optional starting FEN */
  initialFen,
  /** Optional external FEN to display (controlled mode) */
  fen,
  /** If you want to forbid moving when it's not the local player's turn */
  isMovable = () => true,
  /** Styling hook */
  className,
}) {
  const rootRef = useRef(null);
  const boardRef = useRef(new Chess(initialFen));
  const [localFen, setLocalFen] = useState(boardRef.current.fen());
  const [selected, setSelected] = useState(null);

  // If parent drives fen, mirror it without rebuilding engine on every render.
  useEffect(() => {
    if (!fen) return;
    const chess = boardRef.current;
    if (fen !== chess.fen()) {
      try {
        chess.load(fen);
        setLocalFen(fen);
        setSelected(null);
      } catch {
        /* ignore bad fen */
      }
    }
  }, [fen]);

  // Resize (no polling = no flicker)
  const boardWidth = useResizeWidth(rootRef);
  const squareSize = Math.floor(boardWidth / 8);

  // Draw squares from bottom-left (a1) upwards depending on orientation
  const squares = useMemo(() => {
    const files = ["a","b","c","d","e","f","g","h"];
    const ranks = ["1","2","3","4","5","6","7","8"];
    const orderFiles = orientation === "w" ? files : [...files].reverse();
    const orderRanks = orientation === "w" ? [...ranks].reverse() : ranks;
    return orderRanks.flatMap(r =>
      orderFiles.map(f => `${f}${r}`)
    );
  }, [orientation]);

  // Map: square -> piece char from FEN
  const pieceMap = useMemo(() => {
    const m = {};
    const chess = new Chess(localFen);
    chess.SQUARES.forEach((sq) => {
      const p = chess.get(sq);
      if (p) m[sq] = p.color === "w" ? p.type.toUpperCase() : p.type.toLowerCase();
    });
    return m;
  }, [localFen]);

  const tryMove = (from, to) => {
    const chess = boardRef.current;
    if (!isMovable(from, to, chess)) return;

    const res = chess.move({ from, to, promotion: "q" });
    if (!res) {
      // illegal; maybe user is selecting different piece
      setSelected(pieceMap[to] ? to : from);
      return;
    }

    const newFen = chess.fen();
    setLocalFen(newFen);
    setSelected(null);
    if (onMove) {
      const ok = onMove(res.san, res, newFen, chess.turn());
      // allow parent to cancel (very rare, but useful online)
      if (ok === false) {
        chess.undo();
        setLocalFen(chess.fen());
      }
    }
  };

  const onSquareClick = (sq) => {
    if (!selected) {
      // First click: select only if there is a piece and it's movable
      if (pieceMap[sq] && isMovable(sq, null, boardRef.current)) {
        setSelected(sq);
      }
      return;
    }
    if (selected === sq) { setSelected(null); return; }
    tryMove(selected, sq);
  };

  return (
    <div ref={rootRef} className={className} style={{ width: "100%", maxWidth: 640 }}>
      <div
        style={{
          width: squareSize * 8,
          height: squareSize * 8,
          display: "grid",
          gridTemplateColumns: "repeat(8, 1fr)",
          gridTemplateRows: "repeat(8, 1fr)",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid var(--border-color)",
          userSelect: "none",
          willChange: "transform",
          background: "#d18b47",
        }}
      >
        {squares.map((sq, i) => {
          const isDark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
          const piece = pieceMap[sq];
          const isSel = selected === sq;
          return (
            <button
              key={sq}
              onClick={() => onSquareClick(sq)}
              style={{
                appearance: "none",
                border: "none",
                padding: 0,
                margin: 0,
                width: squareSize,
                height: squareSize,
                background: isDark ? "#b58863" : "#f0d9b5",
                position: "relative",
                outline: isSel ? "3px solid #0ea5e9" : "none",
                cursor: "pointer",
              }}
              aria-label={sq}
            >
              {piece && (
                <span
                  style={{
                    fontSize: Math.floor(squareSize * 0.72),
                    lineHeight: `${squareSize}px`,
                    display: "block",
                    textAlign: "center",
                    filter: "drop-shadow(0 1px 1px rgba(0,0,0,.25))",
                  }}
                >
                  {pieceToUnicode[piece]}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
