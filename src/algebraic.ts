/**
 * Algebraic Puyo Notation:
 * Colors are represented by uppercase letters: R, G, Y, B and P.
 * The colors are pronounced 'red', 'green', 'yellow', 'blue' and 'purple'.
 * Horizontal coordinates of the left player are represented by the numbers 1, 2, 3, 4, 5 and 6.
 * Horizontal coordinates of the right player are represented by the letters a, b, c, d, e and f.
 * Moves by players are pairs of colors with their horizontal coordinates.
 * When pieces align vertically the first part ends up at the bottom.
 * When a move triggers a chain the pair should be followed by a star (*) which is pronounced 'triggers'.
 * The triggering puyo may be listed last in the pair if it doesn't interfere with vertical ordering, but this is not strictly necessary.
 * Chains may be listed in parenthesis with their number followed by an x which is pronounced 'chain'.
 * All clears may be included in the parenthesis as an exclamation mark (!) on the chain, pronounced 'all clear'.
 * In multiplayer the chain should be notated at the point of final resolution and the player should be differentiated by
 * appending l for 'left' or r for 'right' inside the parenthesis.
 * Additional timing information may be provided using dots (.), pronounced 'tick', on each link of the chain reaction.
 * For the right player the dots should be replaced with commas (,) and pronounced 'tock'.
 * Link indicators may be grouped and space around them may be omitted.
 *
 * Received garbage is notated by N (pronounced 'nuisance') followed by horizontal coordinates where the garbage lands.
 * A line of garbage is notated by L (pronounced 'line') followed by the player receiving it: l for 'left' or r for 'right'.
 * Thus Ll is equal to N123456 and Lr is equal to Nabcdef.
 * When multiple lines are received the L is prefixed by the number of lines. In this case the L is pronounced 'lines'
 * 5L is pronounced 'rock' instead of 'five lines'.
 * While it's preferable to group nuisance into line groups, the notation is mainly concerned with garbage that actually affects gameplay.
 * This means that repeated N tokens can be replaced by the number of repeats so N12 N12 becomes 2N12 (pronounced 'two nuisances one two').
 *
 * Lockout is notated with a hash (#) pronounced 'lockout' and followed by l for 'left' or r for 'right'.
 * The game result is given by 1-0, 0-1 or ½-½ in the case of a draw. Pronounced 'left wins', 'right wins', 'draw' respectively.
 *
 * The notation places puyos directly onto the playing grid so there's no concept of "preview".
 * To show what's left in the "bag" at the end of the game, a space-separated list of color pairs may be listed in parenthesis followed by a space and r or l for clarity.
 * Pronunciation is 'bag *colors* *player*'.
 *
 * Spelling the coordinates of the right player in numbers may be desirable when analysing games for easier comparison. Simply append r to the move in that case.
 * e.g. "When I opened with 'yellow one, yellow two' (Y1Y2) and the bot went 'yellow six, yellow five, right' (Y6Y5r) I hadn't yet realized we were playing a mirrored game."
 * TODO: Actually support these in the code.
 *
 * In international context letters may be replaced with colored balls (●), nuisance with hollow balls (◎), L with an equals sign (=),
 * l with left-facing arrow (←) and r with a right-facing arrow (→).
 * The latin alphabet is to be avoided completely so both players should use numbered coordinates and always indicate the player.
 * Thus R1G2 RcGd* Ll becomes (in messy ANSI): \x1b[31;1m● \x1b[0m1\x1b[32;1m● \x1b[0m2← \x1b[31;1m● \x1b[0m3\x1b[32;1m● \x1b[0m4→ =←
 *
 * In true multiplayer context the rightmost player is alway r or → and always uses coordinates a, b, c, d, e and f.
 * The middle player is denoted with m or ↑ for 'middle' and uses coordinates g, h, i, j, k, and l. Chain links are marked with a backtick (`) and pronounced 'pop'.
 * The middle-left player is denoted with n or ↖ for 'near' and uses coordinates m, n, o, p, q and r. Links marked with colons (:) pronounced 'click'.
 * The middle-right player is denoted with f or ↗ for 'far' and uses coordinates s, t, u, v, w and x. Links marked with semicolons (;) pronounced 'clack'.
 * TODO: True multiplayer support in the engine.
 *
 * == Portable extension ==
 * Additional information can be entered with the following tags inside square brackets.
 * Event: Name of the tournament or match event.
 * Site: Location of the event. This is in City, Region COUNTRY format, where COUNTRY is the three-letter International Olympic Committee code for the country.
 *       An example is New York City, NY USA. Online platforms may include a URL or website as the site value.
 *       Platforms that lack a definite URL may be identified by the game title and hardware architecture such as: Puyo Puyo Tetris, Nintendo Switch.
 * Date: Starting date of the game, in YYYY.MM.DD form. ?? is used for unknown values.
 * Round: Playing round ordinal of the game within the event.
 * Left: Player of the grid on the left, in Lastname, Firstname format.
 * Right: Player of the grid on the right, same format as Left.
 * Result: Result of the game. It is recorded as Left score, dash, then Right score, or * (other, e.g., the game is ongoing).
 *
 * TODO: Include data about target score and margin time so that incoming garbage can be inferred when displaying the notation.
 *
 * = Optional tag pairs =
 * Annotator: The person providing notes to the game.
 * TimeControl: e.g. 40/7200:3600 (moves per seconds: sudden death seconds)
 * Time: Time the game started, in HH:MM:SS format, in local clock time.
 * Termination: Gives more details about the termination of the game. It may be abandoned, adjudication (result determined by third-party adjudication),
 *              death, emergency, normal, rules infraction, time forfeit, or unterminated.
 * InitialPosition: The initial position of the grid, in comma-separated list of lines counting from the bottom.
 *                  e.g. NNNNNN, -NNNN- denotes a full line of garbage with a centered line of four nuisance puyos on top.
 *                  If the grids differ, two positions are listed separated by a semicolon.
 *
 * == Annotation symbols ==
 * Moves may be annotated by appending one of the following symbols after them.
 *
 * !!: A brilliant—and usually surprising—move
 * !: A very good move
 * !?: An interesting move that may not be the best
 * ?!: A dubious move that is not easily refutable
 * ?: A bad move; a mistake
 * ??: A blunder
 * ⌓: A better move than the one played
 * □: A forced move; the only reasonable move, or the only move available
 * n: A theoretical novelty
 *
 * === Future work ===
 * Nested variations could be listed in curly brackets ({}) separated by pipes (|) using Newick Format (https://en.wikipedia.org/wiki/Newick_format).
 *
 * Example of a single player game that sets off an all clearing 3-chain:
 * [Event "Documentation"]
 * [Site "https://github.com/frostburn/pujo-puyo-core"]
 * [Date "2023.10.07"]
 * [Round "1"]
 * [Left "Lumi Pakkanen"]
 * [Right "N/A"]
 * [Result "*"]
 * [Annotator "Lumi Pakkanen"]
 * [Termination "Got bored."]
 * R1R2! G3R3 B1B2 B1R2 G4G4 G2B1*...(3x!)
 * Pronunciation: Red one, red two (good); green three, red three; blue one, blue two; blue one, red two; green four, green four; green two, blue one triggers; tick tick tick three chain all clear.
 *
 * State of the game as the last move is about to trigger the chain:
 * BG
 * BR
 * BBRG
 * RRGG
 * 123456
 */

