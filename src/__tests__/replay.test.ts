import {expect, test} from 'bun:test';
import {replayToTrack} from '../replay';
import {LUMI_VS_FLEX2, fixedRandomGame} from './archive';

test('Fixed random game', () => {
  const replay = fixedRandomGame();

  const track = replayToTrack(replay);

  expect(track).toHaveLength(86);

  expect(track.filter(i => i.type === 'lockout')[0].player).toBe(1);
});

test('Lumi vs. Flex2', () => {
  const track = replayToTrack(LUMI_VS_FLEX2);

  expect(track).toHaveLength(112);

  expect(track.filter(i => i.type === 'lockout')[0].player).toBe(1);
});
