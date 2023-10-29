import {expect, test} from 'bun:test';
import {fixedRandomGame} from './archive';
import {DEFAULT_MARGIN_FRAMES, MultiplayerGame, PlayedMove} from '../game';
import {RevealedPiece, TimeWarpingGame, TimeWarpingMirror} from '../realtime';
import {HEIGHT} from '../bitboard';

test('Rejects duplicate moves', () => {
  const origin = new MultiplayerGame();
  const move: PlayedMove = {
    x1: 0,
    y1: 1,
    x2: 0,
    y2: 2,
    orientation: 0,
    time: 0,
    player: 0,
  };
  const main = new TimeWarpingGame(origin);

  expect(main.addMove(move)).toHaveLength(0);
  expect(main.addMove(move)).toHaveLength(1);

  expect(main._warp(1)).not.toBeNull();
});

test('Reveals pieces only once', () => {
  const origin = new MultiplayerGame();
  const main = new TimeWarpingGame(origin);

  expect(main.revealPieces(0)).toHaveLength(2);
  expect(main.revealPieces(0)).toHaveLength(0);
  expect(main.revealPieces(100)).toHaveLength(0);
});

test('Fixed random game (time warp)', () => {
  const replay = fixedRandomGame();

  const origin = new MultiplayerGame(
    replay.gameSeed,
    replay.screenSeed,
    replay.colorSelections,
    replay.targetPoints,
    replay.marginFrames
  );

  const main = new TimeWarpingGame(origin);

  let moves = [...replay.moves];
  moves.sort(() => Math.random() - 0.5);

  do {
    const retries: PlayedMove[] = [];
    for (const move of moves) {
      if (retries.includes(move)) {
        continue;
      }
      const retcon = main.addMove(move);
      for (const retry of retcon) {
        retries.push(retry);
      }
    }
    moves = retries;
  } while (moves.length);

  const result = main._warp(1700);

  expect(result).not.toBeNull();

  expect(result!.games[0].score).toBe(3300);
  expect(result!.games[1].score).toBe(720);

  expect(result!.games[1].lockedOut).toBeTrue();
});

test('Fixed random game (mirror time warp)', () => {
  const replay = fixedRandomGame();

  const origin = new MultiplayerGame(
    replay.gameSeed,
    replay.screenSeed,
    replay.colorSelections,
    replay.targetPoints,
    replay.marginFrames
  );

  const mirrorOrigin = new MultiplayerGame(
    null,
    replay.screenSeed,
    replay.colorSelections,
    replay.targetPoints,
    replay.marginFrames
  );

  const mirror = new TimeWarpingMirror(mirrorOrigin, origin.initialBags);

  const game = origin.clone(true);

  for (let i = 0; i < 2; ++i) {
    const piece: RevealedPiece = {
      player: i,
      time: game.age,
      piece: game.games[i].nextPiece,
    };
    mirror.addPiece(piece);
  }

  for (const move of replay.moves) {
    game.games[move.player].advanceColors();
    const piece: RevealedPiece = {
      player: move.player,
      time: NaN,
      piece: game.games[move.player].nextPiece,
    };
    mirror.addPiece(piece);
  }

  const moves = [...replay.moves];
  moves.sort(() => Math.random() - 0.5);

  for (const move of moves) {
    mirror.addMove(move);
    const game = mirror.warp(Math.floor(Math.random() * 1000))[0];
    if (game) {
      expect(game.games.every(g => expect(g.bag.length).not.toBeLessThan(6)));
    }
  }

  const result = mirror.warp(1700)[0];

  expect(result).not.toBeNull();

  expect(result!.games[0].score).toBe(3300);
  expect(result!.games[1].score).toBe(720);

  expect(result!.games[1].lockedOut).toBeTrue();
});

test('Sounds of the past', () => {
  const origin = new MultiplayerGame();
  const mirror = new TimeWarpingMirror(origin, origin.initialBags);

  mirror.warp(10);

  const move = origin.clone(true).play(1, 0, HEIGHT - 3, 0);

  mirror.addMove(move);

  const tickResults = mirror.warp(11)[1];

  expect(tickResults.filter(t => t.player === 0)).toHaveLength(1);
  expect(
    tickResults.filter(t => t.player === 1).some(t => t.didFall)
  ).toBeTrue();
  expect(
    tickResults.filter(t => t.player === 1).some(t => t.coloredLanded)
  ).toBeTrue();
});

test('Multiplayer subclassability', () => {
  class TestClass extends MultiplayerGame {
    sound: string;

    constructor(
      seed?: number | null,
      screenSeed?: number,
      colorSelections?: number[][],
      targetPoints?: number[],
      marginFrames = DEFAULT_MARGIN_FRAMES
    ) {
      super(seed, screenSeed, colorSelections, targetPoints, marginFrames);
      this.sound = 'tick';
    }

    tick() {
      const results = super.tick();
      if (this.sound === 'tick') {
        this.sound = 'tock';
      } else {
        this.sound = 'tick';
      }
      return results;
    }

    clone(preserveSeed = false) {
      const instance = super.clone(preserveSeed);
      instance.sound = this.sound;
      return instance;
    }
  }

  const instance = new TestClass();

  expect(instance.sound).toBe('tick');
  instance.tick();
  expect(instance.sound).toBe('tock');
  expect(instance.age).toBe(1);

  const clone = instance.clone(true);
  expect(clone.sound).toBe('tock');
  expect(clone.age).toBe(1);
  expect(clone.games[0].jkiss!.state).toEqual(instance.games[0].jkiss!.state);

  const mirror = new TimeWarpingGame(clone);

  const warped = mirror.warp(2)!;

  expect(warped.sound).toBe('tick');
  expect(warped.age).toBe(2);
});

test('Has memory limits', () => {
  const origin = new MultiplayerGame();
  const main = new TimeWarpingGame(origin, 5, 5);
  // Two scheduled checkpoints at 5 and 10
  main.warp(10);
  expect(main.checkpoints.size).toBe(2);
  // Temporary at 11
  main.warp(11);
  expect(main.checkpoints.size).toBe(3);
  // Temporary now at 12
  main.warp(12);
  expect(main.checkpoints.size).toBe(3);
  // Max reached
  main.warp(25);
  expect(main.checkpoints.size).toBe(5);
  main.warp(26);
  expect(main.checkpoints.size).toBe(5);
  const times = [...main.checkpoints.keys()];
  times.sort((a, b) => a - b);
  expect(times).toEqual([10, 15, 20, 25, 26]);
});

test('Mirror has memory limits', () => {
  const origin = new MultiplayerGame(null, 1, [[], []]);
  const mirror = new TimeWarpingMirror(origin, [[], []], 5, 5);
  // Two scheduled checkpoints at 5 and 10
  mirror.warp(10);
  expect(mirror.checkpoints.size).toBe(2);
  // Temporary at 11
  mirror.warp(11);
  expect(mirror.checkpoints.size).toBe(3);
  // Temporary now at 12
  mirror.warp(12);
  expect(mirror.checkpoints.size).toBe(3);
  // Max reached
  mirror.warp(25);
  expect(mirror.checkpoints.size).toBe(5);
  mirror.warp(26);
  expect(mirror.checkpoints.size).toBe(5);
  const times = [...mirror.checkpoints.keys()];
  times.sort((a, b) => a - b);
  expect(times).toEqual([10, 15, 20, 25, 26]);
});