import {
  WIDTH,
  applyMask,
  columnCounts,
  columnsFull,
  invert,
  mergeColumns,
  semiVisible,
  toppedUp,
} from './bitboard';
import {GameState, MultiplayerGame} from './game';
import {Replay, cmpMoves} from './replay';
import {ASCII_PUYO, GARBAGE, PuyoScreen, SimplePuyoScreen} from './screen';

// TODO: Add support for R1R2r

const RIGHT_COORDS = 'abcdef';

function inferNuisance(
  oldCounts: number[],
  newCounts: number[],
  columnMask: boolean[],
  player: string
) {
  let result = '';
  let altResult = '';
  for (let x = 0; x < WIDTH; ++x) {
    if (oldCounts[x] === newCounts[x] - 1) {
      result += (x + 1).toString();
      altResult += (x + 1).toString();
    } else if (oldCounts[x] !== newCounts[x]) {
      throw new Error('Impossible garbage count delta');
    } else if (columnMask[x]) {
      altResult += (x + 1).toString();
    }
  }
  if (result === '123456' || altResult === '123456') {
    return 'L' + player;
  }
  if (result) {
    if (player === 'r') {
      result = result
        .replace('1', 'a')
        .replace('2', 'b')
        .replace('3', 'c')
        .replace('4', 'd')
        .replace('5', 'e')
        .replace('6', 'f');
    }
    return 'N' + result;
  }
  return '';
}

