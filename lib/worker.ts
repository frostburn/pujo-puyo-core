import {
  JIGGLE_TIME,
  SPARK_TIME,
  SimpleGame,
  SimplePuyoScreen,
  flexDropletStrategy2,
} from '../src';

const LOG = false;

// Milliseconds per frame
const FRAME_RATE = 30 / 1000;

const CHAIN_FRAMES = JIGGLE_TIME + SPARK_TIME + 4;
const DROP_FRAMES = 10 + JIGGLE_TIME;

let totalThinkingFrames = 10;
let numSamples = 1;

onmessage = e => {
  // Revive the class instance.
  const screen = new SimplePuyoScreen();
  screen.grid = e.data.screen.grid;
  screen.chainNumber = e.data.screen.chainNumber;
  screen.bufferedGarbage = e.data.screen.bufferedGarbage;
  screen.garbageSlots = e.data.screen.garbageSlots;
  const game = new SimpleGame(
    screen,
    e.data.pendingGarbage,
    e.data.lateGarbage,
    e.data.lateTimeRemaining,
    e.data.colorSelection,
    e.data.bag,
    (totalThinkingFrames / numSamples + DROP_FRAMES) / CHAIN_FRAMES
  );
  const start = performance.now();
  const strategy = flexDropletStrategy2(game);
  const took = performance.now() - start;
  totalThinkingFrames += took * FRAME_RATE;
  numSamples++;

  if (LOG) {
    console.log(
      'Estimated CPU thinking time',
      totalThinkingFrames / numSamples / FRAME_RATE,
      'ms → moveTime =',
      (totalThinkingFrames / numSamples + DROP_FRAMES) / CHAIN_FRAMES
    );
    console.log('Heuristic score =', strategy.score);
  }

  postMessage(strategy);
};
