import { GOLDEN_SOUNDS, type GoldenSound } from "../data/sounds";

export interface PlaybackSnapshot {
  activeId: string;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  autoAdvance: boolean;
  muted: boolean;
  /** True when the tonearm is parked on its rest post rather than cued over a groove */
  stylusParked: boolean;
  /** True while the user is physically holding/lifting the needle in the air */
  stylusLifted: boolean;
  /** Current physical platter speed ratio (1.0 = 16⅔ RPM, 0 = stopped, < 0 = reverse scrub) */
  platterSpeed: number;
}

type Listener = (snap: PlaybackSnapshot) => void;

function disablePitchPreservation(el: HTMLAudioElement): void {
  const anyEl = el as HTMLAudioElement & {
    preservesPitch?: boolean;
    mozPreservesPitch?: boolean;
    webkitPreservesPitch?: boolean;
  };
  if ("preservesPitch" in anyEl) anyEl.preservesPitch = false;
  if ("webkitPreservesPitch" in anyEl) anyEl.webkitPreservesPitch = false;
  if ("mozPreservesPitch" in anyEl) anyEl.mozPreservesPitch = false;
}

class GoldenRecordAudioEngine {
  private audio: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private musicGain: GainNode | null = null;
  private vinylNoiseGain: GainNode | null = null;
  private vinylFilter: BiquadFilterNode | null = null;
  private vinylSourceStarted = false;
  private sourceCreated = false;
  private freqBuf = new Uint8Array(64);
  private listeners = new Set<Listener>();

  /** Tracks whether the turntable motor wants to play once finger platter-stall or needle-lift ends */
  private motorDesiredPlaying = false;
  private platterHeld = false;

  private state: PlaybackSnapshot = {
    activeId: GOLDEN_SOUNDS[0].id,
    isPlaying: false,
    isLoading: false,
    currentTime: 0,
    duration: GOLDEN_SOUNDS[0].durationSec,
    autoAdvance: true,
    muted: false,
    stylusParked: true,
    stylusLifted: false,
    platterSpeed: 0
  };

  private ensureAudio(): HTMLAudioElement {
    if (this.audio) return this.audio;
    const el = new Audio();
    el.preload = "metadata";
    el.crossOrigin = "anonymous";
    disablePitchPreservation(el);

    el.addEventListener("timeupdate", () => {
      this.patch({ currentTime: el.currentTime || 0 });
    });

    el.addEventListener("loadedmetadata", () => {
      disablePitchPreservation(el);
      if (Number.isFinite(el.duration) && el.duration > 0) {
        this.patch({ duration: el.duration, isLoading: false });
      }
    });

    el.addEventListener("playing", () => {
      disablePitchPreservation(el);
      if (!this.platterHeld) {
        this.patch({ isPlaying: true, isLoading: false });
      }
    });

    el.addEventListener("pause", () => {
      if (!el.ended && !this.platterHeld && !this.state.stylusLifted) {
        this.patch({ isPlaying: false });
      }
    });

    el.addEventListener("waiting", () => {
      this.patch({ isLoading: true });
    });

    el.addEventListener("canplay", () => {
      this.patch({ isLoading: false });
    });

    el.addEventListener("error", () => {
      const track = this.getTrackById(this.state.activeId);
      if (track.fallbackAudioSrc && el.src !== track.fallbackAudioSrc) {
        el.src = track.fallbackAudioSrc;
        disablePitchPreservation(el);
        if (this.motorDesiredPlaying && !this.state.stylusLifted) {
          void el.play().catch(() => {
            this.motorDesiredPlaying = false;
            this.patch({ isPlaying: false, isLoading: false });
          });
        }
      } else {
        this.patch({ isLoading: false });
      }
    });

    el.addEventListener("ended", () => {
      if (this.platterHeld) return;
      if (this.state.autoAdvance) {
        const idx = GOLDEN_SOUNDS.findIndex((s) => s.id === this.state.activeId);
        const next = GOLDEN_SOUNDS[(idx + 1) % GOLDEN_SOUNDS.length];
        void this.playTrack(next.id);
      } else {
        this.motorDesiredPlaying = false;
        this.patch({ isPlaying: false, currentTime: 0, stylusParked: true });
      }
    });

    this.audio = el;
    return el;
  }

  private ensureWebAudio(): void {
    const el = this.ensureAudio();
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === "suspended") {
        void this.ctx.resume();
      }

      if (!this.sourceCreated && this.ctx) {
        const src = this.ctx.createMediaElementSource(el);
        const musicGain = this.ctx.createGain();
        musicGain.gain.value = 1.0;

        const analyser = this.ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.8;

        src.connect(musicGain);
        musicGain.connect(analyser);
        analyser.connect(this.ctx.destination);

        this.musicGain = musicGain;
        this.analyser = analyser;
        this.freqBuf = new Uint8Array(analyser.frequencyBinCount);
        this.sourceCreated = true;
      }

