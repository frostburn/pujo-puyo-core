import {maxDropletStrategy2} from './ai';
import {SimpleGame} from './game';
import {SimplePuyoScreen} from './screen';

export * from './ai';
export * from './bitboard';
export * from './game';
export * from './jkiss';
export * from './screen';

export function benchmark() {
  const screen = new SimplePuyoScreen();
  const game = new SimpleGame(
    screen,
    0,
    0,
    0,
    [0, 1, 2, 3],
    [0, 1, 2, 3, 0, 1]
  );
  const start = Date.now();
  const numMoves = 50;
  for (let i = 0; i < numMoves; ++i) {
    const strategy = maxDropletStrategy2(game);
    game.playAndTick(strategy.move);
    game.bag.push(
      game.colorSelection[
        Math.floor(Math.random() * game.colorSelection.length)
      ]
    );
    game.bag.push(
      game.colorSelection[
        Math.floor(Math.random() * game.colorSelection.length)
      ]
    );
    game.screen.log();
    console.log(strategy.score.toString());
  }
  const end = Date.now();
  console.log(`Playing ${numMoves} moves took ${end - start} ms`);
}
