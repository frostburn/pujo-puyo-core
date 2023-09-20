import {GHOST_Y, HEIGHT, WIDTH, isNonEmpty, puyoAt} from './bitboard';
import {JKISS32} from './jkiss';
import {
  NUM_PUYO_COLORS,
  PuyoScreen,
  ScreenState,
  SimplePuyoScreen,
  TickResult,
  colorOf,
} from './screen';

export type GameState = {
  screen: ScreenState;
  score: number;
  visibleBag: number[];
  pendingGarbage: number;
  lateGarbage: number;
  allClearBonus: boolean;
};

// TODO: Implement landing phase.
// Timings (gravity acts in units of one)
const SPARK_TIME = 35;

// Colors
const COLOR_SELECTION_SIZE = 4;
// Color distribution
const BAG_QUOTA_PER_COLOR = 4;
const BASE_BAG_SPICE = 3;
const EXTRA_BAG_SPICE = 7;

// Single player
const ALL_CLEAR_BONUS = 8500;

// Multiplayer
const TARGET_POINTS = 70;
const ONE_STONE = WIDTH * 5;
const ALL_CLEAR_GARBAGE = 30;
// TODO: Margin time

export class OnePlayerGame {
  score: number;
  sparkTime: number;
  active: boolean;
  jkiss: JKISS32;
  screen: PuyoScreen;
  colorSelection: number[];
  bag: number[];

  constructor(seed?: number, colorSelection?: number[]) {
    this.score = 0;
    this.sparkTime = 0;
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

  get busy(): boolean {
    return this.active || this.sparkTime > 0;
  }

  get state(): GameState {
    return {
      screen: this.screen.state,
      score: this.score,
      visibleBag: this.visibleBag,
      pendingGarbage: 0,
      lateGarbage: 0,
      allClearBonus: false,
    };
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
        this.jkiss.sample(
          this.colorSelection,
          BASE_BAG_SPICE + (this.jkiss.step() % EXTRA_BAG_SPICE)
        )
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

    // Play the move if possible, while making sure buffered garbage can still be generated.
    if (y1 > 0) {
      this.screen.insertPuyo(x1, y1, this.color1);
    }
    if (y2 > 0) {
      this.screen.insertPuyo(x2, y2, this.color2);
    }

    this.advanceColors();

    this.active = true;
  }

  tick(): TickResult {
    if (this.sparkTime <= 0 && (this.active || this.screen.bufferedGarbage)) {
      const tickResult = this.screen.tick();
      this.score += tickResult.score;
      this.active = tickResult.busy;
      if (this.screen.sparks.some(isNonEmpty)) {
        this.sparkTime = SPARK_TIME;
      }
      return tickResult;
    }
    const wasBusy = this.busy;
    this.sparkTime--;
    return {
      score: 0,
      chainNumber: this.screen.chainNumber,
      didClear: false,
      allClear: false,
      busy: wasBusy,
    };
  }

  get visibleBag() {
    return this.bag.slice(0, this.busy ? 4 : 6);
  }

  displayLines() {
    const lines = this.screen.displayLines();
    const i = this.busy ? [1, 0, 3, 2] : [3, 2, 5, 4];
    lines[0] += '┌──┐';
    lines[1] += `│${colorOf(this.bag[i[0]])}● \x1b[0m│`;
    lines[2] += `│${colorOf(this.bag[i[1]])}● \x1b[0m│`;
    lines[3] += '└┐ └┐';
    lines[4] += ` │${colorOf(this.bag[i[2]])}● \x1b[0m│`;
    lines[5] += ` │${colorOf(this.bag[i[3]])}● \x1b[0m│`;
    lines[6] += ' └──┘';
    lines.push(`Score: ${this.score}`);
    return lines;
  }

  /**
   * Render the game in the console.
   */
  log(): void {
    console.log(this.displayLines().join('\n'));
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

  get state(): GameState[] {
    const states = this.games.map(game => game.state);
    for (let i = 0; i < this.games.length; ++i) {
      states[i].pendingGarbage = this.pendingGarbage[i];
      states[i].lateGarbage = Math.max(
        0,
        this.accumulatedGarbage[1 - i] - this.accumulatedGarbage[i]
      );
      states[i].allClearBonus = this.allClearBonus[i];
    }
    return states;
  }

  displayLines() {
    const lines = this.games[0].displayLines();
    lines.push(
      `G: ${this.pendingGarbage[0]} ←  ${this.accumulatedGarbage[1]} `
    );
    const rightLines = this.games[1].displayLines();
    rightLines.push(
      `G: ${this.pendingGarbage[1]} ←  ${this.accumulatedGarbage[0]} `
    );
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
    console.log(this.displayLines().join('\n'));
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

        // Offset outgoing garbage.
        if (this.pendingGarbage[1 - i] >= this.accumulatedGarbage[1 - i]) {
          this.pendingGarbage[1 - i] -= this.accumulatedGarbage[1 - i];
          this.accumulatedGarbage[1 - i] = 0;
        } else {
          this.accumulatedGarbage[1 - i] -= this.pendingGarbage[1 - i];
          this.pendingGarbage[1 - i] = 0;
        }

        this.allClearBonus[i] = this.allClearQueued[i];
        this.allClearQueued[i] = false;
        this.canSend[i] = false;
      }
    }
    return tickResults;
  }

