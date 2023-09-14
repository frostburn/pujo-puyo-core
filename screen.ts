import {HEIGHT, Puyos, WIDTH, emptyPuyos, fallOne, fromArray, puyoAt} from "./bitboard";

// Indices of types of puyos in the grid
export const RED = 0;
export const GREEN = 1;
export const YELLOW = 2;
export const BLUE = 3;
export const PURPLE = 4;
export const GARBAGE = 5;

export type PuyoScreen = {
  grid: Puyos[],
};

const NUM_PUYO_TYPES = 6;

/**
 * Obtain an empty 6x15 screen of puyos.
 */
export function emptyScreen(): PuyoScreen {
  const grid: Puyos[] = [];
  for (let i = 0; i < NUM_PUYO_TYPES; ++i) {
    grid.push(emptyPuyos());
  }
  return {grid};
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
  return {grid};
}

export function colorOf(n: number) {
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
            line += colorOf(i);
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
}
