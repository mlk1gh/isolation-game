import { useState, useEffect, useCallback, useRef } from "react";
import {
  createInitialState,
  getValidMoves,
  applyMove,
  getBestAiMove,
  type GameState,
  type Position,
  type CellState,
} from "../game/isolation";

type AnimatingCells = Set<string>;
type Screen = "setup" | "playing";

const START_OPTIONS = [
  { col: 0, label: "Left",   icon: "←" },
  { col: 1, label: "Middle", icon: "↑" },
  { col: 2, label: "Right",  icon: "→" },
];

function cellKey(pos: Position) {
  return `${pos.row}-${pos.col}`;
}

function posEqual(a: Position, b: Position) {
  return a.row === b.row && a.col === b.col;
}

export default function GameBoard() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [chosenCol, setChosenCol] = useState<number | null>(null);
  const [hoveredOption, setHoveredOption] = useState<number | null>(null);

  const [gameState, setGameState] = useState<GameState>(createInitialState(1));
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [validMoves, setValidMoves] = useState<Position[]>([]);
  const [hoveredCell, setHoveredCell] = useState<Position | null>(null);
  const [animatingCells, setAnimatingCells] = useState<AnimatingCells>(new Set());
  const [newPieceCells, setNewPieceCells] = useState<AnimatingCells>(new Set());
  const [aiThinking, setAiThinking] = useState(false);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerCellAnimate = useCallback((key: string) => {
    setAnimatingCells((prev) => new Set(prev).add(key));
    setTimeout(() => {
      setAnimatingCells((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 500);
  }, []);

  const triggerPieceAnimate = useCallback((key: string) => {
    setNewPieceCells((prev) => new Set(prev).add(key));
    setTimeout(() => {
      setNewPieceCells((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 400);
  }, []);

  const doAiMove = useCallback((state: GameState) => {
    setAiThinking(true);
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    aiTimerRef.current = setTimeout(() => {
      const move = getBestAiMove(state);
      if (!move) {
        setAiThinking(false);
        return;
      }
      const oldKey = cellKey(state.aiPos);
      const newKey = cellKey(move);
      const next = applyMove(state, move, "ai");
      triggerCellAnimate(oldKey);
      triggerPieceAnimate(newKey);
      setGameState(next);
      setAiThinking(false);
    }, 900);
  }, [triggerCellAnimate, triggerPieceAnimate]);

  const handleStartGame = useCallback(() => {
    if (chosenCol === null) return;
    const initial = createInitialState(chosenCol);
    setGameState(initial);
    setSelectedPos(null);
    setValidMoves([]);
    setHoveredCell(null);
    setAnimatingCells(new Set());
    setNewPieceCells(new Set());
    setAiThinking(false);
    setScreen("playing");
  }, [chosenCol]);

  const handleCellClick = useCallback(
    (pos: Position) => {
      if (gameState.status !== "playing") return;
      if (gameState.currentPlayer !== "human") return;
      if (aiThinking) return;

      const cell = gameState.board[pos.row][pos.col];

      if (cell === "human") {
        if (selectedPos && posEqual(selectedPos, pos)) {
          setSelectedPos(null);
          setValidMoves([]);
        } else {
          setSelectedPos(pos);
          setValidMoves(getValidMoves(gameState.board, pos));
        }
        return;
      }

      if (selectedPos) {
        const isValid = validMoves.some((m) => posEqual(m, pos));
        if (isValid) {
          const oldKey = cellKey(selectedPos);
          const newKey = cellKey(pos);
          const next = applyMove(gameState, pos, "human");
          triggerCellAnimate(oldKey);
          triggerPieceAnimate(newKey);
          setGameState(next);
          setSelectedPos(null);
          setValidMoves([]);
          if (next.status === "playing") {
            doAiMove(next);
          }
        }
      }
    },
    [gameState, selectedPos, validMoves, aiThinking, triggerCellAnimate, triggerPieceAnimate, doAiMove]
  );

  const handleRestart = useCallback(() => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    setChosenCol(null);
    setScreen("setup");
    setSelectedPos(null);
    setValidMoves([]);
    setHoveredCell(null);
    setAnimatingCells(new Set());
    setNewPieceCells(new Set());
    setAiThinking(false);
  }, []);

  useEffect(() => {
    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, []);

  const getCellStyle = (cell: CellState, pos: Position): string => {
    const key = cellKey(pos);
    const isSelected = selectedPos && posEqual(selectedPos, pos);
    const isValid = validMoves.some((m) => posEqual(m, pos));
    const isHovered = hoveredCell && posEqual(hoveredCell, pos);
    const isBlocking = animatingCells.has(key);

    let base =
      "relative flex items-center justify-center rounded-2xl transition-all duration-200 cursor-pointer select-none ";

    if (cell === "blocked" || isBlocking) {
      base += "bg-gray-300 cursor-default shadow-inner ";
      if (isBlocking) base += "cell-block-animate ";
    } else if (cell === "human") {
      base += "bg-white shadow-md ";
      if (isSelected) {
        base += "ring-4 ring-blue-400 ring-offset-2 shadow-lg shadow-blue-200 ";
      } else {
        base += isHovered ? "shadow-lg scale-105 " : "";
      }
    } else if (cell === "ai") {
      base += "bg-white shadow-md ";
      base += isHovered ? "shadow-lg scale-105 " : "";
    } else {
      if (isValid) {
        base += "bg-blue-50 border-2 border-blue-300 valid-move-pulse shadow-sm ";
      } else {
        base += "bg-white border border-gray-100 ";
        if (isHovered && gameState.currentPlayer === "human" && gameState.status === "playing" && !aiThinking) {
          base += "bg-gray-50 border-gray-200 shadow-sm ";
        }
      }
    }

    return base;
  };

  const getStatusText = () => {
    if (gameState.status === "human-wins") return "You Win!";
    if (gameState.status === "ai-wins") return "AI Wins!";
    if (aiThinking) return "AI thinking";
    if (gameState.currentPlayer === "human") {
      return selectedPos ? "Select a destination" : "Your turn";
    }
    return "AI's turn";
  };

  const getStatusColor = () => {
    if (gameState.status === "human-wins") return "text-blue-600";
    if (gameState.status === "ai-wins") return "text-red-500";
    if (aiThinking) return "text-amber-500";
    if (gameState.currentPlayer === "human") return "text-blue-500";
    return "text-gray-500";
  };

  const isGameOver = gameState.status !== "playing";

  // ── Setup screen ────────────────────────────────────────────────────────────
  if (screen === "setup") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-8 w-full max-w-sm status-animate">

          {/* Title */}
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-slate-800">
              Isolation
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Trap your opponent — last to move wins
            </p>
          </div>

          {/* Setup card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/80 p-8 w-full">
            <p className="text-center text-base font-semibold text-slate-700 mb-1">
              Choose your starting position
            </p>
            <p className="text-center text-xs text-slate-400 mb-6">
              You start on the bottom row — pick a column
            </p>

            {/* Mini board preview */}
            <div className="mb-6">
              <div className="grid grid-cols-3 gap-2 mb-1">
                {[0, 1, 2].map((ci) => {
                  const aiCol = chosenCol === 0 ? 2 : chosenCol === 2 ? 0 : 1;
                  const isAi = chosenCol !== null && ci === aiCol;
                  return (
                    <div
                      key={ci}
                      className="h-14 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center"
                    >
                      {isAi && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-400 to-rose-600 shadow-md shadow-red-200/60" />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-3 gap-2 mb-1">
                {[0, 1, 2].map((ci) => (
                  <div
                    key={ci}
                    className="h-14 rounded-xl bg-white border border-gray-100 shadow-sm"
                  />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((ci) => (
                  <div
                    key={ci}
                    className="h-14 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center"
                  >
                    {chosenCol === ci && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 shadow-md shadow-blue-200/60 piece-enter" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Position buttons */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {START_OPTIONS.map(({ col, label, icon }) => {
                const isChosen = chosenCol === col;
                const isHov = hoveredOption === col;
                return (
                  <button
                    key={col}
                    onClick={() => setChosenCol(col)}
                    onMouseEnter={() => setHoveredOption(col)}
                    onMouseLeave={() => setHoveredOption(null)}
                    className={`
                      flex flex-col items-center gap-1 py-3 px-2 rounded-2xl border-2
                      font-semibold text-sm transition-all duration-150
                      focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-1
                      ${isChosen
                        ? "bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-200"
                        : isHov
                          ? "bg-blue-50 border-blue-300 text-blue-600"
                          : "bg-white border-gray-200 text-slate-600"
                      }
                    `}
                  >
                    <span className="text-lg">{icon}</span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Start button */}
            <button
              onClick={handleStartGame}
              disabled={chosenCol === null}
              className={`
                w-full py-3 rounded-2xl font-semibold text-sm transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2
                ${chosenCol !== null
                  ? "bg-slate-800 text-white hover:bg-slate-700 active:bg-slate-900 active:scale-95 shadow-lg shadow-slate-300 cursor-pointer"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }
              `}
            >
              {chosenCol !== null
                ? `Start — ${START_OPTIONS.find((o) => o.col === chosenCol)?.label}`
                : "Select a position to start"}
            </button>
          </div>

          {/* Legend */}
          <div className="flex gap-8">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500 shadow-sm" />
              <span className="text-xs text-slate-500">You</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-400 shadow-sm" />
              <span className="text-xs text-slate-500">AI (auto placed)</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Game screen ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-8 w-full max-w-sm">

        {/* Title */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">
            Isolation
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Trap your opponent — last to move wins
          </p>
        </div>

        {/* Player Legend */}
        <div className="flex gap-8">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-500 shadow-md shadow-blue-200" />
            <span className="text-sm font-medium text-slate-600">You</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-red-400 shadow-md shadow-red-200" />
            <span className="text-sm font-medium text-slate-600">AI</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-lg bg-gray-300 shadow-inner" />
            <span className="text-sm font-medium text-slate-600">Blocked</span>
          </div>
        </div>

        {/* Status */}
        <div
          key={getStatusText()}
          className={`status-animate text-center ${isGameOver ? "win-animate" : ""}`}
        >
          <div className={`text-xl font-semibold ${getStatusColor()} flex items-center gap-1 justify-center`}>
            {aiThinking ? (
              <>
                <span>AI thinking</span>
                <span className="think-dot ml-1">•</span>
                <span className="think-dot">•</span>
                <span className="think-dot">•</span>
              </>
            ) : (
              <span>{getStatusText()}</span>
            )}
          </div>
          {isGameOver && (
            <p className="mt-1 text-sm text-slate-400">
              {gameState.status === "human-wins"
                ? "The AI ran out of moves!"
                : "You ran out of moves!"}
            </p>
          )}
          {!isGameOver && gameState.currentPlayer === "human" && !selectedPos && !aiThinking && (
            <p className="mt-1 text-sm text-slate-400">
              Click your blue piece to select it
            </p>
          )}
        </div>

        {/* Board */}
        <div className={`bg-white/70 backdrop-blur-sm p-4 rounded-3xl shadow-xl border border-white/80 ${isGameOver ? "opacity-90" : ""}`}>
          <div className="grid grid-cols-3 gap-3">
            {gameState.board.map((row, ri) =>
              row.map((cell, ci) => {
                const pos: Position = { row: ri, col: ci };
                const key = cellKey(pos);
                const isNewPiece = newPieceCells.has(key);
                return (
                  <div
                    key={key}
                    className={`${getCellStyle(cell, pos)} w-24 h-24`}
                    onClick={() => handleCellClick(pos)}
                    onMouseEnter={() => setHoveredCell(pos)}
                    onMouseLeave={() => setHoveredCell(null)}
                    role="button"
                    aria-label={`Cell ${ri},${ci}: ${cell}`}
                  >
                    {cell === "human" && (
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-300/60 ${isNewPiece ? "piece-enter" : ""}`} />
                    )}
                    {cell === "ai" && (
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-red-400 to-rose-600 shadow-lg shadow-red-300/60 ${isNewPiece ? "piece-enter" : ""}`} />
                    )}
                    {cell === "blocked" && !animatingCells.has(key) && (
                      <div className="w-10 h-10 rounded-xl bg-gray-400/50" />
                    )}
                    {cell === "empty" && validMoves.some((m) => posEqual(m, pos)) && (
                      <div className="w-5 h-5 rounded-full bg-blue-400/40 border-2 border-blue-400/60" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Restart Button */}
        <button
          onClick={handleRestart}
          className="px-8 py-3 rounded-2xl bg-slate-800 text-white font-semibold text-sm
                     hover:bg-slate-700 active:bg-slate-900 active:scale-95
                     transition-all duration-150 shadow-lg shadow-slate-300
                     focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
        >
          Restart Game
        </button>

        {/* Instructions */}
        <div className="text-center text-xs text-slate-400 space-y-1 max-w-xs">
          <p>Click your blue piece, then click a highlighted cell to move.</p>
          <p>Cells you leave become permanently blocked. Trap the AI!</p>
        </div>
      </div>
    </div>
  );
}
