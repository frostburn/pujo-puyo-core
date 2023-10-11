import {
  MOVES,
  MultiplayerGame,
  PASS,
  SimpleGame,
  flexDropletStrategy2,
  nullStrategy,
  randomStrategy,
} from '../src';

const LOG = false;

let bot = flexDropletStrategy2;
let name = 'FlexDroplet2';
if (process.argv.length === 3) {
  console.log('Using random strategy');
  bot = randomStrategy;
  name = 'Random';
} else if (process.argv.length === 4) {
  console.log('Using null strategy with confirmation');
  bot = nullStrategy;
  name = 'Null';
}

const socket = new WebSocket('ws://localhost:3003');

let identity: number | null = null;

let mirrorGame: MultiplayerGame | null = null;

let wins = 0;
let draws = 0;
let losses = 0;

socket.addEventListener('message', event => {
  const data = JSON.parse(event.data);
  if (LOG) {
    console.log('Message received', data);
  }
  if (data.type === 'simple state') {
    console.warn('Unexpected simple state response');
    const game = SimpleGame.fromJSON(data.state);
    if (bot === nullStrategy) {
      prompt('Press enter to play the next move...');
    }
    const strategy = bot(game);
    game.log();
    console.log('Heuristic score:', strategy.score);
    console.log(`Wins / Draws / Losses: ${wins} / ${draws} / ${losses}`);

    const response = JSON.parse(JSON.stringify(MOVES[strategy.move]));
    response.type = 'move';
    response.hardDrop = true;
    socket.send(JSON.stringify(response));
  }

  if (data.type === 'identity') {
    identity = data.player;
  }
  if (data.type === 'game params') {
    mirrorGame = new MultiplayerGame(
      null,
      data.colorSelection,
      data.screenSeed
    );
  }
  if (data.type === 'bag') {
    mirrorGame!.games[data.player].bag = data.bag;

    if (data.player === identity) {
      const game = mirrorGame!.toSimpleGame(identity!);
      if (bot === nullStrategy) {
        prompt('Press enter to play the next move...');
      }
      const strategy = bot(game);
      game.log();
      console.log('Identity:', identity);
      console.log('Heuristic score:', strategy.score);
      console.log(`Wins / Draws / Losses: ${wins} / ${draws} / ${losses}`);

      let response;
      if (strategy.move === PASS) {
        response = {pass: true};
      } else {
        response = JSON.parse(JSON.stringify(MOVES[strategy.move]));
      }
      response.type = 'move';
      response.hardDrop = true;
      socket.send(JSON.stringify(response));
    }
  }
  if (data.type === 'move') {
    if (!data.pass) {
      mirrorGame!.play(
        data.player,
        data.x1,
        data.y1,
        data.orientation,
        data.hardDrop
      );
    }
    while (
      mirrorGame!.games.every(game => game.busy) ||
      (data.pass && mirrorGame!.games.some(game => game.busy))
    ) {
      const tickResults = mirrorGame!.tick();
      if (LOG) {
        const fx: string[] = [];
        if (tickResults[identity!].didClear) {
          fx.push('clear');
        }
        if (tickResults[identity!].didJiggle) {
          fx.push('jiggle');
        }
        if (tickResults[identity!].coloredLanded) {
          fx.push('colored landed');
        }
        if (tickResults[identity!].garbageLanded) {
          fx.push('garbage landed');
        }
        if (fx.length) {
          console.log(fx.join(' '));
        }
      }
    }
  }
  if (data.type === 'game result') {
    if (data.result === 'win') {
      wins++;
    } else if (data.result === 'draw') {
      draws++;
    } else {
      losses++;
    }
    console.log(`Game Over: ${data.result}, ${data.reason}`);
    socket.send(JSON.stringify({type: 'game request', name}));
  }
});

socket.addEventListener('open', () => {
  console.log('Connection established.');
  socket.send(JSON.stringify({type: 'game request', name}));
});

socket.addEventListener('close', event => {
  console.log('Closing client.', event.code, event.reason);
});
