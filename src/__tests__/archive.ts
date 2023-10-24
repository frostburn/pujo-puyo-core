import {WIDTH} from '../bitboard';
import {
  DEFAULT_MARGIN_FRAMES,
  MOVES,
  MultiplayerGame,
  randomColorSelection,
} from '../game';
import {JKISS32, randomSeed} from '../jkiss';
import {Replay, ReplayIterator} from '../replay';

/** Technically infinite but will end up in a double lockout eventually. */
export function infiniteRandomMirror(): ReplayIterator {
  const gameSeed = randomSeed();
  const colorSelection = randomColorSelection();
  const screenSeed = randomSeed();
  const targetPoints = [70, 70];
  const marginFrames = Infinity;
  const game = new MultiplayerGame(
    gameSeed,
    colorSelection,
    screenSeed,
    targetPoints,
    marginFrames
  );

  function* playForever() {
    while (true) {
      if (Math.random() < 0.01) {
        if (!game.games[0].busy) {
          const {x1, y1, orientation} =
            MOVES[Math.floor(Math.random() * MOVES.length)];
          const hardDrop = Math.random() < 0.5;
          yield game.play(0, x1, y1, orientation, hardDrop);
          yield game.play(1, x1, y1, orientation, hardDrop);
        }
      }
      game.tick();
    }
  }

  return {
    gameSeed,
    colorSelection,
    screenSeed,
    targetPoints,
    marginFrames,
    moves: playForever(),
    metadata: {
      event: 'Infinite Mirror Match',
      site: 'archive.ts',
      names: ['Random A', 'Random B'],
      elos: [1000, 1000],
      round: 0,
      priorWins: [0, 0],
      msSince1970: new Date().valueOf(),
      type: 'realtime',
    },
    result: {
      winner: undefined,
      reason: 'ongoing',
    },
  };
}

export function fixedRandomGame() {
  const gameSeed = 7;
  const colorSelection = [1, 2, 3, 4];
  const screenSeed = 11;
  const targetPoints = [70, 70];
  const marginFrames = DEFAULT_MARGIN_FRAMES;
  const game = new MultiplayerGame(
    gameSeed,
    colorSelection,
    screenSeed,
    targetPoints,
    marginFrames
  );
  const rng = new JKISS32(8);

  const replay: Replay = {
    gameSeed,
    screenSeed,
    colorSelection,
    targetPoints,
    marginFrames,
    moves: [],
    metadata: {
      event: 'Fixed Random Match',
      site: 'archive.ts',
      names: ['Random A', 'Random B'],
      elos: [1000, 1000],
      round: 0,
      priorWins: [0, 0],
      msSince1970: new Date('2023-10-06').valueOf(),
      type: 'realtime',
    },
    result: {
      winner: 0,
      reason: 'lockout',
    },
  };

  for (let i = 0; i < 1600; ++i) {
    if (!(rng.step() % 10)) {
      const player = rng.step() % 2;
      if (!game.games[player].busy) {
        replay.moves.push(
          game.play(
            player,
            rng.step() % WIDTH,
            1 + (rng.step() % 10),
            rng.step() & 3
          )
        );
      }
    }
    game.tick();
  }
  return replay;
}

