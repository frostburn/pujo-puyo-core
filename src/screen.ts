import {
  HEIGHT,
  VISIBLE_HEIGHT,
  Puyos,
  WIDTH,
  applyMask,
  applyXor,
  clear,
  sparkGroups,
  clone,
  collides,
  connections,
  emptyPuyos,
  fallOne,
  fromArray,
  sparkGarbage,
  getMask,
  inMask,
  invert,
  isEmpty,
  isNonEmpty,
  merge,
  puyoAt,
  resolveGravity,
  singlePuyo,
  toArray,
  toFlagArray,
  toIndexArray,
  topLine,
  trimUnsupported,
  vanishTop,
  toppedUp,
  flood,
  puyoCount,
  visible,
  GHOST_Y,
} from './bitboard';
import {JKISS32} from './jkiss';

export type ScreenRules = {
  clearThreshold: number;
};

/**
 * Result of advancing the screen one step.
 */
export type TickResult = {
  score: number;
  colors: number[];
  chainNumber: number;
  didJiggle: boolean;
  didClear: boolean;
  didFall: boolean;
  coloredLanded: boolean;
  garbageLanded: boolean;
  allClear: boolean;
  busy: boolean;
  lockedOut: boolean;
};

export type ScreenState = {
  grid: number[];
  connectivity: number[];
  falling: boolean[];
  jiggling: boolean[];
  ignited: boolean[];
  sparking: boolean[];
  chainNumber: number;
};

// Indices of types of puyos in the grid
export const RED = 0;
export const GREEN = 1;
export const YELLOW = 2;
export const BLUE = 3;
export const PURPLE = 4;
export const GARBAGE = 5;

export const AIR = -1; // Not indexed.

export const NUM_PUYO_COLORS = 5;
export const NUM_PUYO_TYPES = 6;

export const ASCII_PUYO = 'RGYBPN';

// Scoring
const MAX_CLEAR_BONUS = 999;
const COLOR_BONUS = [0, 0, 3, 6, 12, 24];
const CHAIN_POWERS = [
  0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448,
  480, 512, 544, 576, 608, 640, 672,
];

// Connectivity flags
export const CONNECTS_DOWN = 1;
export const CONNECTS_UP = 2;
export const CONNECTS_RIGHT = 4;
export const CONNECTS_LEFT = 8;

/**
 * Convert puyo grid index to an ANSI color code.
 * @param n Grid index to convert.
 * @param dark Return a darkened version of the color.
 * @returns A string with the ANSI color switch instruction.
 */
export function colorOf(n?: number, dark = false) {
  if (n === undefined) {
    return '\x1b[30m';
  }
  if (n < 0) {
    return '\x1b[0m';
  }
  if (dark) {
    return `\x1b[3${n + 1}m`;
  }
  return `\x1b[3${n + 1};1m`;
}

function gridFromLines(lines: string[]) {
  const grid = [];
  for (let j = 0; j < NUM_PUYO_TYPES; ++j) {
    const array: boolean[] = [];
    lines.forEach(line => {
      for (let i = 0; i < WIDTH; ++i) {
        array.push(line[i] === ASCII_PUYO[j]);
      }
    });
    grid.push(fromArray(array));
  }
  return grid;
}

/**
 * A 6x16 screen of puyos, optimized for AI planning.
 * Gravity and chains resolve instantly and there are no sparks.
 * Only the bottom 6x12 area is chainable.
 * The 13th row acts as a ghost line which holds puyos that do not yet participate in chains.
 * The 14th, 15th and 16th rows are vanished once everything has landed.
 * There are 5 different colors of puyos and 1 type of garbage/nuisance puyo.
 */
export class SimplePuyoScreen {
  grid: Puyos[];
  // Buffering is an implementation detail. We don't have the space to drop a rock of garbage at once.
  bufferedGarbage: number;
  // Replays and netcode benefit from deterministic randomness.
  // Knowing the correct garbage seed can be considered cheating on the AIs part, but that's minor enough.
  jkiss: JKISS32;
  // Game rules
  rules: ScreenRules;

  /**
   * Construct a new 6x16 screen of puyos.
   */
  constructor(garbageSeed: number | Uint32Array, rules: ScreenRules) {
    this.grid = [];
    for (let i = 0; i < NUM_PUYO_TYPES; ++i) {
      this.grid.push(emptyPuyos());
    }
    this.bufferedGarbage = 0;
    this.jkiss = new JKISS32(garbageSeed);
    this.rules = rules;
  }

