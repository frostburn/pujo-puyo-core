import {GHOST_Y, HEIGHT, Puyos, WIDTH, isNonEmpty, puyoAt} from './bitboard';
import {JKISS32, randomSeed} from './jkiss';
import {
  AIR,
  GARBAGE,
  NUM_PUYO_COLORS,
  PuyoScreen,
  ScreenRules,
  ScreenState,
  SimplePuyoScreen,
  TickResult,
  YELLOW,
  colorOf,
} from './screen';

export interface GameRules extends ScreenRules {
  jiggleFrames: number; // How long puyos "jiggle" after landing
  sparkFrames: number; // How long puyos "spark" when cleared
  marginFrames: number; // How long until sent garbage starts getting multiplied
  mercyFrames: number; // How long until garbage is forced on a passive opponent
  targetPoints: number[]; // Conversion factor from scored points to nuisance puyos generated
}

export type OnePlayerParams = {
  bagSeed: number | Uint32Array | null;
  garbageSeed: number | Uint32Array;
  colorSelection: number[];
  initialBag: number[];
  rules: GameRules;
};

export type MultiplayerParams = {
  bagSeeds: (number | Uint32Array)[] | null;
  garbageSeeds: (number | Uint32Array)[];
  colorSelections: number[][];
  initialBags: number[][];
  rules: GameRules;
};

export type GameState = {
  screen: ScreenState;
  age: number;
  score: number;
  hand: number[];
  preview: number[];
  pendingGarbage: number;
  lateGarbage: number;
  allClearBonus: boolean;
  busy: boolean;
  lockedOut: boolean;
};

export type PlayedMove = {
  player: number;
  time: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  orientation: number;
};

export interface MultiplayerTickResult extends TickResult {
  player: number;
  time: number;
}

// Timings and rules (gravity acts in units of one)
export const NOMINAL_FRAME_RATE = 30;
export const DEFAULT_JIGGLE_FRAMES = 15;
export const DEFAULT_SPARK_FRAMES = 20;
export const DEFAULT_CLEAR_THRESHOLD = 4;

// Colors
export const DEFAULT_NUM_COLORS = 4;
// Color distribution
const BAG_QUOTA_PER_COLOR = 4;
const BASE_BAG_SPICE = 3;
const EXTRA_BAG_SPICE = 7;

// Single player
const ALL_CLEAR_BONUS = 8500;

// Multiplayer
export const DEFAULT_MARGIN_FRAMES = 192 * NOMINAL_FRAME_RATE;
const MARGIN_MULTIPLIER = 0.75;
const MARGIN_INTERVAL = 16 * NOMINAL_FRAME_RATE;
export const DEFAULT_TARGET_POINTS = 70;
export const DEFAULT_MERCY_FRAMES = 15 * NOMINAL_FRAME_RATE;
const FORCE_RELEASE = -100;
const ONE_ROCK = WIDTH * 5;
const ALL_CLEAR_GARBAGE = 30;

export function defaultRules(): GameRules {
  return {
    clearThreshold: DEFAULT_CLEAR_THRESHOLD,
    jiggleFrames: DEFAULT_JIGGLE_FRAMES,
    sparkFrames: DEFAULT_SPARK_FRAMES,
    marginFrames: DEFAULT_MARGIN_FRAMES,
    mercyFrames: DEFAULT_MERCY_FRAMES,
    targetPoints: [DEFAULT_TARGET_POINTS, DEFAULT_TARGET_POINTS],
  };
}

export function randomColorSelection(size = DEFAULT_NUM_COLORS): number[] {
  if (size < 0) {
    throw new Error('Negative size');
  } else if (size > NUM_PUYO_COLORS) {
    throw new Error(`Maximum size is ${NUM_PUYO_COLORS}`);
  }
  const result = new Set<number>();
  while (result.size < size) {
    result.add(Math.floor(Math.random() * NUM_PUYO_COLORS));
  }
  return [...result];
}

