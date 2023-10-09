const TWO_POW_32 = 4294967296;

export function randomSeed() {
  return Math.floor(Math.random() * TWO_POW_32);
}

/**
 * Pseudo-random number generator.
 * Adapted from "Good Practice in (Pseudo) Random Number Generation for Bioinformatics Applications" by David Jones.
 * The source code is hereby released to the public domain.
 */
export class JKISS32 {
  state: Uint32Array;
  temp: Int32Array;

  constructor(seed?: number | Uint32Array) {
    this.temp = new Int32Array(1);

    if (seed === undefined) {
      this.state = new Uint32Array(5);
      this.state[0] = randomSeed();
      this.state[1] = randomSeed();
      this.state[2] = randomSeed();
      this.state[3] = randomSeed();
      this.state[4] = randomSeed() & 1;
      if (this.state[1] === 0) {
        this.state[1] = 7;
      }
    } else if (seed instanceof Uint32Array) {
      if (seed.length !== 5) {
        throw new Error('Requires state of size 5');
      }
      if (!seed[1]) {
        throw new Error('Second state element cannot be 0');
      }
      if (seed[4] > 1) {
        throw new Error('Fifth state element must be a bit');
      }
      this.state = new Uint32Array(seed);
    } else {
      this.state = new Uint32Array(5);
      this.state[0] = seed;

      this.state[1] = seed;
      this.state[1] = this.state[1] * seed + 7;
      if (this.state[1] === 0) {
        this.state[1] = 11;
      }

      this.state[2] = seed;
      this.state[2] *= seed;
      this.state[2] *= seed;

      this.state[3] = ((seed ^ (seed >> 11)) % 698769068) + 1;
      this.state[4] = seed & 1;

      for (let i = 0; i < 10; ++i) {
        this.step();
      }
    }
  }

  step(): number {
    this.state[0] += 1411392427;

    this.state[1] ^= this.state[1] << 5;
    this.state[1] ^= this.state[1] >>> 7;
    this.state[1] ^= this.state[1] << 22;

    this.temp[0] = this.state[2] + this.state[3] + this.state[4];
    this.state[2] = this.state[3];
    this.state[3] = this.temp[0] & 2147483647;

    // Clamp output to 32 bit range.
    this.state[4] = this.state[0] + this.state[1] + this.state[3];
    const result = this.state[4];

    this.state[4] = this.temp[0] < 0 ? 1 : 0;

    return result;
  }

  clone(): JKISS32 {
    return new JKISS32(this.state);
  }

  shuffle(array: any[]) {
    let entropy = 0;
    let juice = TWO_POW_32;
    for (let i = array.length - 1; i > 0; i--) {
      if (juice >= TWO_POW_32) {
        entropy = this.step();
        juice = 1;
      }
      const j = entropy % (i + 1);
      entropy = Math.floor(entropy / (i + 1));
      juice *= i + 1;
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  sample(array: any[], numSamples: number) {
    let entropy = 0;
    let juice = TWO_POW_32;
    const result = [];
    for (let i = 0; i < numSamples; ++i) {
      if (juice >= TWO_POW_32) {
        entropy = this.step();
        juice = 1;
      }
      const j = entropy % array.length;
      entropy = Math.floor(entropy / array.length);
      juice *= array.length;
      result.push(array[j]);
    }
    return result;
  }

  subset(array: any[], size: number) {
    const result = [...array];
    this.shuffle(result);
    return result.slice(-size);
  }
}