  toJSON() {
    return {
      grid: this.grid.map(puyos => [...puyos]),
      bufferedGarbage: this.bufferedGarbage,
      jkiss: this.jkiss,
      rules: this.rules,
    };
  }

  static fromJSON(obj: any) {
    const result = new SimplePuyoScreen(0, obj.rules);
    for (let j = 0; j < obj.grid.length; ++j) {
      // TODO: Hide slicing details inside bitboard.ts
      for (let i = 0; i < WIDTH; ++i) {
        result.grid[j][i] = obj.grid[j][i];
      }
    }
    result.bufferedGarbage = obj.bufferedGarbage;
    result.jkiss = JKISS32.fromJSON(obj.jkiss);
    return result;
  }

  /**
   * Construct a new screen from ASCII representation of the grid.
   * @param lines Array of strings consisting of characters "RGYBPN", "N" stands for nuisance i.e. garbage.
   * @returns A 6x16 screen of puyos filled from top to bottom.
   */
  static fromLines(
    lines: string[],
    garbageSeed: number | Uint32Array,
    rules: ScreenRules
  ) {
    const result = new SimplePuyoScreen(garbageSeed, rules);
    result.grid = gridFromLines(lines);
    return result;
  }

  get state(): ScreenState {
    const mask = this.mask;
    const supportMask = clone(mask);
    trimUnsupported(supportMask);
    const unsupportMask = clone(supportMask);
    invert(unsupportMask);
    applyMask(unsupportMask, mask);

    const connetivityGrid = [
      emptyPuyos(),
      emptyPuyos(),
      emptyPuyos(),
      emptyPuyos(),
    ];

    const ignitionMask = emptyPuyos();

    this.grid.slice(0, -1).forEach(puyos => {
      const supported = inMask(puyos, supportMask);
      const unsupported = inMask(puyos, unsupportMask);

      connections(supported).forEach((connectivity, i) =>
        merge(connetivityGrid[i], connectivity)
      );
      connections(unsupported).forEach((connectivity, i) =>
        merge(connetivityGrid[i], connectivity)
      );

      const {sparks} = sparkGroups(supported, this.rules.clearThreshold);
      merge(ignitionMask, sparks);
    });

    return {
      grid: toIndexArray(this.grid),
      connectivity: toFlagArray(connetivityGrid),
      falling: toArray(unsupportMask),
      ignited: toArray(ignitionMask),
      jiggling: [],
      sparking: [],
      chainNumber: 0,
    };
  }

  /**
   * Convert screen to lines of ASCII.
   * @returns Array of strings consisting of characters "RGYBPN", "N" stands for nuisance i.e. garbage.
   */
  toLines(): string[] {
    const result = [];
    for (let y = 0; y < HEIGHT; ++y) {
      let line = '';
      for (let x = 0; x < WIDTH; ++x) {
        let char = ' ';
        for (let i = 0; i < NUM_PUYO_TYPES; ++i) {
          if (puyoAt(this.grid[i], x, y)) {
            char = ASCII_PUYO[i];
          }
        }
        line += char;
      }
      result.push(line);
    }
    return result;
  }

  /**
   * Replace the screen with random material.
   */
  randomize() {
    const array = [];
    for (let i = 0; i < WIDTH * HEIGHT; ++i) {
      if (Math.random() < 0.5) {
        array.push(-1);
      } else {
        array.push(Math.floor(Math.random() * NUM_PUYO_TYPES));
      }
    }
    this.grid = [];
    for (let i = 0; i < NUM_PUYO_TYPES; ++i) {
      this.grid.push(fromArray(array.map(a => a === i)));
    }
  }

  /**
   * An array of strings suitable for rendering the screen in the console.
   */
  displayLines(): string[] {
    const result = ['╔════════════╗'];
    for (let y = 0; y < HEIGHT; ++y) {
      let line = '║';
      for (let x = 0; x < WIDTH; ++x) {
        if (x > 0) {
          line += ' ';
        }
        let any = false;
        let many = false;
        for (let i = 0; i < NUM_PUYO_TYPES; ++i) {
          if (puyoAt(this.grid[i], x, y)) {
            if (any) {
              many = true;
            } else {
              line += colorOf(i, y < HEIGHT - VISIBLE_HEIGHT);
              if (i === GARBAGE) {
                line += '◎';
              } else {
                line += '●';
              }
            }
            any = true;
          }
        }
        if (many) {
          line = line.slice(0, -1) + '?';
        }
        if (!any) {
          line += ' ';
        }
      }
      line += `${colorOf(AIR)} ║`;
      result.push(line);
    }
    result.push('╚════════════╝');
    return result;
  }