  toSimpleGame(player: number) {
    const opponent = 1 - player;
    let lateGarbage = this.accumulatedGarbage[opponent];
    let lateTimeRemaining = 0.5; // As far as I can figure out this value will always be overwritten when there's late garbage.
    if (this.games[opponent].busy) {
      const opponentScreen = this.games[opponent].screen.toSimpleScreen();
      const tickResult = opponentScreen.tick();
      lateGarbage += Math.floor(
        (tickResult.score + this.pointResidues[opponent]) / TARGET_POINTS
      );
      lateTimeRemaining =
        tickResult.chainNumber - this.games[opponent].screen.chainNumber;
    }
    return new SimpleGame(
      this.games[player].screen.toSimpleScreen(),
      this.pendingGarbage[player],
      lateGarbage,
      lateTimeRemaining,
      this.games[player].colorSelection,
      this.games[player].visibleBag
    );
  }
}

// All possible locations and orientations right below the garbage buffer line.
export const MOVES = [
  // Orientation = 0
  {x1: 0, y1: 2, x2: 0, y2: 1, orientation: 0},
  {x1: 1, y1: 2, x2: 1, y2: 1, orientation: 0},
  {x1: 2, y1: 2, x2: 2, y2: 1, orientation: 0},
  {x1: 3, y1: 2, x2: 3, y2: 1, orientation: 0},
  {x1: 4, y1: 2, x2: 4, y2: 1, orientation: 0},
  {x1: 5, y1: 2, x2: 5, y2: 1, orientation: 0},
  // Orientation = 1
  {x1: 1, y1: 1, x2: 0, y2: 1, orientation: 1},
  {x1: 2, y1: 1, x2: 1, y2: 1, orientation: 1},
  {x1: 3, y1: 1, x2: 2, y2: 1, orientation: 1},
  {x1: 4, y1: 1, x2: 3, y2: 1, orientation: 1},
  {x1: 5, y1: 1, x2: 4, y2: 1, orientation: 1},
  // Orientation = 2
  {x1: 0, y1: 1, x2: 0, y2: 2, orientation: 2},
  {x1: 1, y1: 1, x2: 1, y2: 2, orientation: 2},
  {x1: 2, y1: 1, x2: 2, y2: 2, orientation: 2},
  {x1: 3, y1: 1, x2: 3, y2: 2, orientation: 2},
  {x1: 4, y1: 1, x2: 4, y2: 2, orientation: 2},
  {x1: 5, y1: 1, x2: 5, y2: 2, orientation: 2},
  // Orientation = 3
  {x1: 0, y1: 1, x2: 1, y2: 1, orientation: 3},
  {x1: 1, y1: 1, x2: 2, y2: 1, orientation: 3},
  {x1: 2, y1: 1, x2: 3, y2: 1, orientation: 3},
  {x1: 3, y1: 1, x2: 4, y2: 1, orientation: 3},
  {x1: 4, y1: 1, x2: 5, y2: 1, orientation: 3},
];

