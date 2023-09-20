// Puyos of a single color are represented as a bitboard consisting of three unsigned integers
// The width of the playing grid is fixed to 6
export type Puyos = Uint32Array;

// Bitboard constants
export const WIDTH = 6;
const SLICE_HEIGHT = 5;
const H_SHIFT = 1;
const V_SHIFT = 6;
const TOP_TO_BOTTOM = V_SHIFT * (SLICE_HEIGHT - 1);
// Bitboard patterns
const TOP = (1 << WIDTH) - 1;
const BOTTOM = TOP << ((SLICE_HEIGHT - 1) * V_SHIFT);
const FULL =
  TOP |
  (TOP << V_SHIFT) |
  (TOP << (V_SHIFT * 2)) |
  (TOP << (V_SHIFT * 3)) |
  BOTTOM;
const LEFT_WALL =
  1 |
  (1 << V_SHIFT) |
  (1 << (V_SHIFT * 2)) |
  (1 << (V_SHIFT * 3)) |
  (1 << (V_SHIFT * 4));
const RIGHT_BLOCK = FULL ^ LEFT_WALL;
const INVALID = -1 ^ FULL;
const LIFE_BLOCK = BOTTOM | (BOTTOM >> V_SHIFT);
const SEMI_LIFE_BLOCK = LIFE_BLOCK | (BOTTOM >> (2 * V_SHIFT));
// Large scale structure
export const NUM_SLICES = 3;
export const HEIGHT = SLICE_HEIGHT * NUM_SLICES;
export const LIFE_HEIGHT = 12;
export const GHOST_Y = 2;

// Rules
const CLEAR_THRESHOLD = 4;
// Scoring
const GROUP_BONUS = [0, 2, 3, 4, 5, 6, 7, 10];

export type ClearResult = {
  numCleared: number;
  groupBonus: number;
  sparks: Puyos;
};

/**
 * Obtain an empty bitboard stack of puyos.
 * @returns A screenful of air.
 */
export function emptyPuyos(): Puyos {
  return new Uint32Array(NUM_SLICES);
}

/**
 * Obtain a random collection of puyos.
 * @returns A screenful with 50% chance of air or puyos.
 */
export function randomPuyos(): Puyos {
  const puyos = emptyPuyos();
  for (let i = 0; i < NUM_SLICES; ++i) {
    puyos[i] = Math.random() * (FULL + 1);
  }
  return puyos;
}

/**
 * Clone a collection of puyos.
 * @param puyos A collection of puyos to copy.
 * @returns A copy of the puyos.
 */
export function clone(puyos: Puyos) {
  return new Uint32Array(puyos);
}

/**
 * Test if a collection of puyos is all air.
 * @param puyos A collection of puyos.
 * @returns `true` if there aren't any puyos present.
 */
export function isEmpty(puyos: Puyos) {
  return !(puyos[0] | puyos[1] | puyos[2]);
}

/**
 * Test if there is one or more puyos in the collection.
 * @param puyos A collection of puyos.
 * @returns `true` if there are puyos present.
 */
export function isNonEmpty(puyos: Puyos) {
  return !!(puyos[0] | puyos[1] | puyos[2]);
}

/**
 * Convert a boolean array to a collection of puyos
 * @param array An array indicating the presence of puyos.
 * @returns A collection of puyos.
 */
export function fromArray(array: boolean[]): Puyos {
  const puyos = emptyPuyos();
  for (let j = 0; j < NUM_SLICES; ++j) {
    for (let i = 0; i < WIDTH * SLICE_HEIGHT; ++i) {
      if (array[i + j * WIDTH * SLICE_HEIGHT]) {
        puyos[j] |= 1 << i;
      }
    }
  }
  return puyos;
}

export function toArray(puyos: Puyos): boolean[] {
  const result = [];
  for (let j = 0; j < NUM_SLICES; ++j) {
    for (let i = 0; i < WIDTH * SLICE_HEIGHT; ++i) {
      const p = 1 << i;
      if (puyos[j] & p) {
        result.push(true);
      } else {
        result.push(false);
      }
    }
  }
  return result;
}

