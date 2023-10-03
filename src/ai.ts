import {JKISS32} from '.';
import {
  CLEAR_THRESHOLD,
  GHOST_Y,
  VISIBLE_HEIGHT,
  WIDTH,
  clone,
  flood,
  inMask,
  invert,
  merge,
  puyoCount,
  shatter,
  verticalLine,
  visible,
} from './bitboard';
import {PASS, SIMPLE_GAME_OVER, SimpleGame} from './game';

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
  return puyoCount(game.screen.coloredMask);
}

/**
 * Heuristic score to discourage top-outs.
 * @param game Game state to evaluate.
 * @returns Negatively weighted sum of material in the top three rows.
 */
function topPenalty(game: SimpleGame) {
  const mask = game.screen.mask;
  return (
    -3 * puyoCount(inMask(mask, verticalLine(GHOST_Y))) -
    2 * puyoCount(inMask(mask, verticalLine(GHOST_Y + 1))) -
    puyoCount(inMask(mask, verticalLine(GHOST_Y + 2)))
  );
}

/**
 * Determine if the game is effectively locked out.
 */
export function effectiveLockout(game: SimpleGame) {
  let mask = game.screen.mask;
  const count = puyoCount(visible(mask));
  if (count < WIDTH * VISIBLE_HEIGHT - 2) {
    return 0;
  }
  if (count >= WIDTH * VISIBLE_HEIGHT) {
    return SIMPLE_GAME_OVER;
  }
  invert(mask);
  mask = visible(mask);
  const pieces = shatter(mask);
  const testPiece = pieces[0];
  flood(testPiece, mask);
  if (game.bag.length >= 2) {
    if (game.bag[0] === game.bag[1] && puyoCount(testPiece) === 2) {
      const puyos = visible(game.screen.grid[game.bag[0]]);
      merge(puyos, mask);
      flood(mask, puyos);
      if (puyoCount(mask) >= CLEAR_THRESHOLD) {
        return 0;
      }
    } else {
      for (let i = 0; i < pieces.length; ++i) {
        let spot = clone(pieces[i]);
        let puyos = visible(game.screen.grid[game.bag[0]]);
        merge(puyos, spot);
        flood(spot, puyos);
        if (puyoCount(spot) >= CLEAR_THRESHOLD) {
          return 0;
        }
        spot = clone(pieces[i]);
        puyos = visible(game.screen.grid[game.bag[1]]);
        merge(puyos, spot);
        flood(spot, puyos);
        if (puyoCount(spot) >= CLEAR_THRESHOLD) {
          return 0;
        }
      }
      return SIMPLE_GAME_OVER;
    }
  } else {
    for (let j = 0; j < game.colorSelection.length; ++j) {
      const color = game.colorSelection[j];
      const puyos = visible(game.screen.grid[color]);
      if (puyoCount(testPiece) === 2) {
        const spot = clone(mask);
        const target = clone(puyos);
        merge(target, spot);
        flood(spot, target);
        if (puyoCount(spot) >= CLEAR_THRESHOLD) {
          return 0;
        }
      }
      for (let i = 0; i < pieces.length; ++i) {
        const spot = clone(pieces[i]);
        const target = clone(puyos);
        merge(spot, target);
        flood(spot, puyos);
        if (puyoCount(spot) >= CLEAR_THRESHOLD) {
          return 0;
        }
      }
    }
    return SIMPLE_GAME_OVER;
  }
  return 0;
}

