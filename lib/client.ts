import {
  MOVES,
  MultiplayerGame,
  SimpleGame,
  flexDropletStrategy2,
  nullStrategy,
  randomStrategy,
} from '../src';

let bot = flexDropletStrategy2;
if (process.argv.length === 3) {
  console.log('Using random strategy');
  bot = randomStrategy;
} else if (process.argv.length === 4) {
  console.log('Using null strategy with confirmation');
  bot = nullStrategy;
}

const socket = new WebSocket('ws://localhost:3003');

let identity: number | null = null;

let mirrorGame: MultiplayerGame | null = null;

let wins = 0;
let draws = 0;
let losses = 0;

socket.addEventListener('message', event => {
  const data = JSON.parse(event.data);
  // console.log('Message received', data);
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

      const response = JSON.parse(JSON.stringify(MOVES[strategy.move]));
      response.type = 'move';
      response.hardDrop = true;
      socket.send(JSON.stringify(response));
    }
  }
  if (data.type === 'move') {
    mirrorGame!.play(
      data.player,
      data.x1,
      data.y1,
      data.orientation,
      data.hardDrop
    );
    while (mirrorGame!.games.every(game => game.busy)) {
      mirrorGame!.tick();
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
    socket.send(JSON.stringify({type: 'game request'}));
  }
});

socket.addEventListener('open', () => {
  console.log('Connection established.');
  socket.send(JSON.stringify({type: 'game request'}));
});

socket.addEventListener('close', event => {
  console.log('Closing client.', event.code, event.reason);
});