  /**
   * Render the screen in the console.
   */
  log(): void {
    console.log(this.displayLines().join('\n'));
  }

  // Create (up to) one line of garbage.
  protected commitGarbageLine() {
    if (this.bufferedGarbage >= WIDTH) {
      merge(this.grid[GARBAGE], topLine());
      this.bufferedGarbage -= WIDTH;
    } else if (this.bufferedGarbage) {
      const line = Array(this.bufferedGarbage)
        .fill(true)
        .concat(Array(WIDTH - this.bufferedGarbage).fill(false));
      this.jkiss.shuffle(line);
      merge(this.grid[GARBAGE], fromArray(line));
      this.bufferedGarbage = 0;
    }
  }

  /**
   * Resolve the screen of all spontaneous activity.
   * @returns The score accumulated.
   */
  tick(): TickResult {
    const result: TickResult = {
      score: 0,
      colors: [],
      chainNumber: 0,
      didJiggle: false,
      didClear: false,
      didFall: false,
      coloredLanded: false,
      garbageLanded: false,
      allClear: false,
      busy: false,
      lockedOut: false,
    };

    // Commit garbage buffer.
    while (this.bufferedGarbage) {
      this.commitGarbageLine();
      fallOne(this.grid);
    }

    let active = true;
    while (active) {
      // Make everything fall down.
      active = resolveGravity(this.grid);

      // XXX: Gravity resultion doesn't differentiate between colored and garbage so we don't send landing signals.
      result.didFall = result.didFall || active;

      // Make everything above the ghost line disappear.
      this.grid.forEach(vanishTop);

      // Clear groups and give score accordingly.
      const colors: number[] = [];
      let didClear = false;
      let totalNumCleared = 0;
      let totalGroupBonus = 0;
      const totalCleared = emptyPuyos();

      for (let i = 0; i < NUM_PUYO_COLORS; ++i) {
        const {numCleared, groupBonus, sparks} = sparkGroups(
          this.grid[i],
          this.rules.clearThreshold
        );
        if (numCleared) {
          totalNumCleared += numCleared;
          totalGroupBonus += groupBonus;
          applyXor(this.grid[i], sparks);
          merge(totalCleared, sparks);
          colors.push(i);
          didClear = true;
        }
      }

      applyXor(
        this.grid[GARBAGE],
        sparkGarbage(this.grid[GARBAGE], totalCleared)
      );

      const colorBonus = COLOR_BONUS[colors.length];
      const chainPower = CHAIN_POWERS[result.chainNumber];
      const clearBonus = Math.max(
        1,
        Math.min(MAX_CLEAR_BONUS, chainPower + colorBonus + totalGroupBonus)
      );
      result.score += 10 * totalNumCleared * clearBonus;
      // This is a waste of cycles, but here if you need it...
      /*
      for (const color of colors) {
        if (!result.colors.includes(color)) {
          result.colors.push(color);
        }
      }
      */

      if (didClear) {
        result.didClear = true;
        active = true;
        result.chainNumber++;
      }
    }
    if (this.grid.every(isEmpty)) {
      result.allClear = true;
    }

    result.lockedOut = toppedUp(this.mask);

    return result;
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

  /**
   * Mask of all the occupied space in the grid.
   */
  get mask(): Puyos {
    return getMask(this.grid);
  }

  /**
   * Mask of all the occupied space in the grid.
   */
  get coloredMask(): Puyos {
    return getMask(this.grid.slice(0, -1));
  }

  /**
   * Clone this screen as a SimplePuyoScreen.
   * @returns Copy of the screen with simplified mechanics.
   */
  toSimpleScreen() {
    const result = new SimplePuyoScreen(this.jkiss.state, this.rules);
    result.bufferedGarbage = this.bufferedGarbage;
    result.grid = this.grid.map(clone);
    return result;
  }

  /**
   * Kick a puyo up until it fits.
   * @param x Horizontal coordinate.
   * @param y Vertical coordinate.
   * @returns New vertical coordinate.
   */
  kickPuyo(x: number, y: number) {
    const mask = this.mask;
    while (y >= HEIGHT || puyoAt(mask, x, y)) {
      y--;
    }
    return y;
  }

  /**
   * Drop a puyo down until it lands.
   * Kicks up as necessary.
   * @param x Horizontal coordinate.
   * @param y Vertical coordinate.
   * @returns New vertical coordinate.
   */
  dropPuyo(x: number, y: number) {
    const mask = this.mask;
    while (y >= HEIGHT || puyoAt(mask, x, y)) {
      y--;
    }
    while (y < HEIGHT - 1 && !puyoAt(mask, x, y + 1)) {
      y++;
    }
    return y;
  }

  preIgnite(
    x1: number,
    y1: number,
    color1: number,
    x2: number,
    y2: number,
    color2: number
  ): boolean[] {
    // Under normal operation this quarantees non-ignition.
    if (y1 <= GHOST_Y) {
      y1 = 0;
    }
    if (y2 <= GHOST_Y) {
      y2 = 0;
    }
    const clearThreshold = this.rules.clearThreshold;
    if (color1 === color2 && (x1 === x2 || y1 === y2)) {
      const puyos = clone(this.grid[color1]);
      const group = singlePuyo(x1, y1);
      merge(group, singlePuyo(x2, y2));
      merge(puyos, group);
      flood(group, visible(puyos));
      if (puyoCount(group) >= clearThreshold) {
        return toArray(group);
      }
    } else {
      const result = emptyPuyos();

      const puyos1 = clone(this.grid[color1]);
      const group1 = singlePuyo(x1, y1);
      merge(puyos1, group1);
      flood(group1, visible(puyos1));
      if (puyoCount(group1) >= clearThreshold) {
        merge(result, group1);
      }

      const puyos2 = clone(this.grid[color2]);
      const group2 = singlePuyo(x2, y2);
      merge(puyos2, group2);
      flood(group2, visible(puyos2));
      if (puyoCount(group2) >= clearThreshold) {
        merge(result, group2);
      }
      return toArray(result);
    }
    return Array(WIDTH * HEIGHT).fill(false);
  }
}

/**
 * A 6x16 screen of puyos.
 * Only the bottom 6x12 area is chainable.
 * The 13th row acts as a ghost line which holds puyos that do not yet participate in chains.
 * The 14th, 15th and 16th rows are vanished once everything has landed.
 * There are 5 different colors of puyos and 1 type of garbage/nuisance puyo.
 */
export class PuyoScreen extends SimplePuyoScreen {
  chainNumber: number;
  doJiggles: boolean;
  jiggles: Puyos;
  sparks: Puyos;

