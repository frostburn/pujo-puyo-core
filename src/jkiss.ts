/**
 * Pseudo-random number generator.
 * Adapted from "Good Practice in (Pseudo) Random Number Generation for Bioinformatics Applications" by David Jones.
 * The source code is hereby released to the public domain.
 */
export class JKISS32 {
  state: Uint32Array;

  constructor(seed?: number) {
    // The fifth value is reserved for temporary storage.
    this.state = new Uint32Array(5);

    if (seed === undefined) {
      this.state[0] = Math.random() * 4294967296;
      this.state[1] = Math.random() * 4294967296;
      this.state[2] = Math.random() * 4294967296;
      this.state[3] = Math.random() * 4294967296;
      if (this.state[1] === 0) {
        this.state[1] = 7;
      }
    } else {
      this.state[0] = seed;
      this.state[1] = seed * seed + 7;
      this.state[2] = this.state[1] * seed;
      this.state[3] = ((this.state[2] ^ (seed >> 11)) % 698769068) + 1;
      if (this.state[1] === 0) {
        this.state[1] = 11;
      }
      for (let i = 0; i < 7; ++i) {
        this.step();
      }
    }
  }

  step(): number {
    this.state[0] = 314527869 * this.state[0] + 1234567;
    this.state[1] ^= this.state[1] << 5;
    this.state[1] ^= this.state[1] >> 7;
    this.state[1] ^= this.state[1] << 22;
    // We don't have access to 64 bit integers so we utilize the 52-bit mantissa of double precision floats.
    const temp = 67107853 * this.state[2] + this.state[3];
    this.state[2] = temp;
    this.state[3] = temp / 67108864;

    // Clamp output to 32 bit range.
    this.state[4] = this.state[0] + this.state[1] + this.state[2];
    return this.state[4];
  }

  shuffle(array: any[]) {
    let entropy = 0;
    let juice = 4294967296;
    for (let i = array.length - 1; i > 0; i--) {
      if (juice >= 4294967296) {
        entropy = this.step();
        juice = 1;
      }
      const j = entropy % (i + 1);
      entropy = Math.floor(entropy / (i + 1));
      juice *= i + 1;
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
