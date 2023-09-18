import {WIDTH, puyoCount} from './bitboard';
import {SimpleGame} from './game';

const HEURISTIC_FAIL = -2000000;
const PREFER_LONGER = 1.1;

export type StrategyResult = {
  move: number;
  score: number;
};

/**
 * Heuristic score to discourage wasting of material.
 * @param game Game state to evaluate.
 * @returns The amount of material in the playing grid.
 */
function materialCount(game: SimpleGame) {
  return puyoCount(game.screen.mask);
}

/**
 * Heuristic score from dropping a single puyo onto the playing field.
 * @param game Game state to evaluate.
 * @returns The highest score achievable by dropping a single puyo.
 */
function maxDroplet(game: SimpleGame): number {
  let max = HEURISTIC_FAIL;
  for (let i = 0; i < game.colorSelection.length; ++i) {
    for (let x = 0; x < WIDTH; ++x) {
      const clone = game.clone();
      clone.screen.insertPuyo(x, 1, game.colorSelection[i]);
      max = Math.max(max, clone.resolve().score);
    }
  }
  return max;
}

export function maxDropletStrategy1(game: SimpleGame): StrategyResult {
  const moves = game.availableMoves;
  // Shuffle to break ties.
  moves.sort(() => Math.random() - 0.5);

  let max = HEURISTIC_FAIL;
  let move = moves[0] || 0;
  for (let i = 0; i < moves.length; ++i) {
    const clone = game.clone();
    const tickResult = clone.playAndTick(moves[i]);
    const score =
      tickResult.score +
      PREFER_LONGER * maxDroplet(clone) +
      materialCount(clone);
    if (score > max) {
      max = score;
      move = moves[i];
    }
  }
  return {
    move,
    score: max,
  };
}

export function maxDropletStrategy2(game: SimpleGame): StrategyResult {
  const moves = game.availableMoves;
  // Shuffle to break ties.
  moves.sort(() => Math.random() - 0.5);

  let max = HEURISTIC_FAIL;
  let move = moves[0] || 0;
  for (let i = 0; i < moves.length; ++i) {
    const clone = game.clone();
    const tickResult = clone.playAndTick(moves[i]);
    const score =
      tickResult.score + PREFER_LONGER * maxDropletStrategy1(clone).score;
    if (score > max) {
      max = score;
      move = moves[i];
    }
  }
  return {
    move,
    score: max,
  };
}