export function replayToAlgebraic(replay: Replay): string[] {
  const result: string[] = [];

  const game = new MultiplayerGame(
    replay.gameSeed,
    replay.colorSelection,
    replay.screenSeed
  );
  const gameOvers = [false, false];
  const allClears = [false, false];
  const chainNumbers = [
    game.games[0].screen.chainNumber,
    game.games[1].screen.chainNumber,
  ];

  function collapseNuisance(nuisanceTokens: string[]) {
    nuisanceTokens = nuisanceTokens.filter(Boolean);
    if (!nuisanceTokens.length) {
      return;
    }
    let token = nuisanceTokens.pop()!;
    let num = 1;
    while (nuisanceTokens.length) {
      const nextToken = nuisanceTokens.pop()!;
      if (token === nextToken) {
        num++;
      } else {
        if (num === 1) {
          result.push(token);
        } else {
          result.push(`${num}${token}`);
        }
        token = nextToken;
        num = 1;
      }
    }
    if (num === 1) {
      result.push(token);
    } else {
      result.push(`${num}${token}`);
    }
  }

  function tickAndCollect(time?: number) {
    const columnMasks = [
      columnsFull(game.games[0].screen.mask),
      columnsFull(game.games[1].screen.mask),
    ];
    const nuisanceTokens: string[][] = [[], []];
    let garbageCounts = game.games.map(g =>
      columnCounts(semiVisible(g.screen.grid[GARBAGE]))
    );
    while (
      (time === undefined && game.games.some(g => g.busy)) ||
      game.age < time!
    ) {
      const tickResults = game.tick();
      const newCounts = game.games.map(g =>
        columnCounts(semiVisible(g.screen.grid[GARBAGE]))
      );
      if (tickResults[0].didFall) {
        nuisanceTokens[0].push(
          inferNuisance(garbageCounts[0], newCounts[0], columnMasks[0], 'l')
        );
      }
      if (tickResults[1].didFall) {
        nuisanceTokens[1].push(
          inferNuisance(garbageCounts[1], newCounts[1], columnMasks[1], 'r')
        );
      }
      garbageCounts = newCounts;
      allClears[0] = allClears[0] || tickResults[0].allClear;
      allClears[1] = allClears[1] || tickResults[1].allClear;
      if (tickResults[0].chainNumber > chainNumbers[0]) {
        chainNumbers[0] = tickResults[0].chainNumber;
        result.push('.');
      }
      if (tickResults[1].chainNumber > chainNumbers[1]) {
        chainNumbers[1] = tickResults[1].chainNumber;
        result.push(',');
      }
      if (!gameOvers.some(g => g)) {
        if (tickResults[0].lockedOut) {
          gameOvers[0] = true;
          result.push('#l');
          if (tickResults[1].lockedOut) {
            gameOvers[1] = true;
            result.push('#r');
            result.push('½-½');
          } else {
            result.push('0-1');
          }
        } else if (tickResults[1].lockedOut) {
          gameOvers[1] = true;
          result.push('#r');
          result.push('1-0');
        }
      }
    }
    collapseNuisance(nuisanceTokens[0]);
    collapseNuisance(nuisanceTokens[1]);
    if (chainNumbers[0] && !game.games[0].screen.chainNumber) {
      result.push(`(${chainNumbers[0]}x${allClears[0] ? '!' : ''}l)`);
      chainNumbers[0] = 0;
      allClears[0] = false;
    }
    if (chainNumbers[1] && !game.games[1].screen.chainNumber) {
      result.push(`(${chainNumbers[1]}x${allClears[1] ? '!' : ''}r)`);
      chainNumbers[1] = 0;
      allClears[1] = false;
    }
  }

  replay.moves.sort(cmpMoves);
  replay.moves.forEach(move => {
    tickAndCollect(move.time);
    if (!game.games[move.player].hand.length) {
      throw new Error('Replay desync (out of hand)');
    }

    const coord1 = move.player
      ? RIGHT_COORDS[move.x1]
      : (move.x1 + 1).toString();
    const coord2 = move.player
      ? RIGHT_COORDS[move.x2]
      : (move.x2 + 1).toString();
    const first = `${ASCII_PUYO[game.games[move.player].hand[0]]}${coord1}`;
    const second = `${ASCII_PUYO[game.games[move.player].hand[1]]}${coord2}`;
    if (move.y2 > move.y1) {
      result.push(`${second}${first}`);
    } else {
      result.push(`${first}${second}`);
    }
    game.play(move.player, move.x1, move.y1, move.orientation);

    if (game.games[move.player].screen.toSimpleScreen().tick().didClear) {
      result[result.length - 1] += '*';
    }
  });

  tickAndCollect();

  let b = game.games[0].bag.map(c => ASCII_PUYO[c]);
  result.push(`(${b[0]}${b[1]} ${b[2]}${b[3]} ${b[4]}${b[5]} l)`);

  b = game.games[1].bag.map(c => ASCII_PUYO[c]);
  result.push(`(${b[0]}${b[1]} ${b[2]}${b[3]} ${b[4]}${b[5]} r)`);

  return result;
}

