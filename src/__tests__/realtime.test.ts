import {expect, test} from 'bun:test';
import {fixedRandomGame} from './archive';
import {MultiplayerGame, PlayedMove} from '../game';
import {RevealedPiece, TimeWarpingGame, TimeWarpingMirror} from '../realtime';

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
    replay.colorSelection,
    replay.screenSeed,
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
    replay.colorSelection,
    replay.screenSeed,
    replay.targetPoints,
    replay.marginFrames
  );

  const mirrorOrigin = new MultiplayerGame(
    null,
    replay.colorSelection,
    replay.screenSeed,
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
    mirror.warp(Math.floor(Math.random() * 1000));
  }

  const result = mirror.warp(1700);

  expect(result).not.toBeNull();

  expect(result!.games[0].score).toBe(3300);
  expect(result!.games[1].score).toBe(720);

  expect(result!.games[1].lockedOut).toBeTrue();
});
