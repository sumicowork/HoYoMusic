import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setEQGains } from '../utils/audioContext';

export interface EQPreset {
  name: string;
  label: string;
  gains: number[];
}

export const EQ_PRESETS: EQPreset[] = [
  { name: 'flat',       label: '平坦',     gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'bass',       label: '重低音',   gains: [8, 6, 4, 2, 0, 0, 0, 0, 0, 0] },
  { name: 'treble',     label: '高音增强', gains: [0, 0, 0, 0, 0, 0, 2, 4, 6, 8] },
  { name: 'vocal',      label: '人声',     gains: [-2, -1, 0, 3, 5, 5, 3, 0, -1, -2] },
  { name: 'rock',       label: '摇滚',     gains: [5, 3, 0, -2, -3, -2, 0, 3, 5, 6] },
  { name: 'electronic', label: '电子',     gains: [6, 5, 2, 0, -2, 0, 2, 5, 6, 6] },
  { name: 'classical',  label: '古典',     gains: [0, 0, 0, 0, 0, 0, -2, -3, -3, -5] },
  { name: 'jazz',       label: '爵士',     gains: [3, 2, 0, 2, -2, -2, 0, 2, 3, 4] },
  { name: 'pop',        label: '流行',     gains: [-1, 2, 4, 5, 3, 0, -1, -1, 2, 3] },
  { name: 'acoustic',   label: '原声',     gains: [3, 3, 2, 0, 1, 1, 2, 3, 2, 0] },
];

interface EqualizerState {
  enabled: boolean;
  presetName: string;
  gains: number[]; // 10 bands, dB (-12 to +12)
  setEnabled: (enabled: boolean) => void;
  setPreset: (name: string) => void;
  setGain: (bandIndex: number, value: number) => void;
  setGains: (gains: number[]) => void;
}

export const useEqualizerStore = create<EqualizerState>()(
  persist(
    (set, get) => ({
      enabled: false,
      presetName: 'flat',
      gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],

      setEnabled: (enabled) => {
        set({ enabled });
        if (enabled) {
          setEQGains(get().gains);
        } else {
          setEQGains([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        }
      },

      setPreset: (name) => {
        const preset = EQ_PRESETS.find((p) => p.name === name);
        if (!preset) return;
        set({ presetName: name, gains: [...preset.gains] });
        if (get().enabled) {
          setEQGains(preset.gains);
        }
      },

      setGain: (bandIndex, value) => {
        const gains = [...get().gains];
        gains[bandIndex] = value;
        set({ gains, presetName: 'custom' });
        if (get().enabled) {
          setEQGains(gains);
        }
      },

      setGains: (gains) => {
        set({ gains: [...gains] });
        if (get().enabled) {
          setEQGains(gains);
        }
      },
    }),
    {
      name: 'hoyomusic-equalizer',
      partialize: (state) => ({
        enabled: state.enabled,
        presetName: state.presetName,
        gains: state.gains,
      }),
    }
  )
);