const TOKEN_REGEX = /(\[[^\]]+\]|\([^)]+\))|(\.)|(,)|\s+/g;

export function splitIntoTokens(apn: string) {
  return apn.split(TOKEN_REGEX).filter(Boolean);
}

export function joinTokens(tokens: string[]) {
  const lines: string[] = [];
  let line = '';
  for (const token of tokens) {
    if (token.startsWith('[')) {
      lines.push(line);
      line = '';
      lines.push(token);
    } else {
      if (
        !line ||
        token === '.' ||
        token === ',' ||
        line.endsWith('.') ||
        line.endsWith(',')
      ) {
        line += token;
      } else {
        line += ' ' + token;
      }
    }
  }
  lines.push(line);
  return lines.filter(Boolean).join('\n');
}

export function applyAlgebraic(screens: SimplePuyoScreen[], token: string) {
  if (
    token.startsWith('(') ||
    token.startsWith('[') ||
    token.startsWith('#') ||
    token === '1-0' ||
    token === '0-1' ||
    token === '½-½' ||
    token === '.' ||
    token === ','
  ) {
    return;
  }
  let num = 1;
  if (/\d/.test(token[0])) {
    num = parseInt(token[0], 10);
    token = token.slice(1);
  }
  if (token.startsWith('L')) {
    const index = token.endsWith('l') ? 0 : 1;
    screens[index].bufferedGarbage = WIDTH * num;
    screens[index].tick();
  } else if (token.startsWith('N')) {
    const index = /\d/.test(token[1]) ? 0 : 1;
    const columns = index
      ? [...token.slice(1)].map(c => RIGHT_COORDS.indexOf(c))
      : [...token.slice(1)].map(c => parseInt(c, 10) - 1);
    mergeColumns(screens[index].grid[GARBAGE], columns, num);
    // Make sure the garbage actually fits.
    const mask = screens[index].coloredMask;
    invert(mask);
    applyMask(screens[index].grid[GARBAGE], mask);
    screens[index].tick();
  } else {
    token = token.replace(/\*/g, '');
    const index = /\d/.test(token[1]) ? 0 : 1;

    // eslint-disable-next-line no-inner-declarations
    function parseCoord(character: string) {
      return index
        ? RIGHT_COORDS.indexOf(character)
        : parseInt(character, 10) - 1;
    }

    const color1 = ASCII_PUYO.indexOf(token[0]);
    const x1 = parseCoord(token[1]);
    const color2 = ASCII_PUYO.indexOf(token[2]);
    const x2 = parseCoord(token[3]);

    // These are distended on purpose to ignore orientation acrobatics.
    screens[index].insertPuyo(x1, 2, color1);
    screens[index].insertPuyo(x2, 1, color2);
    screens[index].tick();
  }
}