export function toIndexArray(grid: Puyos[]): number[] {
  const result = [];
  for (let k = 0; k < NUM_SLICES; ++k) {
    for (let j = 0; j < WIDTH * SLICE_HEIGHT; ++j) {
      let index = -1;
      const p = 1 << j;
      for (let i = 0; i < grid.length; ++i) {
        if (grid[i][k] & p) {
          index = i;
          break;
        }
      }
      result.push(index);
    }
  }
  return result;
}

export function toFlagArray(grid: Puyos[]): number[] {
  const result = [];
  for (let k = 0; k < NUM_SLICES; ++k) {
    for (let j = 0; j < WIDTH * SLICE_HEIGHT; ++j) {
      let flags = 0;
      const p = 1 << j;
      for (let i = 0; i < grid.length; ++i) {
        if (grid[i][k] & p) {
          flags |= 1 << i;
        }
      }
      result.push(flags);
    }
  }
  return result;
}

/**
 * Produce lines of ASCII from the puyo collection using @ for puyos and . for empty space.
 */
export function puyoDisplayLines(puyos: Puyos): string[] {
  const result = ['┌─────────────┐'];
  for (let i = 0; i < NUM_SLICES; ++i) {
    for (let y = 0; y < SLICE_HEIGHT; ++y) {
      let line = '│';
      for (let x = 0; x < WIDTH; ++x) {
        if (puyos[i] & (1 << (x * H_SHIFT + y * V_SHIFT))) {
          line += ' @';
        } else {
          line += ' .';
        }
      }
      line += ' │';
      if (y === SLICE_HEIGHT - 1 && puyos[i] & INVALID) {
        line += '!';
      }
      result.push(line);
    }
  }
  result.push('└─────────────┘');
  return result;
}

/**
 * Render puyos of a single color in ASCII using @ for puyos and . for empty space.
 */
export function logPuyos(puyos: Puyos): void {
  console.log(puyoDisplayLines(puyos).join('\n'));
}

/**
 * Test if there is a puyo in the collection at the given coordinates.
 * @param puyos A collection of puyos.
 * @param x Horizontal coordinate. 0-indexed, left to right.
 * @param y Vertical coordinate. 0-indexed, top to bottom.
 * @returns `true` if there is a puyo at the given coordinates.
 */
export function puyoAt(puyos: Puyos, x: number, y: number) {
  const slice_y = y % SLICE_HEIGHT;
  y -= slice_y;
  return !!(puyos[y / SLICE_HEIGHT] & (1 << (x + slice_y * V_SHIFT)));
}

/**
 * Create a collection consisting of only a single puyo at the given coordinates.
 * @param x Horizontal coordinate. 0-indexed, left to right.
 * @param y Vertical coordinate. 0-indexed, top to bottom.
 * @returns A collection of a single puyo.
 */
export function singlePuyo(x: number, y: number): Puyos {
  const slice_y = y % SLICE_HEIGHT;
  y -= slice_y;
  const result = emptyPuyos();
  result[y / SLICE_HEIGHT] |= 1 << (x + slice_y * V_SHIFT);
  return result;
}

/**
 * Population count (aka hamming weight) function. Counts the number of set (i.e. 1-valued) bits in a 32-bit integer.
 * @param x 32-bit integer.
 * @returns The number of set bits in the input.
 */
