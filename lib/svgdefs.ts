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
  let relative = false;
  let horizontal = true;
  d.replaceAll(',', ' ')
    .split(/\s+/)
    .forEach(token => {
      let num = parseFloat(token);
      if (isNaN(num)) {
        transformed.push(token);
        relative = false;
        horizontal = true;
        if (token.toUpperCase() === 'A') {
          scaleFlags = [...ARC_SCALE_FLAGS];
          translationFlags = [...ARC_TRANSLATION_FLAGS];
        } else if (token.toUpperCase() === 'V') {
          horizontal = false;
        }
        if (token !== 'm' && token === token.toLowerCase()) {
          relative = true;
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
        if (translationFlag && !relative) {
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

  const shadowFilter = svgElement('filter');
  shadowFilter.setAttribute('id', 'shadow');
  shadowFilter.setAttribute('width', '125%');
  shadowFilter.setAttribute('height', '130%');
  const dropShadow = svgElement('feDropShadow');
  dropShadow.setAttribute('dx', '0.03');
  dropShadow.setAttribute('dy', '0.05');
  dropShadow.setAttribute('stdDeviation', '0.03');
  shadowFilter.appendChild(dropShadow);
  defs.appendChild(shadowFilter);

  const stopDef = svgElement('rect');
  stopDef.setAttribute('id', 'stop');
  stopDef.setAttribute('x', '-0.2');
  stopDef.setAttribute('y', '-0.2');
  stopDef.setAttribute('width', '0.4');
  stopDef.setAttribute('height', '0.4');
  stopDef.setAttribute('fill', 'gray');
  defs.appendChild(stopDef);

  const recDef = svgElement('circle');
  recDef.setAttribute('id', 'rec');
  recDef.setAttribute('r', '0.2');
  recDef.setAttribute('fill', 'red');
  defs.appendChild(recDef);

  const playDef = svgElement('polygon');
  playDef.setAttribute('id', 'play');
  playDef.setAttribute('points', '-0.17,-0.2 0.17,0 -0.17,0.2');
  playDef.setAttribute('fill', 'lime');
  defs.appendChild(playDef);

  const pauseDef = svgElement('g');
  pauseDef.setAttribute('id', 'pause');
  const leftBar = svgElement('rect');
  leftBar.setAttribute('x', '-0.16');
  leftBar.setAttribute('y', '-0.2');
  leftBar.setAttribute('width', '0.11');
  leftBar.setAttribute('height', '0.4');
  pauseDef.appendChild(leftBar);
  const rightBar = svgElement('rect');
  rightBar.setAttribute('x', '0.06');
  rightBar.setAttribute('y', '-0.2');
  rightBar.setAttribute('width', '0.11');
  rightBar.setAttribute('height', '0.4');
  pauseDef.appendChild(rightBar);
  pauseDef.setAttribute('fill', 'lightgray');
  defs.appendChild(pauseDef);

  const logoDef = svgElement('g');
  logoDef.setAttribute('id', 'logo');

  const crescent = svgElement('path');
  const crescentD = 'M 0 0 A 1 1 0 1 1 0.9 0.8 A 0.8 0.8 0 1 0 0 0 z';
  crescent.setAttribute('d', transformPath(crescentD, 0.95, 0.05, 1.2));
  crescent.setAttribute('fill', 'goldenrod');
  logoDef.appendChild(crescent);

  const leaf = svgElement('g');
  const leafBody = svgElement('path');
  const leafBodyD =
    'M 95.475041,101.30591 C 80.828481,79.440826 71.382451,88.591836 56.704531,86.004596 c 2.92477,-1.03198 4.7018,-2.47636 6.31563,-2.95284 -1.426,-4.29393 -2.62952,-1.8623 -5.54008,-2.02377 1.26036,-2.70646 -3.24566,-1.33314 -6.11568,-0.99976 3.06824,-4.89796 6.92345,-2.27433 9.08064,-4.34038 -7.73865,-3.08276 -18.86406,-8.03653 -19.41956,-11.43155 1.98947,-0.002 2.62155,0.93495 4.39894,0.79981 -1.89868,-4.02329 -6.59425,-4.16468 -7.92738,-7.15182 0.85838,-0.1594 1.36744,-0.27273 2.03591,-0.55342 -1.02818,-1.76526 -3.7121,-1.00564 -3.49413,-4.62106 3.04571,1.05035 8.11103,5.73378 10.78526,4.71601 0.55342,-0.80569 -0.0645,-1.02402 -0.45847,-1.49253 2.85789,-1.8117 3.28758,8.10686 15.05493,10.70244 -1.52303,-3.48409 -2.79516,-1.72263 -3.83338,-7.85669 11.75731,2.49057 11.67966,5.3176 17.43009,12.25562 -2.37932,-5.43335 -0.45222,-3.62927 -2.04595,-7.24469 4.698,1.40382 15.45276,11.03961 14.63077,16.50103 3.7731,2.13882 9.32287,9.82569 9.12709,16.0547 0.36976,1.56321 0.7383,2.840194 -1.25412,4.940214 z';
  leafBody.setAttribute('d', transformPath(leafBodyD, 0.029, -0.99, -1.2));
  leafBody.setAttribute('fill', 'green');
  leaf.appendChild(leafBody);
  const leafVeins = svgElement('g');
  const leafVeinDs = [
    'm 96,98.328566 c -10.25056,-15.90605 -47.2233,-37.04343 -55.91861,-41.85059',
    'm 76.130461,73.090966 c 5.08994,4.52439 9.04878,13.85593 9.04878,13.85593',
    'm 61.638281,62.274846 c 6.78658,6.99867 9.19016,13.50248 9.19016,13.50248',
    'm 61.214111,78.534376 c 7.42283,0 16.47161,2.47427 16.47161,2.47427',
  ];
  leafVeinDs.forEach(d => {
    const leafVein = svgElement('path');
    leafVein.setAttribute('d', transformPath(d, 0.029, -0.99, -1.2));
    leafVeins.appendChild(leafVein);
  });
  leafVeins.setAttribute('fill', 'none');
  leafVeins.setAttribute('stroke', 'darkgreen');
  leafVeins.setAttribute('stroke-width', '0.04');
  leaf.appendChild(leafVeins);
  logoDef.appendChild(leaf);
  defs.appendChild(logoDef);

  const plainLogoDef = svgElement('g');
  plainLogoDef.setAttribute('id', 'plain-logo');
  const plainCrescent = svgElement('path');
  plainCrescent.setAttribute('d', crescent.getAttribute('d')!);
  plainLogoDef.appendChild(plainCrescent);
  const plainLeaf = svgElement('path');
  plainLeaf.setAttribute('d', leafBody.getAttribute('d')!);
  plainLogoDef.appendChild(plainLeaf);
  defs.appendChild(plainLogoDef);

  const blurDef = svgElement('filter');
  blurDef.setAttribute('id', 'blur');
  const gaussian = svgElement('feGaussianBlur');
  gaussian.setAttribute('in', 'SourceGraphic');
  gaussian.setAttribute('stdDeviation', '0.03');
  blurDef.appendChild(gaussian);
  defs.appendChild(blurDef);

  return svg;
}
