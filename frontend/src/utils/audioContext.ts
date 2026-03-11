/**
 * Singleton Web Audio API context shared by Equalizer & Spectrum Visualizer.
 *
 * Lazily creates an AudioContext on first user gesture (Chrome autoplay policy).
 * Connects: MediaElementSource → EQ Filters → AnalyserNode → Destination
 */

// EQ band frequencies (Hz)
export const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

export interface AudioGraph {
  context: AudioContext;
  analyser: AnalyserNode;
  filters: BiquadFilterNode[];
  /** Call this whenever the Howl <audio> element changes (new track) */
  connectSource: (audioElement: HTMLMediaElement) => void;
}

let graph: AudioGraph | null = null;
let connectedElement: HTMLMediaElement | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;

export function getAudioGraph(): AudioGraph {
  if (graph) return graph;

  const context = new AudioContext();
  const analyser = context.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;

  // Create 10-band EQ
  const filters: BiquadFilterNode[] = EQ_BANDS.map((freq, i) => {
    const filter = context.createBiquadFilter();
    filter.type = i === 0 ? 'lowshelf' : i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking';
    filter.frequency.value = freq;
    filter.Q.value = 1.4;
    filter.gain.value = 0; // flat by default
    return filter;
  });

  // Chain filters: source → f0 → f1 → … → f9 → analyser → destination
  for (let i = 0; i < filters.length - 1; i++) {
    filters[i].connect(filters[i + 1]);
  }
  filters[filters.length - 1].connect(analyser);
  analyser.connect(context.destination);

  const connectSource = (audioElement: HTMLMediaElement) => {
    // Resume if suspended (Chrome autoplay policy)
    if (context.state === 'suspended') context.resume();

    // Don't reconnect the same element
    if (connectedElement === audioElement && sourceNode) return;

    // Disconnect old source
    if (sourceNode) {
      try { sourceNode.disconnect(); } catch { /* already disconnected */ }
    }

    try {
      sourceNode = context.createMediaElementSource(audioElement);
      sourceNode.connect(filters[0]);
      connectedElement = audioElement;
    } catch {
      // Element may already be connected to another context — ignore
    }
  };

  graph = { context, analyser, filters, connectSource };
  return graph;
}

/** Update EQ band gains (dB, range -12 to +12) */
export function setEQGains(gains: number[]): void {
  if (!graph) return;
  gains.forEach((gain, i) => {
    if (graph!.filters[i]) {
      graph!.filters[i].gain.value = gain;
    }
  });
}

/** Check if audio graph has been initialized */
export function isAudioGraphReady(): boolean {
  return graph !== null;
}

