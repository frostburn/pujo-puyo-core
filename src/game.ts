import {HEIGHT, WIDTH, puyoAt} from './bitboard';
import {JKISS32} from './jkiss';
import {NUM_PUYO_COLORS, PuyoScreen, colorOf} from './screen';

const COLOR_SELECTION_SIZE = 4;
const BAG_QUOTA_PER_COLOR = 4;
const BAG_SPICE = 8;

const ALL_CLEAR_BONUS = 8500;

export class SinglePlayerGame {
  score: number;
  active: boolean;
  jkiss: JKISS32;
  screen: PuyoScreen;
  colorSelection: number[];
  bag: number[];

  constructor(seed?: number, colorSelection?: number[]) {
    this.score = 0;
    this.active = false;
    this.jkiss = new JKISS32(seed);
    this.screen = new PuyoScreen(this.jkiss.step());

    if (colorSelection === undefined) {
      this.colorSelection = this.jkiss.subset(
        [...Array(NUM_PUYO_COLORS).keys()],
        COLOR_SELECTION_SIZE
      );
    } else {
      this.colorSelection = colorSelection;
    }

    this.bag = [];
    this.advanceColors();
  }

  advanceColors() {
    this.bag.shift();
    this.bag.shift();
    // Make sure that there are at least two puyos in the hand and four in the preview.
    while (this.bag.length < 6) {
      // Bag implementation prevents extreme droughts.
      // Spice prevents cheesy "all clear" shenanigans.
      let freshBag = [];
      for (let j = 0; j < this.colorSelection.length; ++j) {
        for (let i = 0; i < BAG_QUOTA_PER_COLOR; ++i) {
          freshBag.push(this.colorSelection[j]);
        }
      }
      freshBag = freshBag.concat(
        this.jkiss.sample(this.colorSelection, BAG_SPICE)
      );
      this.jkiss.shuffle(freshBag);
      this.bag = this.bag.concat(freshBag);
    }
  }

  get color1() {
    return this.bag[0];
  }

  get color2() {
    return this.bag[1];
  }

  play(x1: number, y1: number, orientation: number) {
    let x2 = x1;
    let y2 = y1;
    orientation &= 3; // Wrap to 0, 1, 2 or 3.
    if (orientation === 0) {
      y2--;
    } else if (orientation === 1) {
      x2--;
    } else if (orientation === 2) {
      y2++;
    } else if (orientation === 3) {
      x2++;
    }
    // Kick the move to be inside the grid.
    while (x1 < 0 || x2 < 0) {
      x1++;
      x2++;
    }
    while (x1 >= WIDTH || x2 >= WIDTH) {
      x1--;
      x2--;
    }
    while (y1 < 0 || y2 < 0) {
      y1++;
      y2++;
    }
    while (y1 >= HEIGHT || y2 >= HEIGHT) {
      y1--;
      y2--;
    }

    // Kick the puyos up untill they fit.
    const mask = this.screen.mask;
    while (puyoAt(mask, x1, y1) || puyoAt(mask, x2, y2)) {
      y1--;
      y2--;
    }

    // Play the move.
    this.screen.insertPuyo(x1, y1, this.color1);
    this.screen.insertPuyo(x2, y2, this.color2);

    this.advanceColors();

    this.active = true;
  }

  tick(pendingGarbage = 0) {
    if (this.active || pendingGarbage) {
      const tickResult = this.screen.tick(pendingGarbage);
      this.score += tickResult.score;
      this.score += tickResult.allClear ? ALL_CLEAR_BONUS : 0;
      this.active = tickResult.busy;
      return tickResult.busy;
    }
    return false;
  }

  displayLines() {
    const lines = this.screen.displayLines();
    lines[0] += '┌──┐';
    lines[1] += `│${colorOf(this.bag[3])}● \x1b[0m│`;
    lines[2] += `│${colorOf(this.bag[2])}● \x1b[0m│`;
    lines[3] += '└┐ └┐';
    lines[4] += ` │${colorOf(this.bag[5])}● \x1b[0m│`;
    lines[5] += ` │${colorOf(this.bag[4])}● \x1b[0m│`;
    lines[6] += ' └──┘';
    lines.push(`Score: ${this.score}`);
    return lines;
  }

  /**
   * Render the game in the console.
   */
  log(): void {
    this.displayLines().forEach(line => console.log(line));
  }
}