function passPenalty(move: number, game: SimpleGame): number {
  if (move === PASS) {
    return Math.min(0, -10 * game.lateTimeRemaining);
  }
  return 0;
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

/**
 * Heuristic score from dropping a single puyo of every color onto the playing field and averaging the results.
 * @param game Game state to evaluate.
 * @returns Average of the highest scores achievable by dropping a single puyo and a true max bonus.
 */
function flexDroplet(game: SimpleGame): number {
  let result = 0;
  let trueMax = HEURISTIC_FAIL;
  for (let i = 0; i < game.colorSelection.length; ++i) {
    let max = HEURISTIC_FAIL;
    for (let x = 0; x < WIDTH; ++x) {
      const clone = game.clone();
      clone.screen.insertPuyo(x, 1, game.colorSelection[i]);
      max = Math.max(max, clone.resolve().score);
    }
    result += max;
    trueMax = Math.max(trueMax, max);
  }
  return (0.8 * result) / game.colorSelection.length + 0.2 * trueMax;
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
      passPenalty(moves[i], game) +
      tickResult.score +
      PREFER_LONGER * maxDroplet(clone) +
      materialCount(clone) +
      topPenalty(clone);
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
      passPenalty(moves[i], game) +
      tickResult.score +
      PREFER_LONGER * maxDropletStrategy1(clone).score;
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

export function flexDropletStrategy1(game: SimpleGame): StrategyResult {
  const moves = game.availableMoves;
  // Shuffle to break ties.
  moves.sort(() => Math.random() - 0.5);

  let flexBonus = 0;
  let max = HEURISTIC_FAIL;
  let move = moves[0] || 0;
  for (let i = 0; i < moves.length; ++i) {
    const clone = game.clone();
    const tickResult = clone.playAndTick(moves[i]);
    const score =
      passPenalty(moves[i], game) +
      tickResult.score +
      PREFER_LONGER * flexDroplet(clone) +
      materialCount(clone) +
      topPenalty(clone) +
      effectiveLockout(clone);
    if (score > max) {
      max = score;
      move = moves[i];
    }
    flexBonus += score;
  }
  flexBonus /= moves.length || 1;
  return {
    move,
    score: 0.9 * max + 0.1 * flexBonus,
  };
}

export function flexDropletStrategy2(game: SimpleGame): StrategyResult {
  const moves = game.availableMoves;
  // Shuffle to break ties.
  moves.sort(() => Math.random() - 0.5);

  let flexBonus = 0;
  let max = HEURISTIC_FAIL;
  let move = moves[0] || 0;
  for (let i = 0; i < moves.length; ++i) {
    const clone = game.clone();
    const tickResult = clone.playAndTick(moves[i]);
    const score =
      passPenalty(moves[i], game) +
      tickResult.score +
      PREFER_LONGER * flexDropletStrategy1(clone).score;
    if (score > max) {
      max = score;
      move = moves[i];
    }
    flexBonus += score;
  }
  flexBonus /= moves.length || 1;
  return {
    move,
    score: 0.9 * max + 0.1 * flexBonus,
  };
}

export function flexDropletStrategy3(game: SimpleGame): StrategyResult {
  const moves = game.availableMoves;
  // Shuffle to break ties.
  moves.sort(() => Math.random() - 0.5);

  let flexBonus = 0;
  let max = HEURISTIC_FAIL;
  let move = moves[0] || 0;
  for (let i = 0; i < moves.length; ++i) {
    const clone = game.clone();
    const tickResult = clone.playAndTick(moves[i]);
    const score =
      passPenalty(moves[i], game) +
      tickResult.score +
      PREFER_LONGER * flexDropletStrategy2(clone).score;
    if (score > max) {
      max = score;
      move = moves[i];
    }
    flexBonus += score;
  }
  flexBonus /= moves.length || 1;
  return {
    move,
    score: 0.9 * max + 0.1 * flexBonus,
  };
}

// Use high quality randomness for the moves.
let RANDOM_JKISS: JKISS32 | undefined;

export function randomStrategy(game: SimpleGame): StrategyResult {
  if (RANDOM_JKISS === undefined) {
    RANDOM_JKISS = new JKISS32();
  }

  const moves = game.availableMoves;
  if (moves.length) {
    const entropy = RANDOM_JKISS.step();
    return {
      move: moves[entropy % moves.length],
      score: entropy, // ha ha ha
    };
  } else {
    return {
      move: 0,
      score: HEURISTIC_FAIL, // aw shucks
    };
  }
}

export function nullStrategy(): StrategyResult {
  return {
    move: 0,
    score: 0,
  };
}
