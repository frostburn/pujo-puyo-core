// Puyos of a single color are represented as a bitboard consisting of three unsigned integers
// The width of the playing grid is fixed to 6
export type Puyos = Uint32Array;

// Bitboard constants
const WIDTH = 6;
const SLICE_HEIGHT = 5;
const H_SHIFT = 1;
const V_SHIFT = 6;
const TOP_TO_BOTTOM = (V_SHIFT * (SLICE_HEIGHT - 1));
// Bitboard patterns
const TOP = (1 << WIDTH) - 1;
const BOTTOM = TOP << ((SLICE_HEIGHT - 1) * V_SHIFT);
const FULL = TOP | (TOP << V_SHIFT) | (TOP << (V_SHIFT * 2)) | (TOP << (V_SHIFT * 3)) | BOTTOM;
const LEFT_WALL = 1 | (1 << V_SHIFT) | (1 << (V_SHIFT * 2)) | (1 << (V_SHIFT * 3)) | (1 << (V_SHIFT * 4));
const RIGHT_BLOCK = FULL ^ LEFT_WALL;
const INVALID = (-1) ^ FULL;
// Large scale structure
export const NUM_SLICES = 3;

export function emptyPuyos(): Puyos {
  return new Uint32Array(NUM_SLICES);
}

export function randomPuyos(): Puyos {
  const puyos = emptyPuyos();
  for (let i = 0; i < NUM_SLICES; ++i) {
    puyos[i] = Math.random() * (FULL + 1);
  }
  return puyos;
}

export function isEmpty(puyos: Puyos) {
  return !puyos[0] && !puyos[1] && !puyos[2];
}

/**
 * Render puyos of a single color in ASCII using @ for puyos and . for empty space.
 */
export function logPuyos(puyos: Puyos): void {
  console.log("┌─────────────┐");
  for (let i = 0; i < NUM_SLICES; ++i) {
    for (let y = 0; y < SLICE_HEIGHT; ++y) {
      let line = "│";
      for (let x = 0; x < WIDTH; ++x) {
        if (puyos[i] & (1 << (x * H_SHIFT + y * V_SHIFT))) {
          line += " @";
        } else {
          line += " .";
        }
      }
      line += " │";
      if (y == (SLICE_HEIGHT - 1) && (puyos[i] & INVALID)) {
        line += "!";
      }
      console.log(line);
    }
  }
  console.log("└─────────────┘");
}

/**
 * Population count (aka hamming weight) function. Counts the number of set (i.e. 1-valued) bits in a 32-bit integer.
 * @param x 32-bit integer.
 * @returns The number of set bits in the input.
 */
function popcount (x: number) {
  x -= x >> 1 & 0x55555555
  x = (x & 0x33333333) + (x >> 2 & 0x33333333)
  x = x + (x >> 4) & 0x0f0f0f0f
  x += x >> 8
  x += x >> 16

  return x & 0x7f
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

  if (!(source[0] || source[1] || source[2])) {
      return;
  }
  const temp = emptyPuyos();
  do {
      temp[0] = source[0];
      temp[1] = source[1];
      temp[2] = source[2];

      // Top slice
      source[0] |= (
          ((source[0] & RIGHT_BLOCK) >> H_SHIFT) |
          ((source[0] << H_SHIFT) & RIGHT_BLOCK) |
          (source[0] << V_SHIFT) |
          (source[0] >> V_SHIFT) |
          ((source[1] & TOP) << TOP_TO_BOTTOM)
      ) & target[0];

      // Middle slice
      source[1] |= (
          ((source[1] & RIGHT_BLOCK) >> H_SHIFT) |
          ((source[1] << H_SHIFT) & RIGHT_BLOCK) |
          (source[1] << V_SHIFT) |
          (source[1] >> V_SHIFT) |
          ((source[0] & BOTTOM) >> TOP_TO_BOTTOM) |
          ((source[2] & TOP) << TOP_TO_BOTTOM)
      ) & target[1];

      // Bottom slice
      source[2] |= (
        ((source[2] & RIGHT_BLOCK) >> H_SHIFT) |
        ((source[2] << H_SHIFT) & RIGHT_BLOCK) |
        (source[2] << V_SHIFT) |
        (source[2] >> V_SHIFT) |
        ((source[1] & BOTTOM) >> TOP_TO_BOTTOM)
      ) & target[2];
  } while (temp[0] != source[0] || temp[1] != source[1] || temp[2] != source[2]);
}

/**
 * Add puyos from b to a, modifying a in place.
 * @param a Puyos to merge into.
 * @param b Puyos to merge.
 */
function merge(a: Puyos, b: Puyos) {
  a[0] |= b[0];
  a[1] |= b[1];
  a[2] |= b[2];
}

/**
 * Apply linear gravity for one grid step.
 * @param grid An array of puyos to apply gravity to.
 */
export function fallOne(grid: Puyos[]): void {
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

  grid.forEach(puyos => {
    const unsupported0 = puyos[0] & ~supported[0];
    const unsupported1 = puyos[1] & ~supported[1];
    const unsupported2 = puyos[2] & ~supported[2];
    puyos[0] ^= unsupported0;
    puyos[0] ^= FULL & (unsupported0 << V_SHIFT);
    puyos[1] ^= unsupported1;
    puyos[1] ^= (FULL & (unsupported1 << V_SHIFT)) | ((unsupported0 & BOTTOM) >> TOP_TO_BOTTOM);
    puyos[2] ^= unsupported2;
    puyos[2] ^= (unsupported2 << V_SHIFT) | ((unsupported1 & BOTTOM) >> TOP_TO_BOTTOM);
  });
}
