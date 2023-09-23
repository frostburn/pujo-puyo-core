import {
  CONNECTS_DOWN,
  CONNECTS_LEFT,
  CONNECTS_RIGHT,
  CONNECTS_UP,
  VISIBLE_HEIGHT,
  WIDTH,
} from '../src';

const ARC_SCALE_FLAGS = [true, true, false, false, false, true, true];
const ARC_TRANSLATION_FLAGS = [false, false, false, false, false, true, true];

const SVG_NS = 'http://www.w3.org/2000/svg';

const SCREEN_STROKE = '#101';
const SCREEN_FILL = 'rgba(0, 0, 0, 0.1)';
const SCREEN_STROKE_WIDTH = '0.16';
const SCREEN_INNER_STROKE = '#112';
const SCREEN_INNER_STROKE_WIDTH = '0.06';
const SCREEN_INNER_DASHARRAY = '0.14 0.1 0.2 0.1';

/**
 * Transform <path> element's definition by first re-scaling it and then translating the points.
 * NOTE: Likely incomplete and pretty much untested.
 */
export function transformPath(d: string, scale = 1, dx = 0, dy = 0) {
  const transformed: string[] = [];
  let scaleFlags: boolean[] = [];
  let translationFlags: boolean[] = [];
  let horizontal = true;
  d.split(/\s+/).forEach(token => {
    let num = parseFloat(token);
    if (isNaN(num)) {
      transformed.push(token);
      horizontal = true;
      if (token.toUpperCase() === 'A') {
        scaleFlags = [...ARC_SCALE_FLAGS];
        translationFlags = [...ARC_TRANSLATION_FLAGS];
      } else if (token.toUpperCase() === 'V') {
        horizontal = false;
      }
      if (token === token.toLowerCase()) {
        translationFlags = Array(7).fill(false);
      }
    } else {
      let scaleFlag = true;
      let translationFlag = true;
      if (scaleFlags.length) {
        scaleFlag = scaleFlags.shift()!;
      }
      if (translationFlags.length) {
        translationFlag = translationFlags.shift()!;
      }
      if (scaleFlag) {
        num *= scale;
      }
      if (translationFlag) {
        num += horizontal ? dx : dy;
        horizontal = !horizontal;
      }
      transformed.push(num.toString());
    }
  });
  return transformed.join(' ');
}

export function svgElement(qualifiedName: string) {
  return document.createElementNS(SVG_NS, qualifiedName);
}

