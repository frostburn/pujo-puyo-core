import {HEIGHT, LIFE_HEIGHT, Puyos, WIDTH, clear, clearGarbage, clearGroups, collides, emptyPuyos, fallOne, fromArray, isNonEmpty, merge, puyoAt, singlePuyo, vanishTop} from "./bitboard";

/**
 * Result of advancing the screen one step.
 */
type TickResult = {
  score: number,
  busy: boolean,
};

// Indices of types of puyos in the grid
export const RED = 0;
export const GREEN = 1;
export const YELLOW = 2;
export const BLUE = 3;
export const PURPLE = 4;
export const GARBAGE = 5;

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
 * Convert puyo grid index to an ANSI color code.
 * @param n Grid index to convert.
 * @param dark Return a darkened version of the color.
 * @returns A string with the ANSI color switch instruction.
 */
export function colorOf(n: number, dark = false) {
  if (dark) {
    return `\x1b[3${n+1}m`;
  }
  return `\x1b[3${n+1};1m`;
}

/**
 * A 6x15 screen of puyos.
 * Only the bottom 6x12 area is chainable.
 * The 13th row acts as a ghost line which holds puyos that do not yet participate in chains.
 * The 14th and 15th rows are vanished once everything has landed.
 * There are 5 different colors of puyos and 1 type of garbage/nuisance puyo.
 */
export class PuyoScreen {
  grid: Puyos[];
  sparks: Puyos[];
  chainNumber: number;

  constructor() {
    this.grid = [];
    this.sparks = [];
    for (let i = 0; i < NUM_PUYO_TYPES; ++i) {
      this.grid.push(emptyPuyos());
      this.sparks.push(emptyPuyos());
    }
    this.chainNumber = 0;
  }

  /**
   * Replace the screen with random material.
   */
  randomize() {
    const array = [];
    for (let i = 0; i < WIDTH * HEIGHT; ++i) {
      if (Math.random() < .5) {
        array.push(-1);
      } else {
        array.push(Math.floor(Math.random() * NUM_PUYO_TYPES));
      }
    }
    this.grid = [];
    for (let i = 0; i < NUM_PUYO_TYPES; ++i) {
      this.grid.push(fromArray(array.map(a => a == i)));
    }
  }

  /**
   * An array of strings suitable for rendering the screen in the console.
   */
  displayLines(): string[] {
    const result = ["╔════════════╗"];
    for (let y = 0; y < HEIGHT; ++y) {
      let line = "║";
      for (let x = 0; x < WIDTH; ++x) {
        if (x > 0) {
          line += " ";
        }
        let any = false;
        let many = false;
        for (let i = 0; i < NUM_PUYO_TYPES; ++i) {
          if (puyoAt(this.grid[i], x, y)) {
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
          if (puyoAt(this.sparks[i], x, y)) {
            if (any) {
              many = true;
            } else {
              line += colorOf(i);
              line += "⦻";
            }
            any = true;
          }
        }
        if (many) {
          line = line.slice(0, -1) + "?";
        }
        if (!any) {
          line += " ";
        }
      }
      line += "\x1b[0m ║";
      result.push(line);
    }
    result.push("╚════════════╝");
    result.push(`Chain: ${this.chainNumber}`);
    return result;
  }

  /**
   * Render the screen in the console.
   */
  log(): void {
    this.displayLines().forEach(line => console.log(line));
  }

  /**
   * Advance the state of the screen by one step.
   * @returns The score accumulated and a busy signal to discourage interaction.
   */
  tick(): TickResult {
    if (this.sparks.some(isNonEmpty)) {
      this.sparks.forEach(clear);
      return {score: 0, busy: true}
    }

    if (fallOne(this.grid)) {
      return {score: 0, busy: true};
    }

    this.grid.forEach(vanishTop);

    let numColors = 0;
    let didClear = false;
    let totalNumCleared = 0;
    let totalGroupBonus = 0;
    const totalCleared = emptyPuyos();

    for (let i = 0; i < NUM_PUYO_COLORS; ++i) {
      const {numCleared, groupBonus, cleared} = clearGroups(this.grid[i]);
      if (numCleared) {
        totalNumCleared += numCleared;
        totalGroupBonus += groupBonus;
        merge(totalCleared, cleared);
        this.sparks[i] = cleared;
        numColors++;
        didClear = true;
      }
    }

    this.sparks[GARBAGE] = clearGarbage(this.grid[GARBAGE], totalCleared);

    const colorBonus = COLOR_BONUS[numColors];
    const chainPower = CHAIN_POWERS[this.chainNumber];
    const clearBonus = Math.max(1, Math.min(MAX_CLEAR_BONUS, chainPower + colorBonus + totalGroupBonus));
    const score = (10 * totalNumCleared) * clearBonus;

    if (didClear) {
      this.chainNumber++;
    } else {
      this.chainNumber = 0;
    }

    return {
      score,
      busy: didClear
    };
  }

  /**
   * Insert a single puyo into the screen.
   * @param x Horizontal coordinate, 0-indexed, left to right.
   * @param y Vertical coordinate, 0-indexed, top to bottom.
   * @param color Color of the puyo to insert.
   * @returns `true` if the space was already occupied.
   */
  insertPuyo(x: number, y: number, color: number) {
    const puyo = singlePuyo(x, y);
    if (collides(puyo, ...this.grid)) {
      return true;
    }
    merge(this.grid[color], puyo);
    return false;
  }
}
