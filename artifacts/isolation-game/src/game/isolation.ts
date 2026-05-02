export type Player = "human" | "ai";
export type CellState = "empty" | "human" | "ai" | "blocked";

export interface Position {
  row: number;
  col: number;
}

export interface GameState {
  board: CellState[][];
  humanPos: Position;
  aiPos: Position;
  currentPlayer: Player;
  status: "playing" | "human-wins" | "ai-wins";
}

export function createInitialState(humanStartCol: number = 1): GameState {
  const board: CellState[][] = Array.from({ length: 3 }, () =>
    Array(3).fill("empty")
  );
  const humanPos: Position = { row: 2, col: humanStartCol };
  // AI always starts at top row, opposite or mirrored side
  const aiCol = humanStartCol === 0 ? 2 : humanStartCol === 2 ? 0 : 1;
  const aiPos: Position = { row: 0, col: aiCol };
  board[humanPos.row][humanPos.col] = "human";
  board[aiPos.row][aiPos.col] = "ai";
  return {
    board,
    humanPos,
    aiPos,
    currentPlayer: "human",
    status: "playing",
  };
}

export function getValidMoves(
  board: CellState[][],
  pos: Position
): Position[] {
  const moves: Position[] = [];
  const dirs = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ];
  for (const [dr, dc] of dirs) {
    const nr = pos.row + dr;
    const nc = pos.col + dc;
    if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
      if (board[nr][nc] === "empty") {
        moves.push({ row: nr, col: nc });
      }
    }
  }
  return moves;
}

export function applyMove(
  state: GameState,
  newPos: Position,
  player: Player
): GameState {
  const newBoard = state.board.map((row) => [...row]);
  const oldPos = player === "human" ? state.humanPos : state.aiPos;

  // Block old position
  newBoard[oldPos.row][oldPos.col] = "blocked";

  // Place piece at new position
  newBoard[newPos.row][newPos.col] = player;

  const newHumanPos = player === "human" ? newPos : state.humanPos;
  const newAiPos = player === "ai" ? newPos : state.aiPos;

  // Check if the next player has any valid moves
  const nextPlayer: Player = player === "human" ? "ai" : "human";
  const nextPos = nextPlayer === "human" ? newHumanPos : newAiPos;
  const nextMoves = getValidMoves(newBoard, nextPos);

  let status: GameState["status"] = "playing";
  if (nextMoves.length === 0) {
    // The next player is trapped => current player wins
    status = player === "human" ? "human-wins" : "ai-wins";
  }

  return {
    board: newBoard,
    humanPos: newHumanPos,
    aiPos: newAiPos,
    currentPlayer: nextPlayer,
    status,
  };
}

// Minimax with alpha-beta pruning
function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean
): number {
  if (state.status === "ai-wins") return 100 - depth;
  if (state.status === "human-wins") return depth - 100;
  if (depth === 0) {
    // Heuristic: difference in mobility
    const aiMoves = getValidMoves(state.board, state.aiPos).length;
    const humanMoves = getValidMoves(state.board, state.humanPos).length;
    return aiMoves - humanMoves;
  }

  if (isMaximizing) {
    // AI's turn
    const moves = getValidMoves(state.board, state.aiPos);
    if (moves.length === 0) return depth - 100;
    let best = -Infinity;
    for (const move of moves) {
      const next = applyMove(state, move, "ai");
      const score = minimax(next, depth - 1, alpha, beta, false);
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    // Human's turn
    const moves = getValidMoves(state.board, state.humanPos);
    if (moves.length === 0) return 100 - depth;
    let best = Infinity;
    for (const move of moves) {
      const next = applyMove(state, move, "human");
      const score = minimax(next, depth - 1, alpha, beta, true);
      best = Math.min(best, score);
      beta = Math.min(beta, score);
      if (beta <= alpha) break;
    }
    return best;
  }
}

export function getBestAiMove(state: GameState): Position | null {
  const moves = getValidMoves(state.board, state.aiPos);
  if (moves.length === 0) return null;

  let bestScore = -Infinity;
  let bestMove = moves[0];

  for (const move of moves) {
    const next = applyMove(state, move, "ai");
    const score = minimax(next, 6, -Infinity, Infinity, false);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}