export function makeDefs() {
  const svg = svgElement('svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');

  const defs = svgElement('defs');
  svg.appendChild(defs);

  const fadeGradient = svgElement('linearGradient');
  fadeGradient.setAttribute('id', 'fade-gradient');
  fadeGradient.setAttribute('x1', '0');
  fadeGradient.setAttribute('y1', '0');
  fadeGradient.setAttribute('x2', '0');
  fadeGradient.setAttribute('y2', '1');
  const blackStop = svgElement('stop');
  blackStop.setAttribute('offset', '27%');
  blackStop.setAttribute('stop-color', '#000');
  fadeGradient.appendChild(blackStop);
  const whiteStop = svgElement('stop');
  whiteStop.setAttribute('offset', '75%');
  whiteStop.setAttribute('stop-color', '#fff');
  fadeGradient.appendChild(whiteStop);
  defs.appendChild(fadeGradient);

  const fadeMask = svgElement('mask');
  fadeMask.setAttribute('id', 'fade-mask');
  fadeMask.setAttribute('maskUnits', 'objectBoundingBox');
  fadeMask.setAttribute('maskContentUnits', 'objectBoundingBox');
  const fadeRect = svgElement('rect');
  fadeRect.setAttribute('x', '-1');
  fadeRect.setAttribute('width', '3');
  fadeRect.setAttribute('y', '-1');
  fadeRect.setAttribute('height', '3');
  fadeRect.setAttribute('fill', 'url(#fade-gradient');
  fadeMask.appendChild(fadeRect);
  defs.appendChild(fadeMask);

  const screenOutlineDef = svgElement('g');
  screenOutlineDef.setAttribute('id', 'screen-outline');

  const mainScreen = svgElement('rect');
  mainScreen.setAttribute('x', '-0.1');
  mainScreen.setAttribute('y', '-0.1');
  mainScreen.setAttribute('width', `${WIDTH + 0.2}`);
  mainScreen.setAttribute('height', `${VISIBLE_HEIGHT + 0.2}`);
  mainScreen.setAttribute('rx', '0.1');
  mainScreen.setAttribute('ry', '0.1');
  screenOutlineDef.appendChild(mainScreen);

  const pieceBox = svgElement('path');
  pieceBox.setAttribute(
    'd',
    'M -0.1 0 ' +
      'A 0.1 0.1 0 0 1 0 -0.1 ' +
      'H 1 ' +
      'A 0.1 0.1 0 0 1 1.1 0 ' +
      'V 2 ' +
      'A 0.1 0.1 0 0 0 1.2 2.1 ' +
      'H 1.5 ' +
      'A 0.1 0.1 0 0 1 1.6 2.2 ' +
      'V 4.2 ' +
      'A 0.1 0.1 0 0 1 1.5 4.3 ' +
      'H 0.5 ' +
      'A 0.1 0.1 0 0 1 0.4 4.2 ' +
      'V 2.2 ' +
      'A 0.1 0.1 0 0 0 0.3 2.1 ' +
      'H 0 ' +
      'A 0.1 0.1 0 0 1 -0.1 2 ' +
      'Z'
  );
  pieceBox.setAttribute('transform', `translate(${WIDTH + 0.5}, 0)`);
  screenOutlineDef.appendChild(pieceBox);

  defs.appendChild(screenOutlineDef);

  const screenDef = svgElement('g');
  screenDef.setAttribute('id', 'screen');

  const darkScreen = svgElement('use');
  darkScreen.setAttribute('href', '#screen-outline');
  darkScreen.setAttribute('fill', SCREEN_FILL);
  darkScreen.setAttribute('stroke', SCREEN_STROKE);
  darkScreen.setAttribute('stroke-width', SCREEN_STROKE_WIDTH);
  screenDef.appendChild(darkScreen);

  const lightDashes = svgElement('use');
  lightDashes.setAttribute('href', '#screen-outline');
  lightDashes.setAttribute('fill', 'none');
  lightDashes.setAttribute('stroke', SCREEN_INNER_STROKE);
  lightDashes.setAttribute('stroke-width', SCREEN_INNER_STROKE_WIDTH);
  lightDashes.setAttribute('stroke-dasharray', SCREEN_INNER_DASHARRAY);
  screenDef.appendChild(lightDashes);

  defs.appendChild(screenDef);

  const sparksDef = svgElement('g');
  sparksDef.setAttribute('id', 'sparks');
  for (let i = 0; i < 5; ++i) {
    const theta = (2 * Math.PI * i) / 5;
    const spark = svgElement('circle');
    spark.setAttribute('cx', `${Math.cos(theta) * 0.3}`);
    spark.setAttribute('cy', `${Math.sin(theta) * 0.3}`);
    spark.setAttribute('r', '0.1');
    sparksDef.appendChild(spark);
  }
  {
    const animation = svgElement('animateTransform');
    animation.setAttribute('attributeName', 'transform');
    animation.setAttribute('type', 'rotate');
    animation.setAttribute('from', '0');
    animation.setAttribute('to', '360');
    animation.setAttribute('dur', '3s');
    animation.setAttribute('repeatCount', 'indefinite');
    sparksDef.appendChild(animation);
  }
  defs.appendChild(sparksDef);

  // Garbage queue indicators
  const spadeDef = svgElement('path');
  spadeDef.setAttribute('id', 'spade');
  const spadeD =
    'M 0.3 0 ' +
    'Q 0 0.6 0.5 0.8 ' +
    'H -0.5 ' +
    'Q 0 0.6 -0.3 0 ' +
    'C -0.1 1 -1.8 0 0 -1 ' +
    'C 1.8 0 0.1 1 0.3 0 ' +
    'Z';
  spadeDef.setAttribute('d', transformPath(spadeD, 0.45));
  spadeDef.setAttribute('stroke-linejoin', 'round');
  defs.appendChild(spadeDef);

  const moonDef = svgElement('path');
  moonDef.setAttribute('id', 'moon');
  const moonD = 'M 0 1 A 1.1 1.1 0 1 0 0 -1 A 1.04 1.04 0 0 1 0 1 Z';
  moonDef.setAttribute('d', transformPath(moonD, 0.35, -0.25));
  defs.appendChild(moonDef);

  const diamondDef = svgElement('path');
  diamondDef.setAttribute('id', 'diamond');
  const diamondD =
    'M 0 1 Q 0.55 0.55 1 0 Q 0.55 -0.55 0 -1 Q -0.55 -0.55 -1 0 Q -0.55 0.55 0 1 Z';
  diamondDef.setAttribute('d', transformPath(diamondD, 0.4));
  defs.appendChild(diamondDef);

  const smallDef = svgElement('circle');
  smallDef.setAttribute('id', 'small');
  smallDef.setAttribute('r', '0.2');
  defs.appendChild(smallDef);

  const largeDef = svgElement('circle');
  largeDef.setAttribute('id', 'large');
  largeDef.setAttribute('r', '0.39');
  defs.appendChild(largeDef);

  const cometDef = svgElement('path');
  cometDef.setAttribute('id', 'comet');
  const cometD =
    'M 0 1 A 1 1 0 0 1 0 -1 L 2 -1 L 0.5 -0.5 L 2.5 -0.1 L 0.3 0.3 L 1 1 Z';
  cometDef.setAttribute('d', transformPath(cometD, 0.3, -0.15));
  cometDef.setAttribute('transform', 'rotate(-45)');
  defs.appendChild(cometDef);

  const starDef = svgElement('path');
  starDef.setAttribute('id', 'star');
  let starD = 'M 0 0.3';
  const spikeDelta = Math.PI / 5;
  for (let i = 1; i < 6; ++i) {
    const theta = (2 * Math.PI * i) / 5;
    const x1 = 0.7 * Math.sin(theta - spikeDelta);
    const y1 = 0.7 * Math.cos(theta - spikeDelta);
    const x = 0.3 * Math.sin(theta);
    const y = 0.3 * Math.cos(theta);
    starD += ` Q ${x1} ${y1} ${x} ${y}`;
  }
  starD += ' Z';
  starDef.setAttribute('d', starD);
  defs.appendChild(starDef);

  // Panels

  const squareClip = svgElement('clipPath');
  squareClip.setAttribute('id', 'square');
  const square = svgElement('rect');
  square.setAttribute('x', '-0.505');
  square.setAttribute('y', '-0.505');
  square.setAttribute('width', '1.1');
  square.setAttribute('height', '1.1');
  squareClip.appendChild(square);
  defs.appendChild(squareClip);

  for (let i = 0; i < 16; ++i) {
    const connectedDef = svgElement('polygon');
    connectedDef.setAttribute('id', `panel${i}`);

    let points = [
      [0.4, 0.3],
      [0.3, 0.4],
    ];
    if (i & CONNECTS_DOWN) {
      points = points.concat([
        [0.3, 0.6],
        [0.4, 0.7],
        [-0.4, 0.7],
        [-0.3, 0.6],
      ]);
    }
    points = points.concat([
      [-0.3, 0.4],
      [-0.4, 0.3],
    ]);
    if (i & CONNECTS_LEFT) {
      points = points.concat([
        [-0.6, 0.3],
        [-0.7, 0.4],
        [-0.7, -0.4],
        [-0.6, -0.3],
      ]);
    }
    points = points.concat([
      [-0.4, -0.3],
      [-0.3, -0.4],
    ]);
    if (i & CONNECTS_UP) {
      points = points.concat([
        [-0.3, -0.6],
        [-0.4, -0.7],
        [0.4, -0.7],
        [0.3, -0.6],
      ]);
    }
    points = points.concat([
      [0.3, -0.4],
      [0.4, -0.3],
    ]);
    if (i & CONNECTS_RIGHT) {
      points = points.concat([
        [0.6, -0.3],
        [0.7, -0.4],
        [0.7, 0.4],
        [0.6, 0.3],
      ]);
    }

    connectedDef.setAttribute(
      'points',
      points.map(pair => pair.join(',')).join(' ')
    );

    connectedDef.setAttribute('clip-path', 'url(#square)');

    defs.appendChild(connectedDef);
  }

  const garbageDef = svgElement('circle');
  garbageDef.setAttribute('id', 'garbage');
  garbageDef.setAttribute('r', '0.414');
  defs.appendChild(garbageDef);

  const jigglingGarbageDef = svgElement('ellipse');
  jigglingGarbageDef.setAttribute('id', 'jiggling-garbage');
  jigglingGarbageDef.setAttribute('rx', '0.39');
  jigglingGarbageDef.setAttribute('ry', '0.414');
  {
    const animation = svgElement('animate');
    animation.setAttribute('attributeName', 'rx');
    animation.setAttribute('values', '0.39;0.414;0.39');
    animation.setAttribute('dur', '0.25s');
    animation.setAttribute('repeatCount', 'indefinite');
    jigglingGarbageDef.appendChild(animation);
  }
  {
    const animation = svgElement('animate');
    animation.setAttribute('attributeName', 'ry');
    animation.setAttribute('values', '0.414;0.39;0.414');
    animation.setAttribute('dur', '0.25s');
    animation.setAttribute('repeatCount', 'indefinite');
    jigglingGarbageDef.appendChild(animation);
  }
  defs.appendChild(jigglingGarbageDef);

  // Panel identifiers
  const JIGGLE_DUR = '0.2s';
  const jiggleAnimation = svgElement('animate');
  jiggleAnimation.setAttribute('attributeName', 'y');
  jiggleAnimation.setAttribute('values', '-0.05;0.05;-0.05');
  jiggleAnimation.setAttribute('dur', JIGGLE_DUR);
  jiggleAnimation.setAttribute('repeatCount', 'indefinite');

  const heartDef = svgElement('path');
  heartDef.setAttribute('id', 'heart');
  const heartD = 'M 0 1 C 1.8 0 0 -1 0 0 C 0 -1 -1.8 0 0 1 Z';
  heartDef.setAttribute('d', transformPath(heartD, 0.3, -0.01, -0.07));
  defs.appendChild(heartDef);

  const jigglingHeartDef = svgElement('use');
  jigglingHeartDef.setAttribute('id', 'jiggling-heart');
  jigglingHeartDef.setAttribute('href', '#heart');
  jigglingHeartDef.appendChild(jiggleAnimation);
  defs.appendChild(jigglingHeartDef);

  const smallStarDef = svgElement('path');
  smallStarDef.setAttribute('id', 'small-star');
  smallStarDef.setAttribute('d', transformPath(starD, -0.6, 0, -0.015));
  defs.appendChild(smallStarDef);

  const jigglingStarDef = svgElement('use');
  jigglingStarDef.setAttribute('id', 'jiggling-star');
  jigglingStarDef.setAttribute('href', '#small-star');
  jigglingStarDef.appendChild(jiggleAnimation.cloneNode());
  defs.appendChild(jigglingStarDef);

  const smallCirleDef = svgElement('circle');
  smallCirleDef.setAttribute('id', 'small-circle');
  smallCirleDef.setAttribute('r', '0.2');
  defs.appendChild(smallCirleDef);

  const jigglingCircleDef = svgElement('use');
  jigglingCircleDef.setAttribute('id', 'jiggling-circle');
  jigglingCircleDef.setAttribute('href', '#small-circle');
  jigglingCircleDef.appendChild(jiggleAnimation.cloneNode());
  defs.appendChild(jigglingCircleDef);

  const smallMoonDef = svgElement('path');
  smallMoonDef.setAttribute('id', 'small-moon');
  smallMoonDef.setAttribute('d', transformPath(moonD, -0.21, 0.15));
  defs.appendChild(smallMoonDef);

  const jigglingMoonDef = svgElement('use');
  jigglingMoonDef.setAttribute('id', 'jiggling-moon');
  jigglingMoonDef.setAttribute('href', '#small-moon');
  jigglingMoonDef.appendChild(jiggleAnimation.cloneNode());
  defs.appendChild(jigglingMoonDef);

  const smallDiamondDef = svgElement('path');
  smallDiamondDef.setAttribute('id', 'small-diamond');
  smallDiamondDef.setAttribute('d', transformPath(diamondD, -0.24));
  defs.appendChild(smallDiamondDef);

  const jigglingDiamondDef = svgElement('use');
  jigglingDiamondDef.setAttribute('id', 'jiggling-diamond');
  jigglingDiamondDef.setAttribute('href', '#small-diamond');
  jigglingDiamondDef.appendChild(jiggleAnimation.cloneNode());
  defs.appendChild(jigglingDiamondDef);

  // This should be replaced with an animated fill once we have a grid of stable elements. See issue #10.
  const preIgnitionDef = svgElement('rect');
  preIgnitionDef.setAttribute('id', 'pre-ignition');
  preIgnitionDef.setAttribute('x', '0.03');
  preIgnitionDef.setAttribute('y', '0.03');
  preIgnitionDef.setAttribute('rx', '0.2');
  preIgnitionDef.setAttribute('ry', '0.2');
  preIgnitionDef.setAttribute('width', '0.94');
  preIgnitionDef.setAttribute('height', '0.94');
  preIgnitionDef.setAttribute('fill', 'white');
  preIgnitionDef.setAttribute('opacity', '0.5');
  {
    const animation = svgElement('animate');
    animation.setAttribute('attributeName', 'opacity');
    animation.setAttribute('values', '0;0.8;0');
    animation.setAttribute('dur', '1s');
    animation.setAttribute('repeatCount', 'indefinite');
    preIgnitionDef.appendChild(animation);
  }

  defs.appendChild(preIgnitionDef);

  return svg;
}
