/* eslint-disable no-case-declarations */
import {WIDTH, columnCounts, semiVisible} from './bitboard';
import {MultiplayerGame, PlayedMove} from './game';
import {AIR, GARBAGE, TickResult, colorOf} from './screen';

export type ApplicationInfo = {
  name: string;
  version: string;
  resolved?: string;
  core?: {
    version: string;
    resolved?: string;
  };
};

export type ReplayMetadata = {
  names: string[];
  elos: number[];
  priorWins: number[];
  event: string;
  site: string;
  round: number;
  msSince1970: number;
  type: 'realtime' | 'pausing';
  endTime?: number;
  annotator?: string;
  timeControl?: string;
  termination?: string;
  initialPosition?: string;
  server?: ApplicationInfo;
  clients?: (ApplicationInfo | null)[];
};

export type ReplayResultReason =
  | 'ongoing'
  | 'resignation'
  | 'timeout'
  | 'disconnect'
  | 'lockout'
  | 'double lockout'
  | 'impasse'
  | 'max time exceeded'
  | 'server maintenance';

export type ReplayResult = {
  winner?: number;
  reason: ReplayResultReason;
};

/** Seed data for re-creating a game. */
export type Replay = {
  gameSeed: number;
  screenSeed: number;
  colorSelection: number[];
  targetPoints: number[];
  moves: PlayedMove[];
  metadata: ReplayMetadata;
  result: ReplayResult;
};

export type ReplayIterator = {
  gameSeed: number;
  screenSeed: number;
  colorSelection: number[];
  targetPoints: number[];
  moves: Iterable<PlayedMove>;
  metadata: ReplayMetadata;
  result: ReplayResult;
};

export type TickCallback = (
  game: MultiplayerGame,
  tickResults: TickResult[]
) => void;

/** Explicit data for visualization. */
export interface TrackMove extends PlayedMove {
  type: 'move';
  color1: number;
  color2: number;
  triggers1: boolean;
  triggers2: boolean;
}

export type TrackGarbageLine = {
  type: 'garbage';
  player: number;
  time: number;
  columns: number[];
};

export type TrackScore = {
  type: 'score';
  player: number;
  time: number;
  score: number;
  colors: number[];
};

export type TrackChain = {
  type: 'chain';
  player: number;
  time: number;
  number: number;
  allClear: boolean;
};

export type TrackLockout = {
  type: 'lockout';
  player: number;
  time: number;
};

export type TrackBag = {
  type: 'bag';
  player: number;
  time: number;
  bag: number[];
};

export type TrackResult = {
  type: 'result';
  player: number;
  time: number;
  result: 'win' | 'draw' | 'loss';
  reason: ReplayResultReason;
};

export type TrackItem =
  | TrackMove
  | TrackGarbageLine
  | TrackScore
  | TrackChain
  | TrackLockout
  | TrackBag
  | TrackResult;

export type ReplayTrack = Iterable<TrackItem>;

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
    replay.screenSeed,
    replay.targetPoints
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

