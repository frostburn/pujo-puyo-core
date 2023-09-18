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

/**
 * Apply linear gravity for one grid step.
 * @param grid An array of puyos to apply gravity to.
 * @returns `true` if anything happened.
 */
export function fallOne(grid: Puyos[]): boolean {
  const supported = emptyPuyos();
  grid.forEach(puyos => merge(supported, puyos));

  for (let i = 0; i < SLICE_HEIGHT - 1; ++i) {
    supported[2] &= ~((FULL & ~supported[2]) >> V_SHIFT);
  }

  supported[1] &= ~((TOP & ~supported[2]) << TOP_TO_BOTTOM);
  for (let i = 0; i < SLICE_HEIGHT - 1; ++i) {
    supported[1] &= ~((FULL & ~supported[1]) >> V_SHIFT);
  }

  supported[0] &= ~((TOP & ~supported[1]) << TOP_TO_BOTTOM);
  for (let i = 0; i < SLICE_HEIGHT - 1; ++i) {
    supported[0] &= ~((FULL & ~supported[0]) >> V_SHIFT);
  }

  // TODO: Investigate if inverting the logic saves a few ops
  let didFall = false;

  grid.forEach(puyos => {
    const unsupported0 = puyos[0] & ~supported[0];
    const unsupported1 = puyos[1] & ~supported[1];
    const unsupported2 = puyos[2] & ~supported[2];

    didFall = didFall || !!(unsupported0 | unsupported1 | unsupported2);

    // TODO: Combine xors
    puyos[0] ^= unsupported0;
    puyos[0] ^= FULL & (unsupported0 << V_SHIFT);
    puyos[1] ^= unsupported1;
    puyos[1] ^=
      (FULL & (unsupported1 << V_SHIFT)) |
      ((unsupported0 & BOTTOM) >> TOP_TO_BOTTOM);
    puyos[2] ^= unsupported2;
    puyos[2] ^=
      (unsupported2 << V_SHIFT) | ((unsupported1 & BOTTOM) >> TOP_TO_BOTTOM);
  });

  return didFall;
}

/**
 * Make puyos fall as far as they go.
 * @param grid An array of puyos to apply gravity to.
 * @returns `true` if anything happened.
 */
export function resolveGravity(grid: Puyos[]): boolean {
  const all = emptyPuyos();
  grid.forEach(puyos => merge(all, puyos));

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

export type ClearResult = {
  numCleared: number;
  groupBonus: number;
  cleared: Puyos;
};

export function clearGroups(puyos: Puyos): ClearResult {
  let numCleared = 0;
  let groupBonus = 0;
  const cleared = emptyPuyos();
  const group = emptyPuyos();
  const temp = clone(puyos);
  temp[0] &= LIFE_BLOCK;
  // Clear from the bottom up hoping for an early exit.
  for (let i = NUM_SLICES - 1; i >= 0; i--) {
    // TODO: Don't iterate outside of life block
    for (let j = WIDTH * SLICE_HEIGHT - 2; j >= 0; j -= 2) {
      group[i] = 3 << j;
      flood(group, temp);
      temp[0] ^= group[0];
      temp[1] ^= group[1];
      temp[2] ^= group[2];
      const groupSize = puyoCount(group);
      if (groupSize >= CLEAR_THRESHOLD) {
        merge(cleared, group);
        groupBonus += getGroupBonus(groupSize);
        numCleared += groupSize;
      }
      if (isEmpty(temp)) {
        // TODO: full break
        break;
      }
    }
  }

  puyos[0] ^= cleared[0];
  puyos[1] ^= cleared[1];
  puyos[2] ^= cleared[2];

  return {
    numCleared,
    groupBonus,
    cleared,
  };
}

export function clearGarbage(garbage: Puyos, cleared: Puyos): Puyos {
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

  garbage[0] ^= eliminated[0];
  garbage[1] ^= eliminated[1];
  garbage[2] ^= eliminated[2];

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