export function algebraicToGameStates(tokens: string[]): GameState[][] {
  const bags: number[][] = [[], []];
  for (let token of tokens) {
    if (token.startsWith('(')) {
      token = token.replace(/\(|\)/g, '');
      if (/d/.test(token[0])) {
        continue;
      } else {
        const index = token[token.length - 1] === 'r' ? 1 : 0;
        while (token.length) {
          if (ASCII_PUYO.includes(token[0])) {
            bags[index].push(ASCII_PUYO.indexOf(token[0]));
          }
          token = token.slice(1);
        }
      }
    } else if (ASCII_PUYO.includes(token[0]) && token[0] !== 'N') {
      const index = RIGHT_COORDS.includes(token[1]) ? 1 : 0;
      while (token.length) {
        if (ASCII_PUYO.includes(token[0])) {
          bags[index].push(ASCII_PUYO.indexOf(token[0]));
        }
        token = token.slice(1);
      }
    }
  }

  const scores = [0, 0];
  const screens = [new PuyoScreen(), new PuyoScreen()];
  const allClearBonus = [false, false];

  const result: GameState[][] = [];
  for (let token of tokens) {
    if (token.startsWith('[')) {
      continue;
    }
    let busy = true;
    if (
      token.startsWith('#') ||
      token === '1-0' ||
      token === '0-1' ||
      token === '½-½'
    ) {
      busy = false;
    } else if (token === '.' || token === ',') {
      const index = token === '.' ? 0 : 1;
      const oldNumber = screens[index].chainNumber;
      while (true) {
        const tickResult = screens[index].tick();
        scores[index] += tickResult.score;
        if (screens[index].chainNumber > oldNumber) {
          break;
        }
        if (screens[index].chainNumber < oldNumber) {
          throw new Error('Inconsistent tick');
        }
      }
    } else if (token.startsWith('(')) {
      token = token.replace(/\(|\)/g, '');
      if (/\d/.test(token[0])) {
        const index = token[token.length - 1] === 'r' ? 1 : 0;
        const oldNumber = screens[index].chainNumber;
        while (oldNumber) {
          const tickResult = screens[index].tick();
          scores[index] += tickResult.score;
          if (tickResult.didClear) {
            allClearBonus[index] = false;
          }
          allClearBonus[index] = allClearBonus[index] || tickResult.allClear;
          if (!tickResult.busy) {
            busy = false;
          }
          if (screens[index].chainNumber < oldNumber) {
            break;
          }
          if (screens[index].chainNumber > oldNumber) {
            throw new Error('Inconsistent chain call');
          }
        }
      }
    } else {
      let num = 1;
      if (/\d/.test(token[0])) {
        num = parseInt(token[0], 10);
        token = token.slice(1);
      }
      if (token.startsWith('L')) {
        const index = token.endsWith('l') ? 0 : 1;
        screens[index].bufferedGarbage = WIDTH * num;
        while (screens[index].tick().busy);
        busy = false;
      } else if (token.startsWith('N')) {
        const index = /\d/.test(token[1]) ? 0 : 1;
        const columns = index
          ? [...token.slice(1)].map(c => RIGHT_COORDS.indexOf(c))
          : [...token.slice(1)].map(c => parseInt(c, 10) - 1);
        mergeColumns(screens[index].grid[GARBAGE], columns, num);
        // Make sure the garbage actually fits.
        const mask = screens[index].coloredMask;
        invert(mask);
        applyMask(screens[index].grid[GARBAGE], mask);
        while (screens[index].tick().busy);
        busy = false;
      } else {
        token = token.replace(/\*/g, '');
        const index = /\d/.test(token[1]) ? 0 : 1;

        // eslint-disable-next-line no-inner-declarations
        function parseCoord(character: string) {
          return index
            ? RIGHT_COORDS.indexOf(character)
            : parseInt(character, 10) - 1;
        }

        const color1 = ASCII_PUYO.indexOf(token[0]);
        const x1 = parseCoord(token[1]);
        const color2 = ASCII_PUYO.indexOf(token[2]);
        const x2 = parseCoord(token[3]);

        // Pacify the situation.
        while (true) {
          const tickResult = screens[index].tick();
          scores[index] += tickResult.score;
          if (!tickResult.busy) {
            break;
          }
        }

        if (x1 === x2) {
          screens[index].insertPuyo(x1, 2, color1);
          screens[index].insertPuyo(x2, 1, color2);
        } else {
          screens[index].insertPuyo(x1, 1, color1);
          screens[index].insertPuyo(x2, 1, color2);
        }
        bags[index] = bags[index].slice(2);

        // Fall down
        while (screens[index].tick().didFall);
      }
    }
    const pair: GameState[] = [];
    for (let i = 0; i < screens.length; ++i) {
      // TODO: Consider simulating pending garbage.
      pair.push({
        screen: screens[i].state,
        age: -1,
        score: scores[i],
        hand: [],
        preview: bags[i].slice(0, 4),
        pendingGarbage: 0,
        lateGarbage: 0,
        allClearBonus: allClearBonus[i],
        busy,
        lockedOut:
          toppedUp(screens[i].mask) ||
          (i === 0 && token === '#l') ||
          (i === 1 && token === '#r'),
      });
    }
    result.push(pair);
  }
  return result;
}

