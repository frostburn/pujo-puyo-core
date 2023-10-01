// Puyos of a single color are represented as a bitboard consisting of six unsigned integers
// The width of the playing grid is fixed to 6
export type Puyos = Uint16Array;

// Bitboard constants
export const WIDTH = 6;
export const HEIGHT = 16;
// Bitboard patterns
const TOP = 1;
const BOTTOM = 32768;
const VISIBLE = 65520;
const SEMI_VISIBLE = 65528;
const TOPPING_LINE = 16;
// Large scale structure
export const NUM_SLICES = WIDTH;
export const VISIBLE_HEIGHT = 12;
export const GHOST_Y = 3;
export const BOTTOM_Y = 15;

// Rules
export const CLEAR_THRESHOLD = 4;
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
  return new Uint16Array(NUM_SLICES);
}

/**
 * Obtain a random collection of puyos.
 * @returns A screenful with 50% chance of air or puyos.
 */
export function randomPuyos(): Puyos {
  const puyos = emptyPuyos();
  for (let i = 0; i < NUM_SLICES; ++i) {
    puyos[i] = Math.random() * (1 << 16);
  }
  return puyos;
}

/**
 * Clone a collection of puyos.
 * @param puyos A collection of puyos to copy.
 * @returns A copy of the puyos.
 */
export function clone(puyos: Puyos): Puyos {
  return new Uint16Array(puyos);
}

/**
 * Test if a collection of puyos is all air.
 * @param puyos A collection of puyos.
 * @returns `true` if there aren't any puyos present.
 */
export function isEmpty(puyos: Puyos) {
  return !(puyos[0] | puyos[1] | puyos[2] | puyos[3] | puyos[4] | puyos[5]);
}

/**
 * Test if there is one or more puyos in the collection.
 * @param puyos A collection of puyos.
 * @returns `true` if there are puyos present.
 */
export function isNonEmpty(puyos: Puyos) {
  return !!(puyos[0] | puyos[1] | puyos[2] | puyos[3] | puyos[4] | puyos[5]);
}

/**
 * Convert a boolean array to a collection of puyos
 * @param array An array indicating the presence of puyos.
 * @returns A collection of puyos.
 */
export function fromArray(array: boolean[]): Puyos {
  const puyos = emptyPuyos();
  for (let y = 0; y < HEIGHT; ++y) {
    for (let x = 0; x < NUM_SLICES; ++x) {
      if (array[x + y * WIDTH]) {
        puyos[x] |= 1 << y;
      }
    }
  }
  return puyos;
}