  /**
   * Construct a new 6x16 screen of puyos.
   * @param garbageSeed Seed for the pseudo random number generator.
   */
  constructor(garbageSeed: number | Uint32Array, rules: ScreenRules) {
    super(garbageSeed, rules);
    this.chainNumber = 0;
    this.doJiggles = false;
    this.jiggles = emptyPuyos();
    this.sparks = emptyPuyos();
  }

  /**
   * Construct a new screen from ASCII representation of the grid.
   * @param lines Array of strings consisting of characters "RGYBPN", "N" stands for nuisance i.e. garbage.
   * @returns A 6x16 screen of puyos filled from top to bottom.
   */
  static fromLines(
    lines: string[],
    garbageSeed: number | Uint32Array,
    rules: ScreenRules
  ) {
    const result = new PuyoScreen(garbageSeed, rules);
    result.grid = gridFromLines(lines);
    return result;
  }

  get state() {
    const result = super.state;
    result.jiggling = toArray(this.jiggles);
    // Clean out jiggling air and airborne puyos.
    for (let i = 0; i < result.grid.length; ++i) {
      if (result.grid[i] < 0 || result.falling[i]) {
        result.jiggling[i] = false;
      }
    }
    result.sparking = toArray(this.sparks);
    return result;
  }

  /**
   * An array of strings suitable for rendering the screen in the console.
   */
  displayLines(): string[] {
    const result = ['╔════════════╗'];
    for (let y = 0; y < HEIGHT; ++y) {
      let line = '║';
      for (let x = 0; x < WIDTH; ++x) {
        if (x > 0) {
          line += ' ';
        }
        let any = false;
        let many = false;
        for (let i = 0; i < NUM_PUYO_TYPES; ++i) {
          if (puyoAt(this.grid[i], x, y)) {
            if (any) {
              many = true;
            } else {
              line += colorOf(i, y < HEIGHT - VISIBLE_HEIGHT);
              if (puyoAt(this.sparks, x, y)) {
                if (i === GARBAGE) {
                  line += '•';
                } else {
                  line += '⦻';
                }
              } else {
                if (i === GARBAGE) {
                  line += '◎';
                } else {
                  line += '●';
                }
              }
            }
            any = true;
          }
        }
        if (many) {
          line = line.slice(0, -1) + '?';
        }
        if (!any) {
          line += ' ';
        }
      }
      line += `${colorOf(AIR)} ║`;
      result.push(line);
    }
    result.push('╚════════════╝');
    result.push(`Chain: ${this.chainNumber}`);
    return result;
  }