export const LUMI_VS_FLEX2: Replay = {
  gameSeed: 3864657304,
  screenSeed: 2580717322,
  colorSelection: [3, 1, 0, 2],
  targetPoints: [70, 70],
  marginFrames: DEFAULT_MARGIN_FRAMES,
  metadata: {
    event:
      'First human vs. machine game to be captured in algebraic notation for Puyo',
    site: 'http://localhost:5173/',
    names: ['Lumi Pakkanen', 'FlexDroplet 2'],
    elos: [3000, 2675],
    round: 1,
    priorWins: [1, 0],
    msSince1970: new Date('2023-10-07').valueOf(),
    type: 'pausing',
  },
  result: {
    winner: 0,
    reason: 'lockout',
  },
  moves: [
    {player: 0, time: 0, x1: 0, y1: 15, x2: 1, y2: 15, orientation: 3},
    {player: 1, time: 0, x1: 5, y1: 15, x2: 4, y2: 15, orientation: 1},
    {player: 0, time: 18, x1: 5, y1: 14, x2: 5, y2: 15, orientation: 2},
    {player: 1, time: 18, x1: 0, y1: 14, x2: 0, y2: 15, orientation: 2},
    {player: 0, time: 36, x1: 0, y1: 14, x2: 1, y2: 14, orientation: 3},
    {player: 1, time: 36, x1: 3, y1: 15, x2: 2, y2: 15, orientation: 1},
    {player: 0, time: 54, x1: 4, y1: 15, x2: 4, y2: 14, orientation: 0},
    {player: 1, time: 54, x1: 1, y1: 15, x2: 1, y2: 14, orientation: 0},
    {player: 0, time: 72, x1: 0, y1: 12, x2: 0, y2: 13, orientation: 2},
    {player: 1, time: 72, x1: 2, y1: 14, x2: 2, y2: 13, orientation: 0},
    {player: 0, time: 90, x1: 0, y1: 10, x2: 0, y2: 11, orientation: 2},
    {player: 1, time: 90, x1: 1, y1: 13, x2: 0, y2: 13, orientation: 1},
    {player: 0, time: 108, x1: 2, y1: 14, x2: 2, y2: 15, orientation: 2},
    {player: 0, time: 126, x1: 2, y1: 13, x2: 1, y2: 13, orientation: 1},
    {player: 0, time: 144, x1: 3, y1: 14, x2: 3, y2: 15, orientation: 2},
    {player: 0, time: 162, x1: 4, y1: 13, x2: 3, y2: 13, orientation: 1},
    {player: 1, time: 169, x1: 3, y1: 15, x2: 2, y2: 15, orientation: 1},
    {player: 1, time: 187, x1: 3, y1: 14, x2: 4, y2: 14, orientation: 3},
    {player: 0, time: 209, x1: 1, y1: 11, x2: 1, y2: 10, orientation: 0},
    {player: 0, time: 227, x1: 1, y1: 8, x2: 0, y2: 8, orientation: 1},
    {player: 0, time: 246, x1: 2, y1: 12, x2: 2, y2: 11, orientation: 0},
    {player: 0, time: 264, x1: 3, y1: 11, x2: 4, y2: 11, orientation: 3},
    {player: 1, time: 266, x1: 2, y1: 14, x2: 2, y2: 15, orientation: 2},
    {player: 1, time: 284, x1: 3, y1: 14, x2: 3, y2: 15, orientation: 2},
    {player: 1, time: 302, x1: 4, y1: 15, x2: 4, y2: 14, orientation: 0},
    {player: 0, time: 310, x1: 2, y1: 7, x2: 1, y2: 7, orientation: 1},
    {player: 1, time: 320, x1: 2, y1: 13, x2: 2, y2: 12, orientation: 0},
    {player: 0, time: 330, x1: 2, y1: 8, x2: 3, y2: 8, orientation: 3},
    {player: 1, time: 338, x1: 1, y1: 15, x2: 1, y2: 14, orientation: 0},
    {player: 0, time: 350, x1: 0, y1: 6, x2: 1, y2: 6, orientation: 3},
    {player: 1, time: 356, x1: 2, y1: 10, x2: 2, y2: 11, orientation: 2},
    {player: 0, time: 368, x1: 3, y1: 9, x2: 3, y2: 8, orientation: 0},
    {player: 1, time: 374, x1: 1, y1: 9, x2: 2, y2: 9, orientation: 3},
    {player: 0, time: 386, x1: 4, y1: 9, x2: 4, y2: 8, orientation: 0},
    {player: 1, time: 396, x1: 1, y1: 12, x2: 1, y2: 11, orientation: 0},
    {player: 0, time: 404, x1: 3, y1: 7, x2: 3, y2: 6, orientation: 0},
    {player: 1, time: 414, x1: 0, y1: 10, x2: 1, y2: 10, orientation: 3},
    {player: 0, time: 422, x1: 5, y1: 11, x2: 5, y2: 10, orientation: 0},
    {player: 0, time: 440, x1: 5, y1: 9, x2: 5, y2: 8, orientation: 0},
    {player: 0, time: 458, x1: 5, y1: 6, x2: 5, y2: 7, orientation: 2},
    {player: 0, time: 476, x1: 2, y1: 5, x2: 3, y2: 5, orientation: 3},
    {player: 0, time: 496, x1: 3, y1: 4, x2: 3, y2: 3, orientation: 0},
    {player: 0, time: 514, x1: 3, y1: 2, x2: 3, y2: 1, orientation: 0},
    {player: 0, time: 532, x1: 4, y1: 6, x2: 4, y2: 7, orientation: 2},
    {player: 1, time: 579, x1: 2, y1: 15, x2: 2, y2: 14, orientation: 0},
    {player: 1, time: 597, x1: 4, y1: 15, x2: 3, y2: 15, orientation: 1},
    {player: 1, time: 615, x1: 4, y1: 14, x2: 3, y2: 14, orientation: 1},
    {player: 1, time: 633, x1: 3, y1: 13, x2: 3, y2: 12, orientation: 0},
    {player: 1, time: 651, x1: 3, y1: 11, x2: 2, y2: 11, orientation: 1},
    {player: 1, time: 671, x1: 5, y1: 15, x2: 5, y2: 14, orientation: 0},
    {player: 1, time: 791, x1: 4, y1: 14, x2: 4, y2: 15, orientation: 2},
    {player: 1, time: 809, x1: 2, y1: 15, x2: 3, y2: 15, orientation: 3},
    {player: 1, time: 827, x1: 2, y1: 13, x2: 2, y2: 14, orientation: 2},
    {player: 1, time: 845, x1: 4, y1: 13, x2: 5, y2: 13, orientation: 3},
    {player: 1, time: 865, x1: 3, y1: 12, x2: 4, y2: 12, orientation: 3},
    {player: 0, time: 875, x1: 3, y1: 13, x2: 3, y2: 12, orientation: 0},
    {player: 0, time: 893, x1: 3, y1: 11, x2: 3, y2: 10, orientation: 0},
    {player: 0, time: 911, x1: 4, y1: 9, x2: 4, y2: 10, orientation: 2},
    {player: 0, time: 929, x1: 3, y1: 8, x2: 4, y2: 8, orientation: 3},
    {player: 0, time: 948, x1: 5, y1: 8, x2: 5, y2: 9, orientation: 2},
    {player: 1, time: 955, x1: 0, y1: 10, x2: 0, y2: 9, orientation: 0},
    {player: 0, time: 966, x1: 2, y1: 13, x2: 2, y2: 12, orientation: 0},
    {player: 1, time: 999, x1: 3, y1: 2, x2: 4, y2: 2, orientation: 3},
    {player: 0, time: 1027, x1: 3, y1: 11, x2: 3, y2: 10, orientation: 0},
  ],
};
