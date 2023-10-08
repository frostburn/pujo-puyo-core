import {expect, test} from 'bun:test';
import {MultiplayerGame} from '../game';
import {JKISS32} from '../jkiss';
import {NUM_PUYO_TYPES, SimplePuyoScreen, WIDTH, isEmpty, puyosEqual} from '..';
import {Replay} from '../replay';
import {
  algebraicToGameStates,
  applyAlgebraic,
  joinTokens,
  replayToAlgebraic,
  splitIntoTokens,
  utterAlgebraic,
} from '../algebraic';

test('Documentation example', () => {
  const apn = [
    '[Event "Documentation"]',
    '[Site "https://github.com/frostburn/pujo-puyo-core"]',
    '[Date "2023.10.07"]',
    '[Round "1"]',
    '[Left "Lumi Pakkanen"]',
    '[Right "N/A"]',
    '[Result "*"]',
    '[Annotator "Lumi Pakkanen"]',
    '[Termination "Got bored."]',
    'R1R2! G3R3 B1B2 B1R2 G4G4 G2B1*...(3x!)',
  ].join('\n');
  const screen = new SimplePuyoScreen();
  const dummy = new SimplePuyoScreen();
  for (const token of splitIntoTokens(apn)) {
    applyAlgebraic([screen, dummy], token);
  }
  screen.grid.forEach(puyos => expect(isEmpty(puyos)).toBe(true));

  const states = algebraicToGameStates(splitIntoTokens(apn));
  const finalState = states[states.length - 1][0];
  expect(finalState.score).toBe(1000);
  expect(finalState.allClearBonus).toBeTrue();
});

test('Documentation example (prefix)', () => {
  const apn = 'R1R2! G3R3 B1B2 B1R2 G4G4';
  const screen = new SimplePuyoScreen();
  const dummy = new SimplePuyoScreen();
  for (const token of apn.split(' ')) {
    applyAlgebraic([screen, dummy], token);
  }
  const expectedScreen = SimplePuyoScreen.fromLines([
    'BR----',
    'BBRG--',
    'RRGG--',
  ]);
  expectedScreen.tick();

  screen.grid.forEach((puyos, i) =>
    expect(puyosEqual(puyos, expectedScreen.grid[i])).toBeTrue()
  );
});

test('Utter documentation example', () => {
  const apn =
    '[Event "Documentation"][Termination "Got bored."]R1R2! G3R3 B1B2 B1R2 G4G4 G2B1*...(3x!)';
  const utterance = splitIntoTokens(apn)
    .map(utterAlgebraic)
    .filter(Boolean)
    .join(' ');
  expect(utterance).toBe(
    'red, 1, red, 2, good. green, 3, red, 3. blue, 1, blue, 2. blue, 1, red, 2. green, 4, green, 4. green, 2, blue, 1, triggers. tick tick tick 3 chain, all clear.'
  );
});

test('Split and utter bags', () => {
  const apn = '(RG BY RB l) (YY BB GG r)';
  const tokens = splitIntoTokens(apn);
  expect(utterAlgebraic(tokens[0])).toBe(
    'bag red, green; blue, yellow; red, blue, left.'
  );
  expect(utterAlgebraic(tokens[1])).toBe(
    'bag yellow, yellow; blue, blue; green, green, right.'
  );
});

test('Utter multilines', () => {
  expect(utterAlgebraic('2Ll')).toBe('2 lines left.');
  expect(utterAlgebraic('3Nae')).toBe('3 nuisances A, E.');
  expect(utterAlgebraic('5Lr')).toBe('rock right.');
});

test('Known game', () => {
  const gameSeed = 7;
  const colorSelection = [1, 2, 3, 4];
  const screenSeed = 11;
  const game = new MultiplayerGame(gameSeed, colorSelection, screenSeed);
  const rng = new JKISS32(8);

  const replay: Replay = {
    gameSeed,
    screenSeed,
    colorSelection,
    moves: [],
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

  // TODO: Figure out why it says '2Nbcdef 3Lr' instead of '5Lr'
  const notation = replayToAlgebraic(replay);
  expect(joinTokens(notation)).toBe(
    'P6B6 PeBe B6Y5 BbYa G1P1 PeGe B4Y4 BdYc GdGd G5G4 GaBa G4B4 YaPb Y3P3 YfBf BaPa B5Y4 YePf P3B4 PdYe P4Y4 BbYb Y5P5 B4Y4 YaYa Y4Y3 PaPa P5P6 PePf P4P4 BdPc PfGf*,B5P6*.,(1xl) G6P6 (2xr) BdGc N1356 BcGc B5G4 GcGb B2G2 YePd G3G3 Y5P5 B5P6 PbBb GdPc* P1G1,P2B3,P2B2* (2xr) PeBf..BePf..GeGd 2Nbcdef 3Lr (4xl) GeBe G5G6 2Lr B2G1 BdYe B5Y5 PbPa YeYf P6P6 Y5Y5 YbGc Y3G3 #r 1-0 (GP PG PP l) (GP PG PP r)'
  );

  const screens = [new SimplePuyoScreen(), new SimplePuyoScreen()];
  for (const token of notation) {
    applyAlgebraic(screens, token);
  }

  for (let j = 0; j < screens.length; ++j) {
    for (let i = 0; i < NUM_PUYO_TYPES; ++i) {
      expect(
        puyosEqual(game.games[j].screen.grid[i], screens[j].grid[i])
      ).toBeTrue();
    }
  }
});

test('Human vs. bot', () => {
  const replay: Replay = {
    gameSeed: 3864657304,
    screenSeed: 2580717322,
    colorSelection: [3, 1, 0, 2],
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

  // TODO: Fix how it takes time too literally and breaks up a rock here.
  const notation = replayToAlgebraic(replay);

  const expected =
    'Y1Y2 YfYe G6B6 GaBa R1R2 RdRc G5B5 GbBb R1B1 BcRc B1R1 RbBa*,G3Y3 G3Y2 R4G4,Y5B4 (2xr) YdGc N12456 GdYe*,Y2Y2 Y2Y1,G3G3 B4R5 (2x!r) RcGc N12356 BdYd YeYe R3B2 YcYc R3G4 GbGb G1B2 RcBc B4B4 RbBc G5B5 RbGb R4R4 GaBb* R6B6,G6G6 R6G6,Y3R4 G4R4 G4R4,B5Y5*.,(4xr) BcBc.GeBd ReRd.RdBd GdGc GfRf*.,.,.,(3x!r) ReYe.GcRd RcGc.YeBf RdBe* (8xl) R4B4,B4B4 Y5B5 4Lr (1xr) Y4B5 Lr G6R6 BaBa R3R3*.5Lr BdYe Nb Nbdf Lr (1xl) Y4G4* #r 1-0.(1xl) (RY GY GG l) (YB RG RR r)';

  expect(joinTokens(notation)).toBe(expected);

  const screens = [new SimplePuyoScreen(), new SimplePuyoScreen()];
  for (const token of notation) {
    applyAlgebraic(screens, token);
  }

  const states = algebraicToGameStates(notation);

  expect(states[states.length - 1][0].screen.grid).toEqual(
    screens[0].state.grid
  );
  expect(states[states.length - 1][1].screen.grid).toEqual(
    screens[1].state.grid
  );

  expect(screens[0].tick().lockedOut).toBeFalse();
  expect(screens[1].tick().lockedOut).toBeTrue();

  expect(states.length).toBe(
    notation.map(utterAlgebraic).filter(Boolean).length
  );
});