export function* replayToTrack(
  replay: Replay | ReplayIterator,
  callback?: TickCallback
): ReplayTrack {
  const game = new MultiplayerGame(
    replay.gameSeed,
    replay.colorSelection,
    replay.screenSeed,
    replay.targetPoints
  );
  if (Array.isArray(replay.moves)) {
    replay.moves.sort(cmpMoves);
  }

  const allClears = [false, false];
  const lockouts = [false, false];
  const chainNumbers = [0, 0];

  if (callback !== undefined) {
    callback(game, []);
  }

  function* tickAndCollect(time?: number): ReplayTrack {
    let garbageCounts = game.games.map(g =>
      columnCounts(semiVisible(g.screen.grid[GARBAGE]))
    );
    while (
      (time === undefined && game.games.some(g => g.busy)) ||
      game.age < time!
    ) {
      const tickResults = game.tick();
      if (callback !== undefined) {
        callback(game, tickResults);
      }
      const time = game.age;
      const newCounts = game.games.map(g =>
        columnCounts(semiVisible(g.screen.grid[GARBAGE]))
      );
      for (let j = 0; j < tickResults.length; ++j) {
        if (tickResults[j].didFall) {
          const columns: number[] = [];
          for (let i = 0; i < newCounts[j].length; ++i) {
            if (newCounts[j][i] > garbageCounts[j][i]) {
              columns.push(i);
            }
          }
          if (columns.length) {
            yield {
              type: 'garbage',
              player: j,
              time,
              columns,
            };
          }
        }
        allClears[j] = allClears[j] || tickResults[j].allClear;
        if (tickResults[j].score) {
          yield {
            type: 'score',
            player: j,
            time,
            score: tickResults[j].score,
            colors: tickResults[j].colors,
          };
        }
        if (chainNumbers[j] && !tickResults[j].chainNumber) {
          yield {
            type: 'chain',
            player: j,
            time,
            number: chainNumbers[j],
            allClear: allClears[j],
          };
          allClears[j] = false;
        }
        if (!lockouts[j] && tickResults[j].lockedOut) {
          yield {
            type: 'lockout',
            player: j,
            time,
          };
          lockouts[j] = true;
        }
        chainNumbers[j] = tickResults[j].chainNumber;
      }
      garbageCounts = newCounts;
    }
  }

  for (const move of replay.moves) {
    yield* tickAndCollect(move.time);
    if (!game.games[move.player].hand.length) {
      throw new Error('Replay desync (out of hand)');
    }
    const color1 = game.games[move.player].hand[0];
    const color2 = game.games[move.player].hand[1];

    const simple = game.games[move.player].screen.toSimpleScreen();
    const simple1 = simple.toSimpleScreen();
    simple1.insertPuyo(move.x1, move.y1, color1);
    simple1.insertPuyo(move.x2, move.y2, GARBAGE);
    let triggers1 = simple1.tick().didClear;
    const simple2 = simple.toSimpleScreen();
    simple2.insertPuyo(move.x1, move.y1, GARBAGE);
    simple2.insertPuyo(move.x2, move.y2, color2);
    let triggers2 = simple2.tick().didClear;
    if (!triggers1 && !triggers2) {
      simple.insertPuyo(move.x1, move.y1, color1);
      simple.insertPuyo(move.x2, move.y2, color2);
      triggers1 = triggers2 = simple.tick().didClear;
    }

    const trackMove: TrackMove = game.play(
      move.player,
      move.x1,
      move.y1,
      move.orientation
    ) as TrackMove;
    trackMove.type = 'move';
    trackMove.color1 = color1;
    trackMove.color2 = color2;
    trackMove.triggers1 = triggers1;
    trackMove.triggers2 = triggers2;
    yield trackMove;
  }
  yield* tickAndCollect();

  for (let i = 0; i < game.games.length; ++i) {
    yield {
      type: 'bag',
      player: i,
      time: game.age,
      bag: game.games[i].bag.slice(0, 6),
    };
    let result: 'win' | 'draw' | 'loss';
    if (replay.result.winner === undefined) {
      result = 'draw';
    } else if (replay.result.winner === i) {
      result = 'win';
    } else {
      result = 'loss';
    }
    yield {
      type: 'result',
      player: i,
      time: game.age,
      result,
      reason: replay.result.reason,
    };
  }
}