      // Continuous procedural vinyl groove floor & back-cue friction synthesizer
      if (!this.vinylSourceStarted && this.ctx) {
        const sampleRate = this.ctx.sampleRate;
        const len = Math.floor(sampleRate * 2.4);
        const buf = this.ctx.createBuffer(1, len, sampleRate);
        const data = buf.getChannelData(0);
        let b0 = 0;
        let b1 = 0;
        let b2 = 0;
        let seed = 918273;
        const rand = () => {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          return seed / 4294967296;
        };
        for (let i = 0; i < len; i++) {
          const white = rand() * 2 - 1;
          b0 = 0.997 * b0 + white * 0.028;
          b1 = 0.985 * b1 + white * 0.045;
          b2 = 0.94 * b2 + white * 0.065;
          // Occasional microscopic gold-copper groove dust impulse
          const crackle = rand() > 0.99945 ? (rand() * 2 - 1) * 0.34 : 0;
          data[i] = b0 + b1 + b2 + crackle;
        }

        const noiseSrc = this.ctx.createBufferSource();
        noiseSrc.buffer = buf;
        noiseSrc.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 950;
        filter.Q.value = 0.85;

        const gain = this.ctx.createGain();
        gain.gain.value = 0;

        noiseSrc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noiseSrc.start();

        this.vinylFilter = filter;
        this.vinylNoiseGain = gain;
        this.vinylSourceStarted = true;
      }
    } catch {
      // Fallback: HTMLAudioElement still plays cleanly even if Web Audio graph is restricted
    }
  }

  /** Authentic analog cartridge touchdown resonance + stylus click when needle meets groove */
  triggerNeedleDrop(intensity = 1): void {
    this.ensureWebAudio();
    if (!this.ctx || this.state.muted) return;
    try {
      const now = this.ctx.currentTime;
      const clamped = Math.max(0.35, Math.min(1.4, intensity));

      // 1. Warm low-end cartridge suspension thump (64 Hz -> 27 Hz)
      const osc = this.ctx.createOscillator();
      const thumpGain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(64, now);
      osc.frequency.exponentialRampToValueAtTime(27, now + 0.075);

      thumpGain.gain.setValueAtTime(0.0001, now);
      thumpGain.gain.linearRampToValueAtTime(0.11 * clamped, now + 0.006);
      thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 165;

      osc.connect(lp);
      lp.connect(thumpGain);
      thumpGain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.095);

      // 2. Delicate diamond-stylus groove wall contact click
      const clickOsc = this.ctx.createOscillator();
      const clickGain = this.ctx.createGain();
      clickOsc.type = "sine";
      clickOsc.frequency.setValueAtTime(1650, now);
      clickOsc.frequency.exponentialRampToValueAtTime(420, now + 0.016);

      clickGain.gain.setValueAtTime(0.032 * clamped, now);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

      clickOsc.connect(clickGain);
      clickGain.connect(this.ctx.destination);
      clickOsc.start(now);
      clickOsc.stop(now + 0.02);
    } catch {
      // Ignore synthesis errors if audio context is still locked
    }
  }

  /** Subtle unweight click when lifting the stylus out of a groove */
  triggerNeedleLift(): void {
    this.ensureWebAudio();
    if (!this.ctx || this.state.muted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(1280, now + 0.014);
      g.gain.setValueAtTime(0.022, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.016);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.018);
    } catch {
      // Ignore
    }
  }

  private syncVinylSurfaceGain(speedRatio: number, scrubbing: boolean): void {
    if (!this.ctx || !this.vinylNoiseGain || !this.vinylFilter) return;
    const now = this.ctx.currentTime;
    const stylusEngaged =
      !this.state.stylusParked && !this.state.stylusLifted && !this.state.muted;
    const absSpeed = Math.abs(speedRatio);

    if (!stylusEngaged || absSpeed < 0.02) {
      this.vinylNoiseGain.gain.setTargetAtTime(0, now, 0.025);
      return;
    }

    const baseGain = scrubbing
      ? Math.min(0.065, 0.012 + absSpeed * 0.024)
      : Math.min(0.011, 0.007 * absSpeed);
    const cutoff = Math.min(3800, 420 + absSpeed * 1050);

    this.vinylFilter.frequency.setTargetAtTime(cutoff, now, 0.03);
    this.vinylNoiseGain.gain.setTargetAtTime(baseGain, now, 0.03);
  }

  private patch(partial: Partial<PlaybackSnapshot>): void {
    this.state = { ...this.state, ...partial };
    for (const fn of this.listeners) {
      fn(this.state);
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  getSnapshot(): PlaybackSnapshot {
    return this.state;
  }

  getTrackById(id: string): GoldenSound {
    return GOLDEN_SOUNDS.find((s) => s.id === id) ?? GOLDEN_SOUNDS[0];
  }

  async playTrack(id: string, intraBandRatio?: number, withNeedleDrop = false): Promise<void> {
    const track = this.getTrackById(id);
    const el = this.ensureAudio();
    this.ensureWebAudio();
    disablePitchPreservation(el);

    if (withNeedleDrop) {
      this.triggerNeedleDrop(1.0);
    }

    const isSame =
      this.state.activeId === track.id &&
      Boolean(el.src) &&
      (el.src === track.audioSrc ||
        el.src === track.fallbackAudioSrc ||
        el.src.endsWith(track.audioSrc));

    if (!isSame) {
      el.src = track.audioSrc;
      disablePitchPreservation(el);
      const startSec =
        typeof intraBandRatio === "number"
          ? Math.max(0, Math.min(0.96, intraBandRatio)) * track.durationSec
          : 0;
      el.currentTime = startSec;
      this.patch({
        activeId: track.id,
        currentTime: startSec,
        duration: track.durationSec,
        isLoading: true,
        stylusParked: false,
        stylusLifted: false
      });
    } else {
      if (typeof intraBandRatio === "number") {
        const dur =
          Number.isFinite(el.duration) && el.duration > 0 ? el.duration : track.durationSec;
        const targetSec = Math.max(0, Math.min(0.98, intraBandRatio)) * dur;
        el.currentTime = targetSec;
        this.patch({ currentTime: targetSec });
      }
      this.patch({ stylusParked: false, stylusLifted: false });
    }

    el.playbackRate = 1.0;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.02);
    }
    this.motorDesiredPlaying = true;

    try {
      await el.play();
      this.patch({ isPlaying: true, isLoading: false, platterSpeed: 1 });
      this.syncVinylSurfaceGain(1, false);
    } catch {
      this.motorDesiredPlaying = false;
      this.patch({ isPlaying: false, isLoading: false });
    }
  }

  async toggleTrack(id?: string): Promise<void> {
    const targetId = id ?? this.state.activeId;
    const el = this.ensureAudio();
    if (targetId === this.state.activeId && this.state.isPlaying && el.src) {
      this.motorDesiredPlaying = false;
      el.pause();
      this.patch({ isPlaying: false, platterSpeed: 0 });
      this.syncVinylSurfaceGain(0, false);
      return;
    }
    const wasParked = this.state.stylusParked;
    await this.playTrack(targetId, undefined, wasParked);
  }

  /** Called when the user physically grabs & lifts the tonearm headshell off the record */
  setStylusLifted(lifted: boolean): void {
    if (this.state.stylusLifted === lifted) return;
    const el = this.ensureAudio();
    this.ensureWebAudio();

    if (lifted) {
      this.triggerNeedleLift();
      if (!el.paused) {
        el.pause();
      }
      if (this.musicGain && this.ctx) {
        this.musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.012);
      }
      this.patch({ stylusLifted: true, stylusParked: false });
      this.syncVinylSurfaceGain(0, false);
    } else {
      this.patch({ stylusLifted: false });
    }
  }

  /** Called when user releases the dragged needle onto a specific groove & radial depth */
  dropStylusOnTrack(id: string, intraBandRatio: number): void {
    void this.playTrack(id, intraBandRatio, true);
  }

  /** Called when user drags the tonearm off the outer edge onto the tonearm rest post */
  parkStylus(): void {
    const el = this.ensureAudio();
    this.motorDesiredPlaying = false;
    el.pause();
    this.triggerNeedleLift();
    this.patch({
      isPlaying: false,
      stylusLifted: false,
      stylusParked: true,
      platterSpeed: 0
    });
    this.syncVinylSurfaceGain(0, false);
  }

  /**
   * Real-time physical platter speed coupling (1.0 = 16⅔ RPM forward).
   * Called each animation frame while the user holds/spins the platter or during motor spin-up/down.
   */
  updatePlatterMotion(speedRatio: number, isUserHoldingPlatter: boolean, dtSec: number): void {
    this.platterHeld = isUserHoldingPlatter;
    const el = this.audio;

    if (Math.abs(this.state.platterSpeed - speedRatio) > 0.02) {
      this.patch({ platterSpeed: speedRatio });
    }

    this.syncVinylSurfaceGain(speedRatio, isUserHoldingPlatter);

    if (!el || !el.src || this.state.stylusLifted || this.state.stylusParked) {
      return;
    }

    if (isUserHoldingPlatter) {
      if (speedRatio >= 0.08) {
        // Forward varispeed analog pitch + tempo bend
        const clampedRate = Math.min(2.75, Math.max(0.08, speedRatio));
        disablePitchPreservation(el);
        el.playbackRate = clampedRate;
        if (this.musicGain && this.ctx) {
          this.musicGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.02);
        }
        if (el.paused && this.motorDesiredPlaying) {
          void el.play().catch(() => {});
        }
      } else if (speedRatio < -0.03) {
        // Reverse platter spin: mute forward decoder & scrub currentTime backward at 16⅔ RPM
        if (!el.paused) {
          el.pause();
        }
        const dur =
          Number.isFinite(el.duration) && el.duration > 0 ? el.duration : this.state.duration;
        const nextT = Math.max(0, Math.min(dur, (el.currentTime || 0) + speedRatio * dtSec));
        el.currentTime = nextT;
        this.patch({ currentTime: nextT });
      } else {
        // Finger holding the platter stationary (stalled)
        if (!el.paused) {
          el.pause();
        }
      }
      return;
    }

    // Motor-driven spin-up / spin-down when finger is NOT holding the platter
    if (this.motorDesiredPlaying) {
      const clampedRate = Math.min(1.5, Math.max(0.12, speedRatio));
      disablePitchPreservation(el);
      if (Math.abs(el.playbackRate - clampedRate) > 0.004) {
        el.playbackRate = Math.abs(clampedRate - 1) < 0.012 ? 1.0 : clampedRate;
      }
      if (this.musicGain && this.ctx) {
        this.musicGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.025);
      }
      if (el.paused && speedRatio > 0.12) {
        void el.play().catch(() => {});
      }
    }
  }

  selectSilent(id: string): void {
    const track = this.getTrackById(id);
    const el = this.ensureAudio();
    if (this.state.isPlaying) {
      void this.playTrack(track.id);
      return;
    }
    el.pause();
    el.src = track.audioSrc;
    this.patch({
      activeId: track.id,
      currentTime: 0,
      duration: track.durationSec,
      isPlaying: false,
      isLoading: false,
      stylusParked: false
    });
  }

  stepTrack(delta: number): void {
    const idx = GOLDEN_SOUNDS.findIndex((s) => s.id === this.state.activeId);
    const nextIdx = (idx + delta + GOLDEN_SOUNDS.length) % GOLDEN_SOUNDS.length;
    const next = GOLDEN_SOUNDS[nextIdx];
    if (this.state.isPlaying) {
      void this.playTrack(next.id, undefined, true);
    } else {
      this.selectSilent(next.id);
    }
  }

  seek(ratio: number): void {
    const el = this.ensureAudio();
    const clamped = Math.max(0, Math.min(1, ratio));
    const dur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : this.state.duration;
    if (dur > 0) {
      const nextTime = clamped * dur;
      if (el.src) {
        el.currentTime = nextTime;
      }
      this.patch({ currentTime: nextTime, stylusParked: false });
    }
  }

  setAutoAdvance(enabled: boolean): void {
    this.patch({ autoAdvance: enabled });
  }

  toggleMute(): void {
    const el = this.ensureAudio();
    const nextMuted = !this.state.muted;
    el.muted = nextMuted;
    this.patch({ muted: nextMuted });
    this.syncVinylSurfaceGain(this.state.platterSpeed, this.platterHeld);
  }

  /** Populates normalized 0..1 spectrum bars; falls back to gentle harmonic motion if analyser unavailable */
  readSpectrum(out: Float32Array, timeSec: number): number {
    if (!this.state.isPlaying || this.state.stylusLifted) {
      out.fill(0.04);
      return 0;
    }

    if (this.analyser) {
      this.analyser.getByteFrequencyData(this.freqBuf);
      let sum = 0;
      const binCount = this.freqBuf.length;
      for (let i = 0; i < out.length; i++) {
        const srcIdx = Math.min(
          binCount - 1,
          Math.floor((i / out.length) * (binCount * 0.72))
        );
        const v = this.freqBuf[srcIdx] / 255;
        out[i] = Math.max(0.05, v);
        sum += v;
      }
      const avg = sum / out.length;
      if (avg > 0.01) return avg;
    }

    // Fallback procedural envelope if browser delays MediaElementSource tap
    let sum = 0;
    for (let i = 0; i < out.length; i++) {
      const wave =
        0.32 +
        0.22 * Math.sin(timeSec * 4.3 + i * 0.45) +
        0.15 * Math.cos(timeSec * 7.1 - i * 0.28);
      out[i] = Math.max(0.06, Math.min(0.95, wave));
      sum += out[i];
    }
    return sum / out.length;
  }
}

export const audioEngine = new GoldenRecordAudioEngine();
