import {PuyoScreen, SimplePuyoScreen} from '../screen';

export function simpleFromLines(lines: string[]) {
  return SimplePuyoScreen.fromLines(lines, 0, {clearThreshold: 4});
}

export function screenFromLines(lines: string[]) {
  return PuyoScreen.fromLines(lines, 0, {clearThreshold: 4});
}
