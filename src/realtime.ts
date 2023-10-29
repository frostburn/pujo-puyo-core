import {MultiplayerGame, MultiplayerTickResult, PlayedMove} from './game';

export type RevealedPiece = {
  player: number;
  time: number;
  piece: number[];
};

export class TimeWarpingGame<T extends MultiplayerGame> {
  origin: T;
  moves: PlayedMove[];
  numPiecesRevealed: number[];
  checkpoints: Map<number, T>;
  checkpointInterval: number;
  maxCheckpoints: number;

  constructor(origin: T, checkpointInterval = 10, maxCheckpoints = Infinity) {
    this.origin = origin;
    this.checkpoints = new Map();
    this.moves = [];
    this.numPiecesRevealed = Array(origin.games.length).fill(0);
    this.checkpointInterval = checkpointInterval;
    this.maxCheckpoints = maxCheckpoints;
    if (this.maxCheckpoints < 0) {
      throw new Error('Max number of checkpoints must be non-negative');
    }
  }

  revealPieces(time: number): RevealedPiece[] {
    const numKnown = Array(this.origin.games.length).fill(0);
    for (const move of this.moves) {
      if (move.time < time) {
        numKnown[move.player]++;
      }
    }
    const game = this.warp(time);
    const result: RevealedPiece[] = [];
    for (let player = 0; player < game.games.length; ++player) {
      if (
        !game.games[player].busy &&
        this.numPiecesRevealed[player] <= numKnown[player]
      ) {
        result.push({
          player,
          time,
          piece: game.games[player].nextPiece,
        });
        if (this.numPiecesRevealed[player] < numKnown[player]) {
          throw new Error(
            'Can only reveal a single piece per player at a time'
          );
        }
        this.numPiecesRevealed[player] = numKnown[player] + 1;
      }
    }
    return result;
  }

  rejectMove(move: PlayedMove) {
    for (const existing of this.moves) {
      if (existing.time === move.time && existing.player === move.player) {
        return true;
      }
    }
    const game = this._warp(move.time);
    if (game === null) {
      return true;
    }
    return game.games[move.player].busy;
  }

  addMove(move: PlayedMove): PlayedMove[] {
    if (move.time < this.origin.age) {
      throw new Error('Cannot play prior to origin');
    }
    if (this.rejectMove(move)) {
      return [move];
    }
    this.moves.push(move);
    for (const time of [...this.checkpoints.keys()]) {
      if (time > move.time) {
        this.checkpoints.delete(time);
      }
    }
    const rejectedMoves: PlayedMove[] = [];
    let done = false;
    while (!done) {
      done = true;
      for (const futureMove of [...this.moves]) {
        // Sanity check. Shouldn't trigger.
        if (futureMove.time === move.time) {
          const game = this._warp(move.time);
          if (!game) {
            throw new Error('Retcon failed: New move validation');
          }
          if (game.games[futureMove.player].busy) {
            throw new Error('Retcon failed: Existing move validation');
          }
        }
        // Actual retcon
        if (futureMove.time > move.time) {
          const game = this._warp(futureMove.time);
          if (!game || game.games[futureMove.player].busy) {
            this.moves.splice(this.moves.indexOf(futureMove), 1);
            rejectedMoves.push(futureMove);
            done = false;
          }
        }
      }
    }
    return rejectedMoves;
  }

  _warp(time: number) {
    if (time < this.origin.age) {
      throw new Error('Cannot warp prior to origin');
    }
    if (this.checkpoints.has(time)) {
      return this.checkpoints.get(time)!.clone(true);
    }
    let game: T;
    if (this.checkpoints.has(time - 1)) {
      game = this.checkpoints.get(time - 1)!;
    } else {
      game = this.origin;
      for (const checkpoint of this.checkpoints.values()) {
        if (checkpoint.age <= time && checkpoint.age > game.age) {
          game = checkpoint;
        }
      }
    }
    if (game.age % this.checkpointInterval && game.age > this.origin.age) {
      // Use up temporary checkpoint.
      this.checkpoints.delete(game.age);
    } else {
      game = game.clone(true);
    }
    while (game.age < time) {
      for (const move of this.moves) {
        if (move.time === game.age) {
          if (game.games[move.player].busy) {
            // This should only happen during retcon. Never visible to the user.
            return null;
          }
          game.play(move.player, move.x1, move.y1, move.orientation);
        }
      }
      game.tick();
      // Scheduled checkpoint
      if (!(game.age % this.checkpointInterval)) {
        this.checkpoints.set(game.age, game.clone(true));
      }
    }
    // Temporary checkpoint
    if (game.age % this.checkpointInterval) {
      this.checkpoints.set(game.age, game.clone(true));
    }
    if (this.checkpoints.size > this.maxCheckpoints) {
      const times = [...this.checkpoints.keys()];
      times.sort((a, b) => b - a); // Inverse order for fast pops
      while (this.checkpoints.size > this.maxCheckpoints) {
        this.checkpoints.delete(times.pop()!);
      }
    }
    return game;
  }

