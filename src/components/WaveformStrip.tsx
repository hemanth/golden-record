import { useEffect, useRef, type MouseEvent } from "react";
import { audioEngine } from "../lib/audioEngine";

interface WaveformStripProps {
  isPlaying: boolean;
  progress: number;
  accentColor: string;
  trackBg: string;
  onSeek: (ratio: number) => void;
}

const BAR_COUNT = 44;

export function WaveformStrip({
  isPlaying,
  progress,
  accentColor,
  trackBg,
  onSeek
}: WaveformStripProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ isPlaying, progress, accentColor, trackBg });
  stateRef.current = { isPlaying, progress, accentColor, trackBg };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bins = new Float32Array(BAR_COUNT);
    const smooth = new Float32Array(BAR_COUNT).fill(0.14);
    let raf = 0;
    const start = performance.now();

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth || 280;
      const h = canvas.clientHeight || 42;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const { isPlaying: playing, progress: prog, accentColor: ink } = stateRef.current;
      const tSec = (performance.now() - start) / 1000;
      audioEngine.readSpectrum(bins, tSec);

      const gap = 3;
      const barW = Math.max(2, (w - gap * (BAR_COUNT - 1)) / BAR_COUNT);

      for (let i = 0; i < BAR_COUNT; i++) {
        // Deterministic baseline contour when paused so scrubber always looks refined
        const restHeight = 0.18 + 0.22 * Math.abs(Math.sin(i * 0.53 + 0.9));
        const target = playing ? Math.max(0.12, bins[i] * 0.92) : restHeight;
        smooth[i] += (target - smooth[i]) * 0.2;

        const bh = Math.max(4, smooth[i] * (h - 6));
        const x = i * (barW + gap);
        const y = (h - bh) * 0.5;
        const passed = i / BAR_COUNT <= prog;

        ctx.fillStyle = passed ? ink : "rgba(38, 36, 33, 0.15)";
        ctx.beginPath();
        ctx.roundRect(x, y, barW, bh, 1.5);
        ctx.fill();
      }
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(1, ratio)));
  };

  return (
    <div
      className="waveform-scrubber"
      style={{ backgroundColor: trackBg }}
      onClick={handleClick}
      role="slider"
      tabIndex={0}
      aria-label="Seek within current Golden Record sound"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          onSeek(Math.min(1, progress + 0.08));
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          onSeek(Math.max(0, progress - 0.08));
        }
      }}
    >
      <canvas ref={canvasRef} className="waveform-canvas" />
    </div>
  );
}