  /**
   * Advance the state of the screen by one step.
   * @returns The score accumulated, group clearing flag, all-clear flag and a busy signal to discourage interaction.
   */
  tick(): TickResult {
    // Pause for a step to clear sparking puyos.
    if (isNonEmpty(this.sparks)) {
      // Invert sparks into a survival mask.
      invert(this.sparks);
      this.grid.forEach(puyos => applyMask(puyos, this.sparks));
      clear(this.sparks);
      return {
        score: 0,
        colors: [],
        chainNumber: this.chainNumber,
        didJiggle: false,
        didClear: false,
        didFall: false,
        coloredLanded: false,
        garbageLanded: false,
        allClear: this.grid.every(isEmpty),
        busy: true,
        lockedOut: false,
      };
    }

    // Create (up to) one line of garbage.
    this.commitGarbageLine();

    // Make everything unsupported fall down one grid unit.
    const {fallen, landed} = fallOne(this.grid);
    if (isNonEmpty(fallen)) {
      this.doJiggles = true;
      merge(this.jiggles, fallen);
      const colored = this.coloredMask;
      applyMask(colored, landed);
      applyMask(landed, this.grid[GARBAGE]);
      return {
        score: 0,
        colors: [],
        chainNumber: this.chainNumber,
        didJiggle: false,
        didClear: false,
        didFall: true,
        coloredLanded: isNonEmpty(colored),
        garbageLanded: isNonEmpty(landed),
        allClear: false,
        busy: true,
        lockedOut: false,
      };
    }

    // Make everything above the ghost line disappear.
    this.grid.forEach(vanishTop);

    // Pause to jiggle fallen puyos.
    if (this.doJiggles) {
      this.doJiggles = false;
      return {
        score: 0,
        colors: [],
        chainNumber: this.chainNumber,
        didJiggle: true,
        didClear: false,
        didFall: false,
        coloredLanded: false,
        garbageLanded: false,
        allClear: false,
        busy: true,
        lockedOut: false,
      };
    } else {
      clear(this.jiggles);
    }

    // Clear groups and give score accordingly.
    const colors: number[] = [];
    let didClear = false;
    let totalNumCleared = 0;
    let totalGroupBonus = 0;
    clear(this.sparks);

    for (let i = 0; i < NUM_PUYO_COLORS; ++i) {
      const {numCleared, groupBonus, sparks} = sparkGroups(
        this.grid[i],
        this.rules.clearThreshold
      );
      if (numCleared) {
        totalNumCleared += numCleared;
        totalGroupBonus += groupBonus;
        merge(this.sparks, sparks);
        colors.push(i);
        didClear = true;
      }
    }

    merge(this.sparks, sparkGarbage(this.grid[GARBAGE], this.sparks));

    const colorBonus = COLOR_BONUS[colors.length];
    const chainPower = CHAIN_POWERS[this.chainNumber];
    const clearBonus = Math.max(
      1,
      Math.min(MAX_CLEAR_BONUS, chainPower + colorBonus + totalGroupBonus)
    );
    const score = 10 * totalNumCleared * clearBonus;

    let lockedOut = false;
    if (didClear) {
      this.chainNumber++;
    } else {
      this.chainNumber = 0;
      lockedOut = toppedUp(this.mask);
    }

    return {
      score,
      colors,
      chainNumber: this.chainNumber,
      didJiggle: false,
      didClear,
      didFall: false,
      coloredLanded: false,
      garbageLanded: false,
      allClear: false,
      busy: didClear,
      lockedOut,
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
    if (!super.insertPuyo(x, y, color)) {
      const puyo = singlePuyo(x, y);
      merge(this.jiggles, puyo);
      this.doJiggles = true;
      return false;
    }
    return true;
  }

  clone() {
    const result = new (this.constructor as new (...args: any[]) => this)(
      this.jkiss.state,
      this.rules
    );
    result.grid = this.grid.map(clone);
    result.bufferedGarbage = this.bufferedGarbage;
    result.chainNumber = this.chainNumber;
    result.doJiggles = this.doJiggles;
    result.jiggles = clone(this.jiggles);
    result.sparks = clone(this.sparks);
    return result;
  }
}