// TODO: Improve late time calculation.
// How long a single move takes compared to one link in a chain.
const MOVE_TIME = 0.3;

// Value all-clears based on the amount of garbage they send.
const SIMPLE_ALL_CLEAR_BONUS = 2100;
// Not even a 19-chain can compensate a Game Over.
const SIMPLE_GAME_OVER = -1000000;

/**
 * Simplified view of one player in a multiplayer game suitable for naïve AI planning.
 */
export class SimpleGame {
  screen: SimplePuyoScreen;
  // Garbage to be received as soon as possible, one stone at a time.
  pendingGarbage: number;
  // Garbage to be received later.
  lateGarbage: number;
  lateTimeRemaining: number;

  colorSelection: number[];
  // The next four or six puyos to be played.
  bag: number[];

  constructor(
    screen: SimplePuyoScreen,
    pendingGarbage: number,
    lateGarbage: number,
    lateTimeRemaining: number,
    colorSelection: number[],
    bag: number[]
  ) {
    this.screen = screen;
    this.pendingGarbage = pendingGarbage;
    this.lateGarbage = lateGarbage;
    this.lateTimeRemaining = lateTimeRemaining;
    this.colorSelection = colorSelection;
    this.bag = bag;

    this.resolve();
  }

  get availableMoves() {
    const mask = this.screen.mask;
    const result: number[] = [];
    const symmetric = this.bag.length >= 2 && this.bag[0] === this.bag[1];
    MOVES.forEach((move, index) => {
      if (symmetric && index >= 11) {
        return;
      }
      const {x1, x2} = move;
      if (!puyoAt(mask, x1, GHOST_Y) || !puyoAt(mask, x2, GHOST_Y)) {
        result.push(index);
      }
    });
    return result;
  }

  playAndTick(move: number) {
    const color1 =
      this.bag.shift() ||
      this.colorSelection[
        Math.floor(Math.random() * this.colorSelection.length)
      ];
    const color2 =
      this.bag.shift() ||
      this.colorSelection[
        Math.floor(Math.random() * this.colorSelection.length)
      ];
    const {x1, y1, x2, y2} = MOVES[move];
    this.screen.insertPuyo(x1, y1, color1);
    this.screen.insertPuyo(x2, y2, color2);
    const releasedGarbage = Math.min(ONE_STONE, this.pendingGarbage);
    this.pendingGarbage -= releasedGarbage;
    this.screen.bufferedGarbage += releasedGarbage;
    const tickResult = this.resolve();
    return tickResult;
  }

  resolve() {
    const tickResult = this.screen.tick();
    this.lateTimeRemaining -= tickResult.chainNumber + MOVE_TIME;
    if (this.lateTimeRemaining <= 0) {
      this.pendingGarbage += this.lateGarbage;
      this.lateGarbage = 0;
    }
    if (tickResult.allClear) {
      tickResult.score += SIMPLE_ALL_CLEAR_BONUS;
    }
    if (!this.availableMoves.length) {
      tickResult.score += SIMPLE_GAME_OVER;
    }
    return tickResult;
  }

  clone() {
    return new SimpleGame(
      this.screen.toSimpleScreen(),
      this.pendingGarbage,
      this.lateGarbage,
      this.lateTimeRemaining,
      this.colorSelection,
      [...this.bag]
    );
  }
}