export function randomBag(colorSelection: number[], jkiss?: JKISS32): number[] {
  // Bag implementation prevents extreme droughts.
  let result = [];
  for (let j = 0; j < colorSelection.length; ++j) {
    for (let i = 0; i < BAG_QUOTA_PER_COLOR; ++i) {
      result.push(colorSelection[j]);
    }
  }

  // Spice prevents cheesy "all clear" shenanigans.
  if (jkiss === undefined) {
    const spiceAmount =
      BASE_BAG_SPICE + Math.floor(Math.random() * EXTRA_BAG_SPICE);
    for (let i = 0; i < spiceAmount; ++i) {
      result.push(
        colorSelection[Math.floor(Math.random() * colorSelection.length)]
      );
    }
  } else {
    result = result.concat(
      jkiss.sample(
        colorSelection,
        BASE_BAG_SPICE + (jkiss.step() % EXTRA_BAG_SPICE)
      )
    );
  }

  // Shake it!
  if (jkiss === undefined) {
    result.sort(() => Math.random() - 0.5);
  } else {
    jkiss.shuffle(result);
  }
  return result;
}

export interface ReplayParams extends MultiplayerParams {
  bagSeeds: number[];
  garbageSeeds: number[];
}

export function randomSinglePlayer(): OnePlayerParams {
  return {
    bagSeed: randomSeed(),
    garbageSeed: randomSeed(),
    colorSelection: randomColorSelection(),
    initialBag: [],
    rules: defaultRules(),
  };
}

export function randomMultiplayer(): ReplayParams {
  const colorSelection = randomColorSelection();
  const initialBag = randomBag(colorSelection);
  return {
    bagSeeds: [randomSeed(), randomSeed()],
    garbageSeeds: [randomSeed(), randomSeed()],
    colorSelections: [colorSelection, colorSelection],
    initialBags: [initialBag, initialBag],
    rules: defaultRules(),
  };
}

export function seededMultiplayer(seed: number): ReplayParams {
  const jkiss = new JKISS32(seed);
  const colorSelection = jkiss.subset(
    [...Array(NUM_PUYO_COLORS).keys()],
    DEFAULT_NUM_COLORS
  );
  const initialBag = randomBag(colorSelection, jkiss);
  return {
    bagSeeds: [jkiss.step(), jkiss.step()],
    garbageSeeds: [jkiss.step(), jkiss.step()],
    colorSelections: [colorSelection, colorSelection],
    initialBags: [initialBag, initialBag],
    rules: defaultRules(),
  };
}

export class OnePlayerGame {
  age: number;
  score: number;
  jiggleTime: number;
  sparkTime: number;
  active: boolean;
  jkiss: JKISS32 | null;
  screen: PuyoScreen;
  colorSelection: number[];
  bag: number[];
  lockedOut: boolean;
  hardDropLanded: boolean;
  consecutiveRerolls: number;
  rules: GameRules;

  constructor(params: OnePlayerParams) {
    this.age = 0;
    this.score = 0;
    this.jiggleTime = 0;
    this.sparkTime = 0;
    this.active = false;
    if (params.bagSeed === null) {
      this.jkiss = null;
    } else {
      this.jkiss = new JKISS32(params.bagSeed);
    }
    this.screen = new PuyoScreen(params.garbageSeed, params.rules);
    this.colorSelection = [...params.colorSelection];

    this.bag = [...params.initialBag];
    if (this.bag.length < 6) {
      this.bag.unshift(-1);
      this.bag.unshift(-1);
      this.advanceColors();
    }
    this.lockedOut = false;
    this.hardDropLanded = false;
    this.consecutiveRerolls = 0;
    this.rules = params.rules;
  }

  get busy(): boolean {
    return this.active || this.sparkTime > 0 || this.jiggleTime > 0;
  }

  get state(): GameState {
    return {
      screen: this.screen.state,
      age: this.age,
      score: this.score,
      hand: this.hand,
      preview: this.preview,
      pendingGarbage: 0,
      lateGarbage: 0,
      allClearBonus: false,
      busy: this.busy,
      lockedOut: this.lockedOut,
    };
  }

