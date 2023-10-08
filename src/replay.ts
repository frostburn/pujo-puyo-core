import {MultiplayerGame, PlayedMove} from './game';

export type Replay = {
  gameSeed: number;
  screenSeed: number;
  colorSelection: number[];
  moves: PlayedMove[];
};

export function cmpMoves(a: PlayedMove, b: PlayedMove) {
  if (a.time < b.time) {
    return -1;
  }
  if (a.time > b.time) {
    return 1;
  }
  return a.player - b.player;
}

export function logReplay(replay: Replay) {
  const game = new MultiplayerGame(
    replay.gameSeed,
    replay.colorSelection,
    replay.screenSeed
  );
  replay.moves.sort(cmpMoves);
  game.log();
  replay.moves.forEach(move => {
    while (game.age < move.time) {
      game.tick();
    }
    game.play(move.player, move.x1, move.y1, move.orientation);
    game.log();
  });
  while (game.games.some(g => g.busy)) {
    game.tick();
  }
  game.log();
}
