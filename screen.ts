import {Puyos, emptyPuyos} from "./bitboard";

// Indices of types of puyos in the grid
export type RED = 0;
export type GREEN = 1;
export type YELLOW = 2;
export type BLUE = 3;
export type PURPLE = 4;
export type GARBAGE = 5;

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
