export function createSoftSquare(
  context: AudioContext,
  decay = 0.08,
  evens = 0.3,
  evensDecay = 0.1
) {
  const real = [0];
  const imag = [0];
  for (let i = 1; i < 256; ++i) {
    real.push(0);
    if (i % 2 === 1) {
      // Odd harmonics that decay slightly faster than those of the straight square wave.
      imag.push(Math.exp(-i * decay) / i);
    } else {
      // Add some interest in the even harmonics too.
      imag.push(evens * Math.exp(-i * i * evensDecay));
    }
  }
  const harmonics = context.createPeriodicWave(real, imag);
  const result = context.createOscillator();
  result.setPeriodicWave(harmonics);
  return result;
}

export function edArpeggio(
  notes: number[],
  divisions = 12,
  equave = 2,
  baseFrequency = 440
) {
  return notes.map(note => baseFrequency * Math.pow(equave, note / divisions));
}

export function arpegiate(
  oscillator: OscillatorNode,
  frequencies: number[],
  startTime: number,
  endTime: number,
  noteDuration = 0.05,
  glideDuration = 0.001
): void {
  const holdDuration = noteDuration - glideDuration;
  let index = 0;
  oscillator.frequency.setValueAtTime(frequencies[index], startTime);
  while (startTime < endTime) {
    startTime += holdDuration;
    oscillator.frequency.setValueAtTime(frequencies[index], startTime);
    index = (index + 1) % frequencies.length;
    startTime += glideDuration;
    oscillator.frequency.linearRampToValueAtTime(frequencies[index], startTime);
  }
}

// Simple feedback loop bouncing sound between left and right channels.
export class PingPongDelay {
  audioContext: AudioContext;
  delayL: DelayNode;
  delayR: DelayNode;
  gainL: GainNode;
  gainR: GainNode;
  panL: StereoPannerNode;
  panR: StereoPannerNode;
  destination: AudioNode;

  constructor(audioContext: AudioContext, maxDelayTime = 5) {
    this.audioContext = audioContext;
    this.delayL = audioContext.createDelay(maxDelayTime);
    this.delayR = audioContext.createDelay(maxDelayTime);
    this.gainL = audioContext.createGain();
    this.gainR = audioContext.createGain();
    this.panL = audioContext.createStereoPanner();
    this.panR = audioContext.createStereoPanner();

    // Create a feedback loop with a gain stage.
    this.delayL
      .connect(this.gainL)
      .connect(this.delayR)
      .connect(this.gainR)
      .connect(this.delayL);
    // Tap outputs.
    this.gainL.connect(this.panL);
    this.gainR.connect(this.panR);

    // Tag input.
    this.destination = this.delayL;
  }

  set delayTime(value: number) {
    const now = this.audioContext.currentTime;
    this.delayL.delayTime.setValueAtTime(value, now);
    this.delayR.delayTime.setValueAtTime(value, now);
  }

  set feedback(value: number) {
    const now = this.audioContext.currentTime;
    this.gainL.gain.setValueAtTime(value, now);
    this.gainR.gain.setValueAtTime(value, now);
  }

  set separation(value: number) {
    const now = this.audioContext.currentTime;
    this.panL.pan.setValueAtTime(-value, now);
    this.panR.pan.setValueAtTime(value, now);
  }

  connect(destination: AudioNode) {
    this.panL.connect(destination);
    this.panR.connect(destination);
    return destination;
  }

  disconnect(destination: AudioNode) {
    this.panL.disconnect(destination);
    this.panR.disconnect(destination);
    return destination;
  }
}
