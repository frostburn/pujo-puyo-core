import {SimpleGame, SimplePuyoScreen, flexDropletStrategy2} from '../src';

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
    e.data.bag
  );
  const strategy = flexDropletStrategy2(game);

  postMessage(strategy);
};