  warp(time: number): T {
    const result = this._warp(time);
    if (result === null) {
      throw new Error('Time warping game in an inconsistent state');
    }
    return result;
  }
}

export class TimeWarpingMirror<T extends MultiplayerGame> {
  origin: T;
  moves: PlayedMove[][];
  bags: number[][];
  checkpoints: Map<number, T>;
  checkpointInterval: number;
  maxCheckpoints: number;
  seenTicks: number[];

  constructor(
    origin: T,
    initialBags: number[][],
    checkpointInterval = 10,
    maxCheckpoints = Infinity
  ) {
    this.origin = origin;
    this.checkpoints = new Map();
    this.moves = [[], []];
    this.bags = initialBags.map(b => [...b]);
    this.checkpointInterval = checkpointInterval;
    this.maxCheckpoints = maxCheckpoints;
    this.seenTicks = Array(origin.games.length).fill(origin.age);
  }

  // Moves may arrive in random order
  addMove(move: PlayedMove) {
    this.moves[move.player].push(move);
    for (const time of [...this.checkpoints.keys()]) {
      if (time > move.time) {
        this.checkpoints.delete(time);
      }
    }
    this.moves[move.player].sort((a, b) => a.time - b.time);
    this.seenTicks[move.player] = move.time;
  }

  // Moves may be removed in random order
  deleteMoves(moves: PlayedMove[]) {
    for (const move of moves) {
      // Can't just use this.moves.indexOf(move) because of server/client serialization
      for (let i = 0; i < this.moves[move.player].length; ++i) {
        if (this.moves[move.player][i].time === move.time) {
          this.moves[move.player].splice(i, 1);
          for (const time of [...this.checkpoints.keys()]) {
            if (time > move.time) {
              this.checkpoints.delete(time);
            }
          }
          break;
        }
      }
    }
  }

  // Pieces must arrive in definite order
  addPiece(piece: RevealedPiece) {
    piece.piece.forEach(color => this.bags[piece.player].push(color));
  }

  warp(time: number): [T | null, MultiplayerTickResult[]] {
    if (time < this.origin.age) {
      throw new Error('Cannot warp prior to origin');
    }
    if (this.checkpoints.has(time)) {
      return [this.checkpoints.get(time)!.clone(true), []];
    }
    let game: T;
    if (this.checkpoints.has(time - 1)) {
      game = this.checkpoints.get(time - 1)!;
    } else {
      game = this.origin;
      for (const checkpoint of this.checkpoints.values()) {
        if (checkpoint.age <= time && checkpoint.age > game.age) {
          game = checkpoint;
        }
      }
    }
    if (game.age % this.checkpointInterval && game.age > this.origin.age) {
      // Use up temporary checkpoint.
      this.checkpoints.delete(game.age);
    } else {
      game = game.clone(true);
    }

    const novelTicks = [];
    while (game.age < time) {
      for (let j = 0; j < this.moves.length; ++j) {
        for (let i = 0; i < this.moves[j].length; ++i) {
          const move = this.moves[j][i];
          if (move.time === game.age) {
            if (game.games[move.player].busy) {
              // Oh well, I hope the server retcons this soon...
              return [null, []];
            }
            // Perform quick surgery
            const piece = this.bags[j].slice(2 * i, 2 * i + 2);
            game.games[j].bag = piece;
            game.play(move.player, move.x1, move.y1, move.orientation);
          }
        }
      }
      const tickResults = game.tick();
      for (let i = 0; i < tickResults.length; ++i) {
        if (this.seenTicks[i] < game.age) {
          novelTicks.push(tickResults[i]);
          this.seenTicks[i] = game.age;
        }
      }
      // Scheduled checkpoint
      if (!(game.age % this.checkpointInterval)) {
        this.checkpoints.set(game.age, game.clone(true));
      }
    }

    // Temporary checkpoint
    if (game.age % this.checkpointInterval) {
      this.checkpoints.set(game.age, game.clone(true));
    }
    if (this.checkpoints.size > this.maxCheckpoints) {
      const times = [...this.checkpoints.keys()];
      times.sort((a, b) => b - a); // Inverse order for fast pops
      while (this.checkpoints.size > this.maxCheckpoints) {
        this.checkpoints.delete(times.pop()!);
      }
    }

    // Reconstruct true bag for planning/visualization purposes
    for (let i = 0; i < this.moves.length; ++i) {
      const numMovesPlayed = this.moves[i].filter(m => m.time < time).length;
      game.games[i].bag = this.bags[i].slice(2 * numMovesPlayed);
    }
    return [game, novelTicks];
  }
}