function popcount(x: number) {
  x -= (x >> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
  x = (x + (x >> 4)) & 0x0f0f0f0f;
  x += x >> 8;
  x += x >> 16;

  return x & 0x7f;
}

/**
 * Perform a flood-fill of the source bitboard into the target. Modifies source in-place.
 * @param source Small bitboard pattern to expand.
 * @param target Bitboard pattern to constrain the expansion.
 */
export function flood(source: Puyos, target: Puyos) {
  source[0] &= target[0];
  source[1] &= target[1];
  source[2] &= target[2];

  if (!(source[0] | source[1] | source[2])) {
    return;
  }
  const temp = emptyPuyos();
  do {
    temp[0] = source[0];
    temp[1] = source[1];
    temp[2] = source[2];

    // Top slice
    source[0] |=
      (((source[0] & RIGHT_BLOCK) >> H_SHIFT) |
        ((source[0] << H_SHIFT) & RIGHT_BLOCK) |
        (source[0] << V_SHIFT) |
        (source[0] >> V_SHIFT) |
        ((source[1] & TOP) << TOP_TO_BOTTOM)) &
      target[0];

    // Middle slice
    source[1] |=
      (((source[1] & RIGHT_BLOCK) >> H_SHIFT) |
        ((source[1] << H_SHIFT) & RIGHT_BLOCK) |
        (source[1] << V_SHIFT) |
        (source[1] >> V_SHIFT) |
        ((source[0] & BOTTOM) >> TOP_TO_BOTTOM) |
        ((source[2] & TOP) << TOP_TO_BOTTOM)) &
      target[1];

    // Bottom slice
    source[2] |=
      (((source[2] & RIGHT_BLOCK) >> H_SHIFT) |
        ((source[2] << H_SHIFT) & RIGHT_BLOCK) |
        (source[2] << V_SHIFT) |
        (source[2] >> V_SHIFT) |
        ((source[1] & BOTTOM) >> TOP_TO_BOTTOM)) &
      target[2];
  } while (
    temp[0] !== source[0] ||
    temp[1] !== source[1] ||
    temp[2] !== source[2]
  );
}

/**
 * Add puyos from b to a, modifying a in place.
 * @param a Puyos to merge into.
 * @param b Puyos to merge.
 */
export function merge(a: Puyos, b: Puyos) {
  a[0] |= b[0];
  a[1] |= b[1];
  a[2] |= b[2];
}

export function getMask(grid: Puyos[]): Puyos {
  const result = clone(grid[0]);
  for (let i = 1; i < grid.length; ++i) {
    result[0] |= grid[i][0];
    result[1] |= grid[i][1];
    result[2] |= grid[i][2];
  }
  return result;
}

export function trimUnsupported(puyos: Puyos) {
  for (let i = 0; i < SLICE_HEIGHT - 1; ++i) {
    puyos[2] &= ~((FULL & ~puyos[2]) >> V_SHIFT);
  }

  puyos[1] &= ~((TOP & ~puyos[2]) << TOP_TO_BOTTOM);
  for (let i = 0; i < SLICE_HEIGHT - 1; ++i) {
    puyos[1] &= ~((FULL & ~puyos[1]) >> V_SHIFT);
  }

  puyos[0] &= ~((TOP & ~puyos[1]) << TOP_TO_BOTTOM);
  for (let i = 0; i < SLICE_HEIGHT - 1; ++i) {
    puyos[0] &= ~((FULL & ~puyos[0]) >> V_SHIFT);
  }

  return puyos;
}

export function invert(puyos: Puyos) {
  puyos[0] = ~puyos[0];
  puyos[1] = ~puyos[1];
  puyos[2] = ~puyos[2];
}

export function applyMask(puyos: Puyos, mask: Puyos) {
  puyos[0] &= mask[0];
  puyos[1] &= mask[1];
  puyos[2] &= mask[2];
}

export function inMask(puyos: Puyos, mask: Puyos) {
  const result = clone(puyos);
  applyMask(result, mask);
  return result;
}

export function applyXor(puyos: Puyos, diff: Puyos) {
  puyos[0] ^= diff[0];
  puyos[1] ^= diff[1];
  puyos[2] ^= diff[2];
}

/**
 * Apply linear gravity for one grid step.
 * @param grid An array of puyos to apply gravity to.
 * @returns `true` if anything happened.
 */
export function fallOne(grid: Puyos[]): boolean {
  const supported = getMask(grid);
  trimUnsupported(supported);

  // Change the name of the variable for clarity.
  const unsupported = supported;
  invert(unsupported);

  let didFall = false;

  grid.forEach(puyos => {
    const unsupported0 = puyos[0] & unsupported[0];
    const unsupported1 = puyos[1] & unsupported[1];
    const unsupported2 = puyos[2] & unsupported[2];

    didFall = didFall || !!(unsupported0 | unsupported1 | unsupported2);

    puyos[0] ^= unsupported0 ^ (FULL & (unsupported0 << V_SHIFT));
    puyos[1] ^=
      unsupported1 ^
      ((FULL & (unsupported1 << V_SHIFT)) |
        ((unsupported0 & BOTTOM) >> TOP_TO_BOTTOM));
    puyos[2] ^=
      unsupported2 ^
      ((unsupported2 << V_SHIFT) | ((unsupported1 & BOTTOM) >> TOP_TO_BOTTOM));
  });

  return didFall;
}

/**
 * Make puyos fall as far as they go.
 * @param grid An array of puyos to apply gravity to.
 * @returns `true` if anything happened.
 */
export function resolveGravity(grid: Puyos[]): boolean {
  const all = getMask(grid);

  let didSomething = false;
  let didFall = true;
  while (didFall) {
    let unsupported: number;

    unsupported = all[2] & ~((all[2] >> V_SHIFT) | BOTTOM);
    didFall = !!unsupported;
    all[2] ^= unsupported ^ (unsupported << V_SHIFT);
    grid.forEach(puyos => {
      const falling = puyos[2] & unsupported;
      puyos[2] ^= falling ^ (falling << V_SHIFT);
    });

    unsupported =
      all[1] & ~((all[1] >> V_SHIFT) | ((all[2] & TOP) << TOP_TO_BOTTOM));
    didFall = didFall || !!unsupported;
    all[2] |= (unsupported & BOTTOM) >> TOP_TO_BOTTOM;
    all[1] ^= unsupported ^ ((unsupported << V_SHIFT) & FULL);
    grid.forEach(puyos => {
      const falling = puyos[1] & unsupported;
      puyos[2] |= (falling & BOTTOM) >> TOP_TO_BOTTOM;
      puyos[1] ^= falling ^ ((falling << V_SHIFT) & FULL);
    });

    unsupported =
      all[0] & ~((all[0] >> V_SHIFT) | ((all[1] & TOP) << TOP_TO_BOTTOM));
    didFall = didFall || !!unsupported;
    all[1] |= (unsupported & BOTTOM) >> TOP_TO_BOTTOM;
    all[0] ^= unsupported ^ ((unsupported << V_SHIFT) & FULL);
    grid.forEach(puyos => {
      const falling = puyos[0] & unsupported;
      puyos[1] |= (falling & BOTTOM) >> TOP_TO_BOTTOM;
      puyos[0] ^= falling ^ ((falling << V_SHIFT) & FULL);
    });

    didSomething = didSomething || didFall;
  }
  return didSomething;
}

/**
 * Count the number of puyos in the collection.
 * @param puyos Collection of puyos to count.
 * @returns The number of puyos present.
 */
export function puyoCount(puyos: Puyos): number {
  return popcount(puyos[0]) + popcount(puyos[1]) + popcount(puyos[2]);
}

function getGroupBonus(group_size: number) {
  group_size -= CLEAR_THRESHOLD;
  if (group_size >= GROUP_BONUS.length) {
    group_size = GROUP_BONUS.length - 1;
  }
  return GROUP_BONUS[group_size];
}

export function sparkGroups(puyos: Puyos): ClearResult {
  let numCleared = 0;
  let groupBonus = 0;
  const sparks = emptyPuyos();
  const group = emptyPuyos();
  const temp = clone(puyos);
  temp[0] &= LIFE_BLOCK;
  // Clear from the bottom up hoping for an early exit.
  for (let i = NUM_SLICES - 1; i >= 0; i--) {
    // TODO: Don't iterate outside of life block
    for (let j = WIDTH * SLICE_HEIGHT - 2; j >= 0; j -= 2) {
      group[i] = 3 << j;
      flood(group, temp);
      applyXor(temp, group);
      const groupSize = puyoCount(group);
      if (groupSize >= CLEAR_THRESHOLD) {
        merge(sparks, group);
        groupBonus += getGroupBonus(groupSize);
        numCleared += groupSize;
      }
      if (isEmpty(temp)) {
        // TODO: full break
        break;
      }
    }
  }

  return {
    numCleared,
    groupBonus,
    sparks,
  };
}

export function sparkGarbage(garbage: Puyos, cleared: Puyos): Puyos {
  const eliminated = clone(garbage);

  eliminated[0] &=
    (((cleared[0] & RIGHT_BLOCK) >> H_SHIFT) |
      ((cleared[0] << H_SHIFT) & RIGHT_BLOCK) |
      (cleared[0] << V_SHIFT) |
      (cleared[0] >> V_SHIFT)) &
    SEMI_LIFE_BLOCK;

  eliminated[1] &=
    ((cleared[1] & RIGHT_BLOCK) >> H_SHIFT) |
    ((cleared[1] << H_SHIFT) & RIGHT_BLOCK) |
    (cleared[1] << V_SHIFT) |
    (cleared[1] >> V_SHIFT);

  eliminated[2] &=
    ((cleared[2] & RIGHT_BLOCK) >> H_SHIFT) |
    ((cleared[2] << H_SHIFT) & RIGHT_BLOCK) |
    (cleared[2] << V_SHIFT) |
    (cleared[2] >> V_SHIFT);

  return eliminated;
}

export function collides(testPuyos: Puyos, ...rest: Puyos[]) {
  for (let i = 0; i < rest.length; ++i) {
    if (
      testPuyos[0] & rest[i][0] ||
      testPuyos[1] & rest[i][1] ||
      testPuyos[2] & rest[i][2]
    ) {
      return true;
    }
  }
  return false;
}

export function vanishTop(puyos: Puyos) {
  puyos[0] &= SEMI_LIFE_BLOCK;
}

export function clear(puyos: Puyos) {
  puyos[0] = 0;
  puyos[1] = 0;
  puyos[2] = 0;
}

export function topLine(): Puyos {
  const result = emptyPuyos();
  result[0] = TOP;
  return result;
}

export function connections(puyos: Puyos): Puyos[] {
  const down = clone(puyos);
  down[0] &= LIFE_BLOCK;
  down[0] &= (down[0] >> V_SHIFT) | ((down[1] & TOP) << TOP_TO_BOTTOM);
  down[1] &= (down[1] >> V_SHIFT) | ((down[2] & TOP) << TOP_TO_BOTTOM);
  down[2] &= down[2] >> V_SHIFT;

  const up = clone(puyos);
  up[0] &= LIFE_BLOCK;
  up[2] &= (up[2] << V_SHIFT) | ((up[1] & BOTTOM) >> TOP_TO_BOTTOM);
  up[1] &= (up[1] << V_SHIFT) | ((up[0] & BOTTOM) >> TOP_TO_BOTTOM);
  up[0] &= up[0] << V_SHIFT;

  const right = clone(puyos);
  right[0] &= LIFE_BLOCK;
  right[0] &= (right[0] & RIGHT_BLOCK) >> H_SHIFT;
  right[1] &= (right[1] & RIGHT_BLOCK) >> H_SHIFT;
  right[2] &= (right[2] & RIGHT_BLOCK) >> H_SHIFT;

  const left = clone(puyos);
  left[0] &= LIFE_BLOCK;
  left[0] &= (left[0] << H_SHIFT) & RIGHT_BLOCK;
  left[1] &= (left[1] << H_SHIFT) & RIGHT_BLOCK;
  left[2] &= (left[2] << H_SHIFT) & RIGHT_BLOCK;

  return [down, up, right, left];
}