const COLOR_NAMES: Record<string, string> = {
  R: 'red',
  G: 'green',
  Y: 'yellow',
  B: 'blue',
  P: 'purple',
};

function utterCoordinate(coordinate: string) {
  return coordinate.toUpperCase();
}

export function utterAlgebraic(token: string) {
  let result = '';
  if (token.startsWith('[')) {
    return '';
  } else if (token.startsWith('(')) {
    token = token.replace(/\(|\)/g, '');
    if (/\d/.test(token[0])) {
      result = `${token.replace(/x|!|l|r/g, '')} chain`;
      if (token.includes('!')) {
        result += ', all clear';
      }
      if (token.includes('l')) {
        result += ', left';
      }
      if (token.includes('r')) {
        result += ', right';
      }
    } else {
      const pairs: string[] = [];
      const pair: string[] = [];
      while (token.length) {
        if (token[0] === ' ') {
          pairs.push(pair.join(', '));
          pair.length = 0;
        } else if (token[0] in COLOR_NAMES) {
          pair.push(COLOR_NAMES[token[0]]);
        } else {
          break;
        }
        token = token.slice(1);
      }
      if (pair.length) {
        pairs.push(pair.join(', '));
      }
      result = `bag ${pairs.join('; ')}`;
      if (token[0] === 'l') {
        result += ', left';
      } else if (token[0] === 'r') {
        result += ', right';
      }
    }
  } else if (token.startsWith('#')) {
    result = 'lockout';
    if (token[1] === 'l') {
      result += ' left';
    } else if (token[1] === 'r') {
      result += ' right';
    }
  } else if (token === '1-0') {
    result = 'left wins';
  } else if (token === '0-1') {
    result = 'right wins';
  } else if (token === '½-½') {
    result = 'draw';
  } else if (token === '.') {
    return 'tick';
  } else if (token === ',') {
    return 'tock';
  } else {
    let num = 1;
    if (/\d/.test(token[0])) {
      num = parseInt(token[0], 10);
      token = token.slice(1);
    }
    if (token.startsWith('L')) {
      if (num === 5) {
        result = 'rock';
      } else if (num > 1) {
        result = `${num} lines`;
      } else {
        result = 'line';
      }
      if (token[1] === 'l') {
        result += ' left';
      } else if (token[1] === 'r') {
        result += ' right';
      }
    } else if (token.startsWith('N')) {
      if (num > 1) {
        result = `${num} nuisances `;
      } else {
        result = 'nuisance ';
      }
      result += [...token.slice(1)].map(utterCoordinate).join(', ');
    } else {
      const content: string[] = [];
      while (token.length) {
        if (token[0] in COLOR_NAMES) {
          content.push(COLOR_NAMES[token[0]]);
        } else if (token[0] === '*') {
          content.push('triggers');
        } else if (token === '!!') {
          token = token.slice(1);
          content.push('brilliant');
        } else if (token === '!?') {
          token = token.slice(1);
          content.push('interesting');
        } else if (token === '?!') {
          token = token.slice(1);
          content.push('dubious');
        } else if (token === '??') {
          token = token.slice(1);
          content.push('blunder');
        } else if (token[0] === '!') {
          content.push('good');
        } else if (token[0] === '?') {
          content.push('bad');
        } else if (token[0] === '⌓') {
          content.push('better');
        } else if (token[0] === '□') {
          content.push('forced');
        } else if (token[0] === 'n') {
          content.push('novelty');
        } else {
          content.push(utterCoordinate(token[0]));
        }
        token = token.slice(1);
      }
      result = content.join(', ');
    }
  }
  return result + '.';
}
