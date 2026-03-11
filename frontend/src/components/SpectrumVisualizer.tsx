import React, { useRef, useEffect } from 'react';
import { isAudioGraphReady, getAudioGraph } from '../utils/audioContext';
import { usePlayerStore } from '../store/playerStore';
import './SpectrumVisualizer.css';

interface SpectrumVisualizerProps {
  width?: number;
  height?: number;
}

const SpectrumVisualizer: React.FC<SpectrumVisualizerProps> = ({ width = 280, height = 80 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isPlaying || !isAudioGraphReady()) {
      // Clear canvas when not playing
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { analyser } = getAudioGraph();
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barCount = Math.min(bufferLength, 64);
      const barWidth = canvas.width / barCount;
      const gap = 1;

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i] / 255;
        const barHeight = value * canvas.height * 0.9;

        // Gradient from primary to accent color
        const hue = 240 + (i / barCount) * 60; // blue → purple
        const alpha = 0.4 + value * 0.6;
        ctx.fillStyle = `hsla(${hue}, 70%, 65%, ${alpha})`;

        const x = i * barWidth + gap;
        const y = canvas.height - barHeight;
        const w = Math.max(barWidth - gap * 2, 1);

        // Rounded top bars
        const radius = Math.min(w / 2, 3);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, canvas.height);
        ctx.lineTo(x, canvas.height);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.fill();
      }
    };

    draw();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="spectrum-visualizer"
    />
  );
};

export default SpectrumVisualizer;

