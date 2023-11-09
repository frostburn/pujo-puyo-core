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
    const flagged = delta >= this.remaining;
    if (flagged) {
      this.remaining = 0;
    } else {
      this.remaining = Math.min(
        this.maximum,
        this.remaining - delta + this.increment
      );
    }
    return flagged;
  }

  timeRemaining() {
    if (this.reference === null) {
      return this.remaining;
    }
    const delta = performance.now() - this.reference;
    return this.remaining - delta;
  }

  display(digits = 0): string {
    const remaining = Math.max(0, this.timeRemaining());
    let seconds =
      Math.round(remaining * Math.pow(10, digits - 3)) * Math.pow(10, -digits);
    const minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;
    const secondsPlaces = digits ? digits + 3 : 2;
    return `${minutes}:${seconds.toFixed(digits).padStart(secondsPlaces, '0')}`;
  }

  flagged(): boolean {
    return this.timeRemaining() <= 0;
  }
}