export function toArray(puyos: Puyos): boolean[] {
  const result = [];
  for (let y = 0; y < HEIGHT; ++y) {
    const p = 1 << y;
    for (let x = 0; x < NUM_SLICES; ++x) {
      if (puyos[x] & p) {
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
  for (let y = 0; y < HEIGHT; ++y) {
    const p = 1 << y;
    for (let x = 0; x < NUM_SLICES; ++x) {
      let index = -1;
      for (let i = 0; i < grid.length; ++i) {
        if (grid[i][x] & p) {
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
  for (let y = 0; y < HEIGHT; ++y) {
    const p = 1 << y;
    for (let x = 0; x < NUM_SLICES; ++x) {
      let flags = 0;
      for (let i = 0; i < grid.length; ++i) {
        if (grid[i][x] & p) {
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
  for (let y = 0; y < HEIGHT; ++y) {
    let line = '│';
    for (let x = 0; x < NUM_SLICES; ++x) {
      if (puyos[x] & (1 << y)) {
        line += ' @';
      } else {
        line += ' .';
      }
    }
    line += ' │';
    result.push(line);
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
  return !!(puyos[x] & (1 << y));
}

/**
 * Create a collection consisting of only a single puyo at the given coordinates.
 * @param x Horizontal coordinate. 0-indexed, left to right.
 * @param y Vertical coordinate. 0-indexed, top to bottom.
 * @returns A collection of a single puyo.
 */
export function singlePuyo(x: number, y: number): Puyos {
  const result = emptyPuyos();
  result[x] = 1 << y;
  return result;
}

/**
 * Create a collection consisting of a single vertical line of puyos at the given coordinate.
 * @param y Vertical coordinate. 0-indexed, top to bottom.
 * @returns A vertical line of puyos.
 */
export function verticalLine(y: number): Puyos {
  const result = emptyPuyos();
  const p = 1 << y;
  for (let x = 0; x < NUM_SLICES; ++x) {
    result[x] = p;
  }
  return result;
}

/**
 * Population count (aka hamming weight) function. Counts the number of set (i.e. 1-valued) bits in a 32-bit integer.
 * @param x 32-bit integer.
 * @returns The number of set bits in the input.
 */
export function popcount(x: number) {
  x -= (x >> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
  x = (x + (x >> 4)) & 0x0f0f0f0f;
  x += x >> 8;
  x += x >> 16;

  return x & 0x7f;
}

/**
 * Population count (aka hamming weight) function. Counts the number of set (i.e. 1-valued) bits in a 16-bit integer.
 * @param x 16-bit integer.
 * @returns The number of set bits in the input.
 */
function popcount16(x: number) {
  x -= (x >> 1) & 0x5555;
  x = (x & 0x3333) + ((x >> 2) & 0x3333);
  x = (x + (x >> 4)) & 0x0f0f;
  return (x + (x >> 8)) & 0x1f;
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
  source[3] &= target[3];
  source[4] &= target[4];
  source[5] &= target[5];

  if (
    !(source[0] | source[1] | source[2] | source[3] | source[4] | source[5])
  ) {
    return;
  }
  const temp = emptyPuyos();
  do {
    temp[0] = source[0];
    temp[1] = source[1];
    temp[2] = source[2];
    temp[3] = source[3];
    temp[4] = source[4];
    temp[5] = source[5];

    source[0] |= (source[1] | (source[0] >> 1) | (source[0] << 1)) & target[0];
    source[1] |=
      (source[0] | (source[1] >> 1) | (source[1] << 1) | source[2]) & target[1];
    source[2] |=
      (source[1] | (source[2] >> 1) | (source[2] << 1) | source[3]) & target[2];
    source[3] |=
      (source[2] | (source[3] >> 1) | (source[3] << 1) | source[4]) & target[3];
    source[4] |=
      (source[3] | (source[4] >> 1) | (source[4] << 1) | source[5]) & target[4];
    source[5] |= (source[4] | (source[5] >> 1) | (source[5] << 1)) & target[5];
  } while (
    temp[0] !== source[0] ||
    temp[1] !== source[1] ||
    temp[2] !== source[2] ||
    temp[3] !== source[3] ||
    temp[4] !== source[4] ||
    temp[5] !== source[5]
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
  a[3] |= b[3];
  a[4] |= b[4];
  a[5] |= b[5];
}

export function getMask(grid: Puyos[]): Puyos {
  const result = clone(grid[0]);
  for (let i = 1; i < grid.length; ++i) {
    result[0] |= grid[i][0];
    result[1] |= grid[i][1];
    result[2] |= grid[i][2];
    result[3] |= grid[i][3];
    result[4] |= grid[i][4];
    result[5] |= grid[i][5];
  }
  return result;
}

export function trimUnsupported(puyos: Puyos) {
  for (let i = 0; i < HEIGHT - 1; ++i) {
    puyos[0] &= (puyos[0] >> 1) | BOTTOM;
    puyos[1] &= (puyos[1] >> 1) | BOTTOM;
    puyos[2] &= (puyos[2] >> 1) | BOTTOM;
    puyos[3] &= (puyos[3] >> 1) | BOTTOM;
    puyos[4] &= (puyos[4] >> 1) | BOTTOM;
    puyos[5] &= (puyos[5] >> 1) | BOTTOM;
  }
}

export function invert(puyos: Puyos) {
  puyos[0] = ~puyos[0];
  puyos[1] = ~puyos[1];
  puyos[2] = ~puyos[2];
  puyos[3] = ~puyos[3];
  puyos[4] = ~puyos[4];
  puyos[5] = ~puyos[5];
}

export function applyMask(puyos: Puyos, mask: Puyos) {
  puyos[0] &= mask[0];
  puyos[1] &= mask[1];
  puyos[2] &= mask[2];
  puyos[3] &= mask[3];
  puyos[4] &= mask[4];
  puyos[5] &= mask[5];
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
  puyos[3] ^= diff[3];
  puyos[4] ^= diff[4];
  puyos[5] ^= diff[5];
}

/**
 * Apply linear gravity for one grid step.
 * @param grid An array of puyos to apply gravity to.
 * @returns A mask of everything that fell.
 */
export function fallOne(grid: Puyos[]): Puyos {
  const mask = getMask(grid);

  const unsupported = clone(mask);
  trimUnsupported(unsupported);
  invert(unsupported);
  applyMask(unsupported, mask);

  grid.forEach(puyos => {
    for (let i = 0; i < NUM_SLICES; ++i) {
      const falling = puyos[i] & unsupported[i];
      puyos[i] ^= falling ^ (falling << 1);
    }
  });

  unsupported[0] <<= 1;
  unsupported[1] <<= 1;
  unsupported[2] <<= 1;
  unsupported[3] <<= 1;
  unsupported[4] <<= 1;
  unsupported[5] <<= 1;

  return unsupported;
}

/**
 * Make puyos fall as far as they go.
 * @param grid An array of puyos to apply gravity to.
 * @returns `true` if anything happened.
 */
export function resolveGravity(grid: Puyos[]): boolean {
  const all = getMask(grid);

  let did_something = false;
  for (let j = 0; j < NUM_SLICES; ++j) {
    let did_fall = true;
    while (did_fall) {
      did_fall = false;

      const unsupported = all[j] & ~((all[j] >> 1) | BOTTOM);
      did_fall = did_fall || !!unsupported;
      all[j] ^= unsupported ^ (unsupported << 1);
      for (let i = 0; i < grid.length; ++i) {
        const falling = grid[i][j] & unsupported;
        grid[i][j] ^= falling ^ (falling << 1);
      }
    }

    did_something = did_something || did_fall;
  }
  return did_something;
}

/**
 * Count the number of puyos in the collection.
 * @param puyos Collection of puyos to count.
 * @returns The number of puyos present.
 */
export function puyoCount(puyos: Puyos): number {
  return (
    popcount16(puyos[0]) +
    popcount16(puyos[1]) +
    popcount16(puyos[2]) +
    popcount16(puyos[3]) +
    popcount16(puyos[4]) +
    popcount16(puyos[5])
  );
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
  temp[0] &= VISIBLE;
  temp[1] &= VISIBLE;
  temp[2] &= VISIBLE;
  temp[3] &= VISIBLE;
  temp[4] &= VISIBLE;
  temp[5] &= VISIBLE;
  // Clear from the bottom up hoping for an early exit.
  // Only iterate within the visible grid.
  for (let y = BOTTOM_Y - 1; y > GHOST_Y; y -= 2) {
    for (let x = 0; x < NUM_SLICES; ++x) {
      group[x] = 3 << y;
      flood(group, temp);
      applyXor(temp, group);
      const groupSize = puyoCount(group);
      if (groupSize >= CLEAR_THRESHOLD) {
        merge(sparks, group);
        groupBonus += getGroupBonus(groupSize);
        numCleared += groupSize;
      }
      if (isEmpty(temp)) {
        return {
          numCleared,
          groupBonus,
          sparks,
        };
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

  eliminated[0] &= (cleared[0] << 1) | (cleared[0] >> 1) | cleared[1];
  eliminated[1] &=
    (cleared[1] << 1) | (cleared[1] >> 1) | cleared[0] | cleared[2];
  eliminated[2] &=
    (cleared[2] << 1) | (cleared[2] >> 1) | cleared[1] | cleared[3];
  eliminated[3] &=
    (cleared[3] << 1) | (cleared[3] >> 1) | cleared[2] | cleared[4];
  eliminated[4] &=
    (cleared[4] << 1) | (cleared[4] >> 1) | cleared[3] | cleared[5];
  eliminated[5] &= (cleared[5] << 1) | (cleared[5] >> 1) | cleared[4];

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
  puyos[0] &= SEMI_VISIBLE;
  puyos[1] &= SEMI_VISIBLE;
  puyos[2] &= SEMI_VISIBLE;
  puyos[3] &= SEMI_VISIBLE;
  puyos[4] &= SEMI_VISIBLE;
  puyos[5] &= SEMI_VISIBLE;
}

export function clear(puyos: Puyos) {
  puyos.fill(0);
}

export function topLine(): Puyos {
  return emptyPuyos().fill(TOP);
}

export function connections(puyos: Puyos): Puyos[] {
  const down = clone(puyos);
  down[0] &= (down[0] >> 1) & VISIBLE;
  down[1] &= (down[1] >> 1) & VISIBLE;
  down[2] &= (down[2] >> 1) & VISIBLE;
  down[3] &= (down[3] >> 1) & VISIBLE;
  down[4] &= (down[4] >> 1) & VISIBLE;
  down[5] &= (down[5] >> 1) & VISIBLE;

  const up = clone(puyos);
  up[0] &= (up[0] & VISIBLE) << 1;
  up[1] &= (up[1] & VISIBLE) << 1;
  up[2] &= (up[2] & VISIBLE) << 1;
  up[3] &= (up[3] & VISIBLE) << 1;
  up[4] &= (up[4] & VISIBLE) << 1;
  up[5] &= (up[5] & VISIBLE) << 1;

  const right = clone(puyos);
  right[0] &= puyos[1];
  right[1] &= puyos[2];
  right[2] &= puyos[3];
  right[3] &= puyos[4];
  right[4] &= puyos[5];
  right[5] = 0;

  const left = clone(puyos);
  left[0] = 0;
  left[1] &= puyos[0];
  left[2] &= puyos[1];
  left[3] &= puyos[2];
  left[4] &= puyos[3];
  left[5] &= puyos[4];

  return [down, up, right, left];
}

/**
 * Check if a mask of a grounded screen is locked out.
 * @param puyos Mask of all the puyos in a grounded screen.
 * @returns `true` if the game should be over.
 */
export function toppedUp(puyos: Puyos): boolean {
  return !!(
    puyos[0] &
    puyos[1] &
    puyos[2] &
    puyos[3] &
    puyos[4] &
    puyos[5] &
    TOPPING_LINE
  );
}

export function visible(puyos: Puyos): Puyos {
  const result = clone(puyos);
  result[0] &= VISIBLE;
  result[1] &= VISIBLE;
  result[2] &= VISIBLE;
  result[3] &= VISIBLE;
  result[4] &= VISIBLE;
  result[5] &= VISIBLE;
  return result;
}

export function shatter(puyos: Puyos): Puyos[] {
  const result = [];
  for (let y = 0; y < HEIGHT; ++y) {
    const p = 1 << y;
    for (let x = 0; x < NUM_SLICES; ++x) {
      if (puyos[x] & p) {
        const puyo = emptyPuyos();
        puyo[x] = p;
        result.push(puyo);
      }
    }
  }
  return result;
}

export function puyosEqual(a: Puyos, b: Puyos) {
  return (
    a[0] === b[0] &&
    a[1] === b[1] &&
    a[2] === b[2] &&
    a[3] === b[3] &&
    a[4] === b[4] &&
    a[5] === b[5]
  );
}
