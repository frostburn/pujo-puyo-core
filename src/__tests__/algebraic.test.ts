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
import {LUMI_VS_FLEX2} from './archive';

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
  // TODO: Fix how it takes time too literally and breaks up a rock here.
  const notation = replayToAlgebraic(LUMI_VS_FLEX2);

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
