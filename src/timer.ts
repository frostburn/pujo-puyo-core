export class FischerTimer {
  remaining: number;
  maximum: number;
  increment: number;
  reference: DOMHighResTimeStamp | null;

  constructor(initial = 60000, maximum = 120000, increment = 10000) {
    this.remaining = initial;
    this.maximum = maximum;
    this.increment = increment;
    this.reference = null;
  }

  toString() {
    const base = `${this.remaining / 1000}+${this.increment / 1000}`;
    if (this.maximum === Infinity) {
      return base;
    }
    return `${base}(max:${this.maximum / 1000})`;
  }

  static fromString(str: string) {
    const [initial, rest] = str.split('+');
    let increment: string;
    let maximum = 'Infinity';
    if (rest.includes('(')) {
      const parts = rest.split('(');
      increment = parts[0];
      maximum = parts[1].replace('max:', '').replace(')', '');
    } else {
      increment = rest;
    }
    return new FischerTimer(
      parseFloat(initial) * 1000,
      parseFloat(maximum) * 1000,
      parseFloat(increment) * 1000
    );
  }

  begin() {
    this.reference = performance.now();
  }

  end() {
    if (this.reference === null) {
      throw new Error('Must call begin before end');
    }
    const delta = performance.now() - this.reference;
    this.reference = null;
    if (delta > this.remaining) {
      return true;
    }
    this.remaining = Math.min(
      this.maximum,
      this.remaining - delta + this.increment
    );
    return false;
  }

  display(): string {
    const delta =
      this.reference === null ? 0 : performance.now() - this.reference;
    const remaining = Math.max(0, this.remaining - delta);
    let seconds = Math.round(remaining / 1000);
    const minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  flagged(): boolean {
    if (this.reference === null) {
      return this.remaining < 0;
    }
    const delta = performance.now() - this.reference;
    return delta > this.remaining;
  }
}