  advanceColors() {
    this.bag.shift();
    this.bag.shift();
    if (this.jkiss === null) {
      return;
    }
    // Make sure that there are at least two puyos in the hand and four in the preview.
    while (this.bag.length < 6) {
      // Bag implementation prevents extreme droughts.
      // Spice prevents cheesy "all clear" shenanigans.
      const freshBag = randomBag(this.colorSelection, this.jkiss);
      this.bag = this.bag.concat(freshBag);
    }
  }

  get color1() {
    return this.bag[0];
  }

  get color2() {
    return this.bag[1];
  }

  isReroll(x1: number, orientation: number, mask?: Puyos) {
    orientation &= 3;
    let x2 = x1;
    if (orientation === 1) {
      x2--;
    } else if (orientation === 3) {
      x2++;
    }
    if (mask === undefined) {
      mask = this.screen.mask;
    }
    return puyoAt(mask, x1, GHOST_Y) && puyoAt(mask, x2, GHOST_Y);
  }

  play(
    x1: number,
    y1: number,
    orientation: number,
    hardDrop = false
  ): PlayedMove {
    if (this.bag.length < 2) {
      throw new Error('Out of bag');
    }
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
    while (y1 <= 0 || y2 <= 0) {
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

    if (hardDrop) {
      while (
        y1 < HEIGHT - 1 &&
        y2 < HEIGHT - 1 &&
        !puyoAt(mask, x1, y1 + 1) &&
        !puyoAt(mask, x2, y2 + 1)
      ) {
        y1++;
        y2++;
      }
    }

    this.hardDropLanded =
      y1 === HEIGHT - 1 ||
      puyoAt(mask, x1, y1 + 1) ||
      y2 === HEIGHT - 1 ||
      puyoAt(mask, x2, y2 + 1);

    if (this.isReroll(x1, orientation, mask)) {
      this.consecutiveRerolls++;
    } else {
      this.consecutiveRerolls = 0;
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

    return {player: 0, time: this.age, x1, y1, x2, y2, orientation};
  }

  tick(): TickResult {
    this.age++;
    if (
      this.jiggleTime <= 0 &&
      this.sparkTime <= 0 &&
      (this.active || this.screen.bufferedGarbage)
    ) {
      const tickResult = this.screen.tick();
      this.score += tickResult.score;
      this.active = tickResult.busy;
      if (tickResult.didJiggle) {
        this.jiggleTime = this.rules.jiggleFrames;
      } else if (isNonEmpty(this.screen.sparks)) {
        this.sparkTime = this.rules.sparkFrames;
      }
      if (tickResult.lockedOut) {
        this.lockedOut = true;
      }
      if (this.lockedOut) {
        tickResult.lockedOut = true;
      }
      if (this.hardDropLanded) {
        tickResult.coloredLanded = true;
        this.hardDropLanded = false;
      }
      return tickResult;
    }
    const wasBusy = this.busy;
    this.jiggleTime--;
    this.sparkTime--;
    return {
      score: 0,
      colors: [],
      chainNumber: this.screen.chainNumber,
      didJiggle: false,
      didClear: false,
      didFall: false,
      coloredLanded: false,
      garbageLanded: false,
      allClear: false,
      busy: wasBusy,
      lockedOut: this.lockedOut,
    };
  }

  get visibleBag() {
    return this.bag.slice(0, this.busy ? 4 : 6);
  }
  get hand() {
    return this.busy ? [] : this.bag.slice(0, 2);
  }
  get preview() {
    return this.busy ? this.bag.slice(0, 4) : this.bag.slice(2, 6);
  }

  // Mirror driving utils
  get initialBag() {
    return this.bag.slice(0, 4);
  }
  get nextPiece() {
    if (this.busy) {
      throw new Error('Attempting to peek beyond the visible bag');
    }
    return this.bag.slice(4, 6);
  }

  displayLines() {
    const lines = this.screen.displayLines();
    const i = this.busy ? [1, 0, 3, 2] : [3, 2, 5, 4];
    lines[0] += '┌──┐';
    lines[1] += `│${colorOf(this.bag[i[0]])}● ${colorOf(AIR)}│`;
    lines[2] += `│${colorOf(this.bag[i[1]])}● ${colorOf(AIR)}│`;
    lines[3] += '└┐ └┐';
    lines[4] += ` │${colorOf(this.bag[i[2]])}● ${colorOf(AIR)}│`;
    lines[5] += ` │${colorOf(this.bag[i[3]])}● ${colorOf(AIR)}│`;
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

  clone() {
    const result = new (this.constructor as new (
      params: OnePlayerParams
    ) => this)({
      bagSeed: this.jkiss === null ? null : this.jkiss?.state,
      garbageSeed: this.screen.jkiss.state,
      colorSelection: this.colorSelection,
      initialBag: this.bag,
      rules: this.rules,
    });
    result.age = this.age;
    result.score = this.score;
    result.jiggleTime = this.jiggleTime;
    result.sparkTime = this.sparkTime;
    result.active = this.active;
    result.screen = this.screen.clone();
    result.lockedOut = this.lockedOut;
    result.hardDropLanded = this.hardDropLanded;
    result.consecutiveRerolls = this.consecutiveRerolls;
    return result;
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

export class MultiplayerGame {
  games: OnePlayerGame[];
  // Buffered gargabe is sent on the next tick.
  // Stored on games[i].screen.bufferedGarbage.

  // Pending garbage is received after the next move. At most one rock at a time.
  pendingGarbage: number[];
  // These labels are sort of swapped.
  // Left accumulated garbage comes from the left screen to be sent to the right.
  accumulatedGarbage: number[];
  // Points left over from score -> garbage conversion.
  pointResidues: number[];
  // All clear bonus is commited on the next chain.
  allClearQueued: boolean[];
  allClearBonus: boolean[];
  // Outgoing garbage lock is needed so that all clear bonus can be commited even if the chain is too small to send other garbage.
  canSend: boolean[];
  // Countdown until pending garbage is forced onto the screen.
  // A special value doubles as incoming garbage lock which is needed so that chains have time time to resolve and make room for the nuisance puyos.
  mercyRemaining: number[];
  // Copy of target points from the rules that may be modified after margin time has elapsed
  targetPoints: number[];
  // Most of the rules / mechanics are customizable
  rules: GameRules;

  constructor(params: MultiplayerParams) {
    const numPlayers = params.garbageSeeds.length;
    this.games = [];
    for (let i = 0; i < numPlayers; ++i) {
      const playerParams: OnePlayerParams = {
        bagSeed: params.bagSeeds === null ? null : params.bagSeeds[i],
        garbageSeed: params.garbageSeeds[i],
        colorSelection: params.colorSelections[i],
        initialBag: params.initialBags[i],
        rules: params.rules,
      };
      this.games.push(new OnePlayerGame(playerParams));
    }
    this.rules = params.rules;

    this.pendingGarbage = Array(numPlayers).fill(0);
    this.accumulatedGarbage = Array(numPlayers).fill(0);
    this.pointResidues = Array(numPlayers).fill(0);
    this.allClearQueued = Array(numPlayers).fill(false);
    this.allClearBonus = Array(numPlayers).fill(false);
    this.canSend = Array(numPlayers).fill(false);
    this.mercyRemaining = Array(numPlayers).fill(this.rules.mercyFrames);
    this.targetPoints = [...this.rules.targetPoints];
  }

  get age(): number {
    const result = this.games[0].age;
    if (this.games.some(g => g.age !== result)) {
      throw new Error('Game desync');
    }
    return result;
  }

  // TODO: True multiplayer
  get state(): GameState[] {
    const states = this.games.map(game => game.state);
    for (let i = 0; i < this.games.length; ++i) {
      const opponent = 1 - i;
      let pendingGarbage = this.pendingGarbage[i];
      let accumulatedGarbage = this.accumulatedGarbage[i];
      if (this.allClearBonus[i] && this.canSend[i]) {
        accumulatedGarbage += ALL_CLEAR_GARBAGE;
      }
      if (pendingGarbage > accumulatedGarbage) {
        pendingGarbage -= accumulatedGarbage;
        accumulatedGarbage = 0;
      } else {
        accumulatedGarbage -= pendingGarbage;
        pendingGarbage = 0;
      }
      states[i].pendingGarbage = pendingGarbage;
      states[opponent].lateGarbage = accumulatedGarbage;
      states[i].allClearBonus = this.allClearBonus[i];
      // There's a frame where only the buffer remains.
      // No way to offset that.
      states[i].pendingGarbage += this.games[i].screen.bufferedGarbage;
    }
    if (states[0].lateGarbage > states[1].lateGarbage) {
      states[0].lateGarbage -= states[1].lateGarbage;
      states[1].lateGarbage = 0;
    } else {
      states[1].lateGarbage -= states[0].lateGarbage;
      states[0].lateGarbage = 0;
    }
    return states;
  }

  get initialBags(): number[][] {
    return this.games.map(g => g.initialBag);
  }

  displayLines() {
    const lines = this.games[0].displayLines();
    if (this.allClearBonus[0]) {
      lines[17] += 'AC';
    }
    const garbageUnits = [];
    let lengthCompensation = 0;
    if (this.games[0].screen.bufferedGarbage) {
      garbageUnits.push(
        `${colorOf(YELLOW)}${this.games[0].screen.bufferedGarbage}${colorOf(
          AIR
        )}`
      );
      lengthCompensation += 11;
    }
    if (this.pendingGarbage[0]) {
      garbageUnits.push(
        `${colorOf(GARBAGE)}${this.pendingGarbage[0]}${colorOf(AIR)}`
      );
      lengthCompensation += 11;
    }
    if (!garbageUnits.length) {
      garbageUnits.push('0');
    }
    lines.push(
      `G: ${garbageUnits.join('+')} ←  ${this.accumulatedGarbage[1]} `
    );

    garbageUnits.length = 0;
    if (this.games[1].screen.bufferedGarbage) {
      garbageUnits.push(
        `${colorOf(YELLOW)}${this.games[1].screen.bufferedGarbage}${colorOf(
          AIR
        )}`
      );
    }
    if (this.pendingGarbage[1]) {
      garbageUnits.push(
        `${colorOf(GARBAGE)}${this.pendingGarbage[1]}${colorOf(AIR)}`
      );
    }
    if (!garbageUnits.length) {
      garbageUnits.push('0');
    }
    const rightLines = this.games[1].displayLines();
    if (this.allClearBonus[1]) {
      rightLines[17] += 'AC';
    }
    rightLines.push(
      `G: ${garbageUnits.join('+')} ←  ${this.accumulatedGarbage[0]} `
    );
    for (let i = 0; i < lines.length; ++i) {
      if (i < PADDING.length) {
        for (let j = 0; j < PADDING[i]; j++) {
          lines[i] += ' ';
        }
      } else {
        while (lines[i].length < 19 + (i === 20 ? lengthCompensation : 0)) {
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

  play(
    player: number,
    x1: number,
    y1: number,
    orientation: number,
    hardDrop = false
  ): PlayedMove {
    const result = this.games[player].play(x1, y1, orientation, hardDrop);
    this.mercyRemaining[player] = FORCE_RELEASE;
    result.player = player;
    return result;
  }

  tick(): MultiplayerTickResult[] {
    const age = this.age;
    if (age >= this.rules.marginFrames) {
      if (!((age - this.rules.marginFrames) % MARGIN_INTERVAL)) {
        for (let i = 0; i < this.targetPoints.length; ++i) {
          this.targetPoints[i] = Math.floor(
            this.targetPoints[i] * MARGIN_MULTIPLIER
          );
          if (this.targetPoints[i] <= 0) {
            this.targetPoints[i] = 1;
            // Sudden Death
            this.games[1 - i].screen.bufferedGarbage += ONE_ROCK;
          }
        }
      }
    }
    const tickResults: MultiplayerTickResult[] = [];
    for (let i = 0; i < this.games.length; ++i) {
      const tickResult = this.games[i].tick();
      this.pointResidues[i] += tickResult.score;
      let generatedGarbage = Math.floor(
        this.pointResidues[i] / this.targetPoints[i]
      );
      this.pointResidues[i] -= generatedGarbage * this.targetPoints[i];
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

      tickResults.push({time: age, player: i, ...tickResult});
    }
    for (let i = 0; i < tickResults.length; ++i) {
      const opponent = 1 - i;
      // Send accumulated garbage as soon as the chain is over.
      if (this.canSend[i] && !tickResults[i].busy) {
        this.pendingGarbage[opponent] += this.accumulatedGarbage[i];
        this.accumulatedGarbage[i] = 0;
        this.pendingGarbage[opponent] += this.allClearBonus[i]
          ? ALL_CLEAR_GARBAGE
          : 0;

        this.allClearBonus[i] = this.allClearQueued[i];
        this.allClearQueued[i] = false;
        this.canSend[i] = false;
      }
    }
    // Offset outgoing garbage.
    if (this.pendingGarbage[0] >= this.pendingGarbage[1]) {
      this.pendingGarbage[0] -= this.pendingGarbage[1];
      this.pendingGarbage[1] = 0;
    }
    if (this.pendingGarbage[1] >= this.pendingGarbage[0]) {
      this.pendingGarbage[1] -= this.pendingGarbage[0];
      this.pendingGarbage[0] = 0;
    }

    for (let i = 0; i < tickResults.length; ++i) {
      if (!tickResults[i].busy) {
        if (this.mercyRemaining[i] <= 0) {
          const releasedGarbage = Math.min(ONE_ROCK, this.pendingGarbage[i]);
          this.games[i].screen.bufferedGarbage += releasedGarbage;
          this.pendingGarbage[i] -= releasedGarbage;
          if (releasedGarbage || this.mercyRemaining[i] === FORCE_RELEASE) {
            tickResults[i].busy = true;
            this.games[i].active = true;
          }
          this.mercyRemaining[i] = this.rules.mercyFrames;
        } else {
          this.mercyRemaining[i]--;
        }
      }
    }
    return tickResults;
  }

  toSimpleGame(player: number) {
    const opponent = 1 - player;
    let lateGarbage = this.accumulatedGarbage[opponent];
    if (this.allClearBonus[opponent] && this.canSend[opponent]) {
      lateGarbage += ALL_CLEAR_GARBAGE;
    }
    let lateTimeRemaining = 0;
    if (this.games[opponent].busy) {
      const opponentScreen = this.games[opponent].screen.clone();
      let score = 0;
      while (true) {
        const tickResult = opponentScreen.tick();
        score += tickResult.score;
        lateTimeRemaining++;
        if (!tickResult.busy) {
          break;
        }
      }
      // XXX: Ignores margin time and sudden death, but it's a simplification anyway...
      lateGarbage += Math.floor(
        (score + this.pointResidues[opponent]) / this.targetPoints[opponent]
      );
    }
    return new SimpleGame(
      this.games[player].screen.toSimpleScreen(),
      this.targetPoints[player],
      this.pointResidues[player],
      this.allClearBonus[player],
      this.pendingGarbage[player],
      lateGarbage,
      lateTimeRemaining,
      this.games[player].colorSelection,
      this.games[player].visibleBag,
      this.rules
    );
  }

  clone() {
    const result = new (this.constructor as new (
      params: MultiplayerParams
    ) => this)({
      bagSeeds: null,
      garbageSeeds: [0, 0],
      colorSelections: [[0], [0]],
      initialBags: [
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
      ],
      rules: this.rules,
    });
    result.games = this.games.map(game => game.clone());
    result.targetPoints = [...this.targetPoints];
    result.pendingGarbage = [...this.pendingGarbage];
    result.accumulatedGarbage = [...this.accumulatedGarbage];
    result.pointResidues = [...this.pointResidues];
    result.allClearQueued = [...this.allClearQueued];
    result.allClearBonus = [...this.allClearBonus];
    result.canSend = [...this.canSend];
    result.mercyRemaining = [...this.mercyRemaining];
    return result;
  }
}

export const PASS = -1;
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

// How long a single move takes on average.
// +1 added for occasional splits even when hard dropping.
const DEFAULT_MOVE_TIME = DEFAULT_JIGGLE_FRAMES + 1;

// Value all-clears based on the amount of garbage they send.
const SIMPLE_ALL_CLEAR_BONUS = 2100;
// Not even a 19-chain can compensate a Game Over.
export const SIMPLE_GAME_OVER = -1000000;

/**
 * Simplified view of one player in a multiplayer game suitable for naïve AI planning.
 */
export class SimpleGame {
  screen: SimplePuyoScreen;
  targetPoints: number;
  pointResidue: number;
  allClearBonus: boolean;
  // Garbage to be received as soon as possible, one rock at a time.
  pendingGarbage: number;
  // Garbage to be received later.
  lateGarbage: number;
  lateTimeRemaining: number;
  moveTime: number;

  colorSelection: number[];
  // The next four or six puyos to be played.
  bag: number[];

  rules: GameRules;

  constructor(
    screen: SimplePuyoScreen,
    targetPoints: number,
    pointResidue: number,
    allClearBonus: boolean,
    pendingGarbage: number,
    lateGarbage: number,
    lateTimeRemaining: number,
    colorSelection: number[],
    bag: number[],
    rules: GameRules,
    moveTime = DEFAULT_MOVE_TIME
  ) {
    this.screen = screen;
    this.targetPoints = targetPoints;
    this.pointResidue = pointResidue;
    this.allClearBonus = allClearBonus;
    this.pendingGarbage = pendingGarbage;
    this.lateGarbage = lateGarbage;
    this.lateTimeRemaining = lateTimeRemaining;
    this.colorSelection = [...colorSelection];
    this.bag = [...bag];
    this.rules = rules;
    this.moveTime = moveTime;

    // Normalize
    this.lateTimeRemaining += this.moveTime;
    this.resolve();
  }

  isReroll(index: number, mask?: Puyos) {
    if (index === PASS) {
      return false;
    }
    const {x1, x2} = MOVES[index];
    if (mask === undefined) {
      mask = this.screen.mask;
    }
    return puyoAt(mask, x1, GHOST_Y) && puyoAt(mask, x2, GHOST_Y);
  }

  get availableMoves() {
    const mask = this.screen.mask;
    const result: number[] = [];
    const symmetric = this.bag.length >= 2 && this.bag[0] === this.bag[1];
    let rerollPushed = false;
    const numMoves = symmetric ? MOVES.length / 2 : MOVES.length;
    for (let index = 0; index < numMoves; ++index) {
      if (this.isReroll(index, mask)) {
        if (!rerollPushed) {
          result.push(index);
          rerollPushed = true;
        }
      } else {
        result.push(index);
      }
    }
    if (this.lateGarbage > 0 && this.lateTimeRemaining > 0) {
      result.push(PASS);
    }
    return result;
  }

  playAndTick(move: number): TickResult {
    if (move === PASS) {
      this.lateTimeRemaining = 0;
      return {
        score: 0,
        colors: [],
        chainNumber: 0,
        didClear: false,
        didJiggle: false,
        didFall: false,
        coloredLanded: false,
        garbageLanded: false,
        allClear: false,
        busy: false,
        lockedOut: false,
      };
    }
    if (this.bag.length < 2) {
      throw new Error('Out of moves');
    }
    const color1 = this.bag.shift()!;
    const color2 = this.bag.shift()!;
    const {x1, y1, x2, y2} = MOVES[move];
    this.screen.insertPuyo(x1, y1, color1);
    this.screen.insertPuyo(x2, y2, color2);
    const releasedGarbage = Math.min(ONE_ROCK, this.pendingGarbage);
    this.pendingGarbage -= releasedGarbage;
    this.screen.bufferedGarbage += releasedGarbage;
    const tickResult = this.resolve();

    return tickResult;
  }

  resolve() {
    const tickResult = this.screen.tick();
    this.lateTimeRemaining -=
      tickResult.chainNumber * (this.rules.jiggleFrames + 2) + this.moveTime;
    if (this.lateTimeRemaining <= 0) {
      this.pendingGarbage += this.lateGarbage;
      this.lateGarbage = 0;
    }

    if (tickResult.didClear && this.allClearBonus) {
      this.pointResidue += SIMPLE_ALL_CLEAR_BONUS;
      this.allClearBonus = false;
    }
    this.pointResidue += tickResult.score;

    let generatedGarbage = Math.floor(this.pointResidue / this.targetPoints);
    this.pointResidue -= this.targetPoints * generatedGarbage;

    if (this.pendingGarbage > generatedGarbage) {
      this.pendingGarbage -= generatedGarbage;
      generatedGarbage = 0;
    } else {
      generatedGarbage -= this.pendingGarbage;
      this.pendingGarbage = 0;
    }
    if (this.lateGarbage > generatedGarbage) {
      this.lateGarbage -= generatedGarbage;
      generatedGarbage = 0;
    } else {
      generatedGarbage -= this.lateGarbage;
      this.lateGarbage = 0;
    }

    if (tickResult.allClear) {
      this.allClearBonus = true;
      tickResult.score += SIMPLE_ALL_CLEAR_BONUS;
    }
    if (tickResult.lockedOut) {
      tickResult.score += SIMPLE_GAME_OVER;
    }
    return tickResult;
  }

  clone() {
    return new (this.constructor as new (...args: any[]) => this)(
      this.screen.toSimpleScreen(),
      this.targetPoints,
      this.pointResidue,
      this.allClearBonus,
      this.pendingGarbage,
      this.lateGarbage,
      this.lateTimeRemaining,
      this.colorSelection,
      this.bag,
      this.rules,
      this.moveTime
    );
  }

  displayLines() {
    const lines = this.screen.displayLines();
    if (this.bag.length >= 2) {
      lines[0] = `╔════${colorOf(this.bag[0])}● ${colorOf(AIR)}${colorOf(
        this.bag[1]
      )}● ${colorOf(AIR)}════╗`;
    }
    lines[0] += '┌──┐';
    if (this.bag.length >= 4) {
      lines[1] += `│${colorOf(this.bag[3])}● ${colorOf(AIR)}│`;
      lines[2] += `│${colorOf(this.bag[2])}● ${colorOf(AIR)}│`;
    } else {
      lines[1] += '│  │';
      lines[2] += '│  │';
    }
    lines[3] += '└┐ └┐';
    if (this.bag.length >= 6) {
      lines[4] += ` │${colorOf(this.bag[5])}● ${colorOf(AIR)}│`;
      lines[5] += ` │${colorOf(this.bag[4])}● ${colorOf(AIR)}│`;
    } else {
      lines[4] += ' │  │';
      lines[5] += ' │  │';
    }
    lines[6] += ' └──┘';
    if (this.bag.length > 6) {
      lines[7] += ` +${this.bag.length - 6}`;
    }
    if (this.allClearBonus) {
      lines[lines.length - 1] += ' All Clear';
    }
    const garbageUnits = [];
    if (this.screen.bufferedGarbage) {
      garbageUnits.push(
        `${colorOf(YELLOW)}${this.screen.bufferedGarbage}${colorOf(AIR)}`
      );
    }
    if (this.pendingGarbage) {
      garbageUnits.push(
        `${colorOf(GARBAGE)}${this.pendingGarbage}${colorOf(AIR)}`
      );
    }
    if (this.lateGarbage) {
      garbageUnits.push(`${this.lateGarbage} in ${this.lateTimeRemaining}`);
    }
    if (garbageUnits.length) {
      lines.push('G: ' + garbageUnits.join(' + '));
    } else {
      lines.push('G: 0');
    }

    return lines;
  }

  /**
   * Render the game in the console.
   */
  log(): void {
    console.log(this.displayLines().join('\n'));
  }

  static fromJSON(obj: any) {
    const screen = SimplePuyoScreen.fromJSON(obj.screen);
    return new SimpleGame(
      screen,
      obj.targetPoints,
      obj.pointResidue,
      obj.allClearBonus,
      obj.pendingGarbage,
      obj.lateGarbage,
      obj.lateTimeRemaining,
      obj.colorSelection,
      obj.bag,
      obj.moveTime
    );
  }
}
