import {HEIGHT, WIDTH, puyoAt} from './bitboard';
import {JKISS32} from './jkiss';
import {NUM_PUYO_COLORS, PuyoScreen, TickResult, colorOf} from './screen';

const COLOR_SELECTION_SIZE = 4;
const BAG_QUOTA_PER_COLOR = 4;
const BAG_SPICE = 8;

// Single player
const ALL_CLEAR_BONUS = 8500;

// Multiplayer
const TARGET_POINTS = 70;
const ONE_STONE = WIDTH * 5;
const ALL_CLEAR_GARBAGE = 30;
// TODO: Margin time

export class OnePlayerGame {
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

  tick(): TickResult {
    if (this.active || this.screen.bufferedGarbage) {
      const tickResult = this.screen.tick();
      this.score += tickResult.score;
      this.active = tickResult.busy;
      return tickResult;
    }
    return {
      score: 0,
      didClear: false,
      allClear: false,
      busy: false,
    };
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

export class SinglePlayerGame extends OnePlayerGame {
  tick(): TickResult {
    const tickResult = super.tick();
    this.score += tickResult.allClear ? ALL_CLEAR_BONUS : 0;
    return tickResult;
  }
}

const PADDING = [1, 1, 1, 0, 0, 0, 0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];

// TODO: True multiplayer
export class MultiplayerGame {
  games: OnePlayerGame[];
  // Buffered gargabe is sent on the next tick.
  // Stored on games[i].screen.bufferedGarbage.
  // Pending garbage is received after the next move. At most one stone at a time.
  pendingGarbage: number[];
  // These labels are sort of swapped.
  // Left accumulated garbage comes from the left screen to be sent to the right.
  accumulatedGarbage: number[];
  // Points left over from score -> garbage conversion.
  pointResidues: number[];
  // All clear bonus is commited on the next chain.
  allClearQueued: boolean[];
  allClearBonus: boolean[];
  // Garbage lock is needed so that all clear bonus can be commited even if the chain is too small to send other garbage.
  canSend: boolean[];

  constructor(seed?: number) {
    if (seed === undefined) {
      seed = Math.floor(Math.random() * 4294967296);
    }
    this.games = [new OnePlayerGame(seed), new OnePlayerGame(seed)];

    this.pendingGarbage = [0, 0];
    this.accumulatedGarbage = [0, 0];
    this.pointResidues = [0, 0];
    this.allClearQueued = [false, false];
    this.allClearBonus = [false, false];
    this.canSend = [false, false];
  }

  displayLines() {
    const lines = this.games[0].displayLines();
    const rightLines = this.games[1].displayLines();
    for (let i = 0; i < lines.length; ++i) {
      if (i < PADDING.length) {
        for (let j = 0; j < PADDING[i]; j++) {
          lines[i] += ' ';
        }
      } else {
        while (lines[i].length < 19) {
          lines[i] += ' ';
        }
      }
      lines[i] += rightLines[i];
    }
    return lines;
  }

  /**
   * Render the game in the console.
   */
  log(): void {
    this.displayLines().forEach(line => console.log(line));
  }

  play(player: number, x1: number, y1: number, orientation: number) {
    this.games[player].play(x1, y1, orientation);
    const releasedGarbage = Math.min(ONE_STONE, this.pendingGarbage[player]);
    this.games[player].screen.bufferedGarbage = releasedGarbage;
    this.pendingGarbage[player] -= releasedGarbage;
  }

  tick() {
    const tickResults = [];
    for (let i = 0; i < this.games.length; ++i) {
      const tickResult = this.games[i].tick();
      this.pointResidues[i] += tickResult.score;
      let generatedGarbage = Math.floor(this.pointResidues[i] / TARGET_POINTS);
      this.pointResidues[i] -= generatedGarbage * TARGET_POINTS;
      // Offset incoming garbage.
      if (this.pendingGarbage[i] >= generatedGarbage) {
        this.pendingGarbage[i] -= generatedGarbage;
        generatedGarbage = 0;
      } else {
        generatedGarbage -= this.pendingGarbage[i];
        this.pendingGarbage[i] = 0;
      }
      this.accumulatedGarbage[i] += generatedGarbage;

      this.allClearQueued[i] = this.allClearQueued[i] || tickResult.allClear;

      this.canSend[i] = this.canSend[i] || tickResult.didClear;

      tickResults.push(tickResult);
    }
    for (let i = 0; i < tickResults.length; ++i) {
      // Send accumulated garbage as soon as the chain is over.
      if (this.canSend[i] && !tickResults[i].busy) {
        // TODO: True multiplayer distribution.
        this.pendingGarbage[1 - i] += this.accumulatedGarbage[i];
        this.accumulatedGarbage[i] = 0;
        this.pendingGarbage[1 - i] += this.allClearBonus[i]
          ? ALL_CLEAR_GARBAGE
          : 0;
        this.allClearBonus[i] = this.allClearQueued[i];
        this.allClearQueued[i] = false;
        this.canSend[i] = false;
      }
    }
    return tickResults;
  }
}
