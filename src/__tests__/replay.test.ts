import {expect, test} from 'bun:test';
import {replayToTrack} from '../replay';
import {LUMI_VS_FLEX2, fixedRandomGame, infiniteRandomMirror} from './archive';
import {MultiplayerGame} from '../game';
import {TickResult} from '../screen';

test('Fixed random game', () => {
  const replay = fixedRandomGame();

  const track = [...replayToTrack(replay)];

  expect(track).toHaveLength(88);

  expect(track.filter(i => i.type === 'lockout')[0].player).toBe(1);
});

test('Lumi vs. Flex2', () => {
  const track = [...replayToTrack(LUMI_VS_FLEX2)];

  expect(track).toHaveLength(114);

  expect(track.filter(i => i.type === 'lockout')[0].player).toBe(1);
});

test('Infinite mirror game', () => {
  const replay = infiniteRandomMirror();
  const snapShots: MultiplayerGame[] = [];
  function takeSnapShot(game: MultiplayerGame, tickResults: TickResult[]) {
    if (!tickResults.length) {
      expect(game.age).toBe(0);
    }
    if (!(game.age % 30)) {
      snapShots.push(game.clone(true));
    }
  }

  const track = replayToTrack(replay, takeSnapShot);
  for (const item of track) {
    if (item.time > 300) {
      break;
    }
  }
  expect(snapShots.length).toBeGreaterThan(10);
  expect(snapShots.pop()!.age).not.toBeLessThan(300);
});

test('Re-entrance', () => {
  const snapShots: MultiplayerGame[] = [];

  const game = new MultiplayerGame(
    LUMI_VS_FLEX2.gameSeed,
    LUMI_VS_FLEX2.colorSelection,
    LUMI_VS_FLEX2.screenSeed,
    LUMI_VS_FLEX2.targetPoints
  );
  let index = 0;
  for (let j = 0; j < 11; ++j) {
    const snapShot = game.clone(true);
    snapShots.push(snapShot);
    for (let i = 0; i < 2; ++i) {
      expect(game.games[i].jkiss!.state).toEqual(
        snapShot.games[i].jkiss!.state
      );
      expect(game.games[i].screen.jkiss.state).toEqual(
        snapShot.games[i].screen.jkiss.state
      );
    }
    for (let i = 0; i < 100; ++i) {
      while (LUMI_VS_FLEX2.moves[index]?.time === game.age) {
        const move = LUMI_VS_FLEX2.moves[index++];
        game.play(move.player, move.x1, move.y1, move.orientation);
      }
      game.tick();
    }
  }

  for (let j = 0; j < 11; ++j) {
    const snapShot = snapShots[j];
    index = 0;
    while (
      index < LUMI_VS_FLEX2.moves.length &&
      LUMI_VS_FLEX2.moves[index].time < snapShot.age
    ) {
      index++;
    }
    for (let i = 0; i < 1100 - j * 100; ++i) {
      while (LUMI_VS_FLEX2.moves[index]?.time === snapShot.age) {
        const move = LUMI_VS_FLEX2.moves[index++];
        snapShot.play(move.player, move.x1, move.y1, move.orientation);
      }
      snapShot.tick();
    }
    expect(snapShot.age).toBe(game.age);
    expect(snapShot.games[0].score).toBe(game.games[0].score);
    expect(snapShot.games[1].score).toBe(game.games[1].score);
  }
});
