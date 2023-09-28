import {
  JIGGLE_TIME,
  SimpleGame,
  SimplePuyoScreen,
  randomStrategy,
  flexDropletStrategy1,
  flexDropletStrategy2,
} from '../src';

const LOG = false;

type StrategyName = 'random' | 'flex1' | 'flex2';

const STRATEGIES = {
  random: randomStrategy,
  flex1: flexDropletStrategy1,
  flex2: flexDropletStrategy2,
};

const THINKING = {
  random: {totalFrames: 1e-6, samples: 1},
  flex1: {totalFrames: 1, samples: 1},
  flex2: {totalFrames: 3, samples: 1},
};

// Milliseconds per frame
const FRAME_RATE = 30 / 1000;

const FALL_FRAMES = 10;

onmessage = e => {
  const name: StrategyName = e.data.name;
  const thinking = THINKING[name];
  const gameData = e.data.game;

  // Revive the class instance.
  const screen = new SimplePuyoScreen();
  screen.grid = gameData.screen.grid;
  screen.bufferedGarbage = gameData.screen.bufferedGarbage;
  const moveTime =
    Math.max(0, thinking.totalFrames / thinking.samples - e.data.anticipation) +
    (e.data.kickDown ? 1 : FALL_FRAMES) +
    JIGGLE_TIME +
    e.data.throttleFrames;
  const game = new SimpleGame(
    screen,
    gameData.pointResidue,
    gameData.allClearBonus,
    gameData.pendingGarbage,
    gameData.lateGarbage,
    gameData.lateTimeRemaining,
    gameData.colorSelection,
    gameData.bag,
    moveTime
  );
  const start = performance.now();
  const strategy = STRATEGIES[name](game);
  const took = performance.now() - start;
  thinking.totalFrames += took * FRAME_RATE;
  thinking.samples++;

  const thinkingFrames = thinking.totalFrames / thinking.samples;

  if (LOG) {
    console.log(
      'Estimated CPU thinking time of',
      name,
      thinkingFrames / FRAME_RATE,
      'ms → moveTime =',
      moveTime,
      'frames'
    );
    console.log('Heuristic score =', strategy.score);
  }

  postMessage({strategy, thinkingFrames});
};