export function logReplayTrack(track: ReplayTrack) {
  const unrolled = [...track];

  const topLine = Array(4 * WIDTH + 2).fill(' ');
  const bottomLine = Array(4 * WIDTH + 2).fill(' ');
  bottomLine[2 * WIDTH] = '║';

  let time = -1;

  // Iterate from last to first so that time goes up and "gravity" goes down.
  while (unrolled.length) {
    const item = unrolled.pop()!;
    if (item.time !== time) {
      if (topLine.some(c => c !== ' ')) {
        topLine[2 * WIDTH] = '║';
        console.log(topLine.join(''));
      }
      console.log(bottomLine.join(''));
      topLine.fill(' ');
      bottomLine.fill(' ');
      bottomLine[2 * WIDTH] = '║';
      time = item.time;
    }
    const offset = item.player ? 2 * WIDTH + 2 : 0;
    switch (item.type) {
      case 'move':
        // eslint-disable-next-line prettier/prettier
        const ball1 = `${item.triggers1 ? '\x1b[47m' : ''}${colorOf(item.color1)}●${colorOf(AIR)}`;
        // eslint-disable-next-line prettier/prettier
        const ball2 = `${item.triggers2 ? '\x1b[47m' : ''}${colorOf(item.color2)}●${colorOf(AIR)}`;
        if (item.y2 > item.y1) {
          topLine[offset + 2 * item.x1] = ball1;
          bottomLine[offset + 2 * item.x2] = ball2;
        } else if (item.y1 > item.y2) {
          topLine[offset + 2 * item.x2] = ball2;
          bottomLine[offset + 2 * item.x1] = ball1;
        } else {
          bottomLine[offset + 2 * item.x1] = ball1;
          bottomLine[offset + 2 * item.x2] = ball2;
        }
        break;
      case 'garbage':
        for (const x of item.columns) {
          bottomLine[offset + 2 * x] = `${colorOf(GARBAGE)}◎${colorOf(AIR)}`;
        }
        break;
      case 'chain':
        const label = item.number.toString();
        if (label.length === 1) {
          bottomLine[offset] = label;
          bottomLine[offset + 1] = '-';
          bottomLine[offset + 2] = 'c';
          bottomLine[offset + 3] = 'h';
          bottomLine[offset + 4] = 'a';
          bottomLine[offset + 5] = 'i';
          bottomLine[offset + 6] = 'n';
          bottomLine[offset + 8] = item.allClear ? 'A' : ' ';
          bottomLine[offset + 9] = item.allClear ? 'C' : ' ';
        } else {
          bottomLine[offset] = label[0];
          bottomLine[offset + 1] = label[1];
          bottomLine[offset + 2] = '-';
          bottomLine[offset + 3] = 'c';
          bottomLine[offset + 4] = 'h';
          bottomLine[offset + 5] = 'a';
          bottomLine[offset + 6] = 'i';
          bottomLine[offset + 7] = 'n';
          bottomLine[offset + 9] = item.allClear ? 'A' : ' ';
          bottomLine[offset + 10] = item.allClear ? 'C' : ' ';
        }
        break;
      case 'score':
        const scoreLabel = item.score.toString();
        for (let i = 0; i < scoreLabel.length; ++i) {
          bottomLine[offset + i] = `${colorOf(
            i < item.colors.length ? item.colors[i] : AIR
          )}${scoreLabel[i]}`;
        }
        bottomLine[offset + scoreLabel.length] = `${colorOf(AIR)} `;
        break;
      case 'lockout':
        bottomLine[offset] = '#';
        bottomLine[offset + 2] = 'L';
        bottomLine[offset + 3] = 'o';
        bottomLine[offset + 4] = 'c';
        bottomLine[offset + 5] = 'k';
        bottomLine[offset + 6] = 'o';
        bottomLine[offset + 7] = 'u';
        bottomLine[offset + 8] = 't';
        bottomLine[offset + 10] = '#';
        break;
      case 'bag':
        bottomLine[offset] = '(';
        for (let i = 0; i < item.bag.length; ++i) {
          bottomLine[offset + i + 1 + Math.floor(i / 2)] = `${colorOf(
            item.bag[i]
          )}.${colorOf(AIR)}`;
        }
        bottomLine[offset + item.bag.length * 1.5] = ')';
    }
  }
  if (topLine.some(c => c !== ' ')) {
    topLine[2 * WIDTH] = '║';
    console.log(topLine.join(''));
  }
  console.log(bottomLine.join(''));
}
