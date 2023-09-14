import {HEIGHT, LIFE_HEIGHT, Puyos, WIDTH, clearGarbage, clearGroups, collides, emptyPuyos, fallOne, fromArray, merge, puyoAt, singlePuyo} from "./bitboard";

// Indices of types of puyos in the grid
export const RED = 0;
export const GREEN = 1;
export const YELLOW = 2;
export const BLUE = 3;
export const PURPLE = 4;
export const GARBAGE = 5;

export type PuyoScreen = {
  grid: Puyos[],
  chainNumber: number,
  score: number,
};

export const NUM_PUYO_COLORS = 5;
export const NUM_PUYO_TYPES = 6;

// Scoring
const MAX_CLEAR_BONUS = 999;
const COLOR_BONUS = [0, 0, 3, 6, 12, 24];
const CHAIN_POWERS = [
  0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288,
  320, 352, 384, 416, 448, 480, 512, 544, 576, 608, 640, 672
];

/**
 * Obtain an empty 6x15 screen of puyos.
 */
export function emptyScreen(): PuyoScreen {
  const grid: Puyos[] = [];
  for (let i = 0; i < NUM_PUYO_TYPES; ++i) {
    grid.push(emptyPuyos());
  }
  return {grid, chainNumber: 0, score: 0};
}

export function randomScreen(): PuyoScreen {
  const array = [];
  for (let i = 0; i < WIDTH * HEIGHT; ++i) {
    if (Math.random() < .5) {
      array.push(-1);
    } else {
      array.push(Math.floor(Math.random() * NUM_PUYO_TYPES));
    }
  }
  const grid: Puyos[] = [];
  for (let i = 0; i < NUM_PUYO_TYPES; ++i) {
    grid.push(fromArray(array.map(a => a == i)));
  }
  return {grid, chainNumber: 0, score: 0};
}

export function colorOf(n: number, dark = false) {
  if (dark) {
    return `\x1b[3${n+1}m`;
  }
  return `\x1b[3${n+1};1m`;
}

export function logScreen(screen: PuyoScreen): void {
  console.log("╔════════════╗");
  for (let y = 0; y < HEIGHT; ++y) {
    let line = "║";
    for (let x = 0; x < WIDTH; ++x) {
      if (x > 0) {
        line += " ";
      }
      let any = false;
      let many = false;
      for (let i = 0; i < NUM_PUYO_TYPES; ++i) {
        if (puyoAt(screen.grid[i], x, y)) {
          if (any) {
            many = true;
          } else {
            line += colorOf(i, y < HEIGHT - LIFE_HEIGHT);
            if (i == GARBAGE) {
              line += "◎";
            } else {
              line += "●";
            }
          }
          any = true;
        }
      }
      if (many) {
        line = line.slice(0, -1) + "X";
      }
      if (!any) {
        line += " ";
      }
    }
    line += "\x1b[0m ║";
    console.log(line);
  }
  console.log("╚════════════╝");
  console.log(`Chain: ${screen.chainNumber}`);
  console.log(`Score: ${screen.score}`);
}

export function tick(screen: PuyoScreen) {
  if (fallOne(screen.grid)) {
    return true;
  }
  let numColors = 0;
  let didClear = false;
  let totalNumCleared = 0;
  let totalGroupBonus = 0;
  const totalCleared = emptyPuyos();
  // TODO: Splashes from clearing, clear everything beyond ghost line
  for (let i = 0; i < NUM_PUYO_COLORS; ++i) {
    const {numCleared, groupBonus, cleared} = clearGroups(screen.grid[i]);
    totalNumCleared += numCleared;
    totalGroupBonus += groupBonus;
    merge(totalCleared, cleared);
    if (numCleared) {
      numColors++;
      didClear = true;
    }
  }

  clearGarbage(screen.grid[GARBAGE], totalCleared);

  const colorBonus = COLOR_BONUS[numColors];
  const chainPower = CHAIN_POWERS[screen.chainNumber];
  const clearBonus = Math.max(1, Math.min(MAX_CLEAR_BONUS, chainPower + colorBonus + totalGroupBonus));
  screen.score += (10 * totalNumCleared) * clearBonus;

  if (didClear) {
    screen.chainNumber++;
  } else {
    screen.chainNumber = 0;
  }

  return didClear;
}

export function insertPuyo(screen: PuyoScreen, x: number, y: number, color: number) {
  const puyo = singlePuyo(x, y);
  if (collides(puyo, ...screen.grid)) {
    return true;
  }
  merge(screen.grid[color], puyo);
  return false;
}
