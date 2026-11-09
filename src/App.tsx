import { useEffect, useMemo, useRef, useState } from "react";
import {
  COVER_DIAGRAMS,
  EARTH_SOUNDS,
  GOLDEN_SOUNDS,
  MUSIC_SOUNDS,
  RING_CHAPTERS,
  type CoverDiagramRegion,
  type PlateMode
} from "./data/sounds";
import { audioEngine, type PlaybackSnapshot } from "./lib/audioEngine";
import {
  RecordPlateScene,
  type CameraPreset
} from "./components/RecordPlateScene";
import { VectorGlyph } from "./components/VectorGlyph";

function formatClock(sec: number): string {
  const safe = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Normalize country label to its primary NASA table Country of origin for quick filtering */
function baseCountryName(country: string): string {
  const idx = country.indexOf(" · ");
  return idx >= 0 ? country.slice(0, idx) : country;
}

export function App() {
  const [snap, setSnap] = useState<PlaybackSnapshot>(() => audioEngine.getSnapshot());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [plateMode, setPlateMode] = useState<PlateMode>("music");
  const [activeDiagramId, setActiveDiagramId] = useState<string | null>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>("studio");
  const [bandNoticeFresh, setBandNoticeFresh] = useState(false);
  const [indexOpen, setIndexOpen] = useState(false);
  const [countryFilter, setCountryFilter] = useState<string>("All");
  const noticeTimerRef = useRef<number | null>(null);
  const bottomAreaRef = useRef<HTMLDivElement | null>(null);
  const prevActiveIdRef = useRef<string>(snap.activeId);

  const pulseNotice = () => {
    setBandNoticeFresh(true);
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setBandNoticeFresh(false);
    }, 4200);
  };

  useEffect(() => {
    return audioEngine.subscribe((next) => {
      setSnap((prev) => {
        if (prev.activeId !== next.activeId || (!prev.isPlaying && next.isPlaying)) {
          pulseNotice();
        }
        return next;
      });
    });
  }, []);

  // Automatically sync LP side (music <-> sounds) when stepping/auto-advancing across sides
  useEffect(() => {
    if (prevActiveIdRef.current === snap.activeId) return;
    prevActiveIdRef.current = snap.activeId;
    const nextTrack = GOLDEN_SOUNDS.find((s) => s.id === snap.activeId);
    if (!nextTrack) return;
    setPlateMode((cur) => {
      if (cur === "cover") return cur;
      return nextTrack.side !== cur ? nextTrack.side : cur;
    });
  }, [snap.activeId]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    };
  }, []);

  // Close compact groove popover on outside click
  useEffect(() => {
    if (!indexOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (
        bottomAreaRef.current &&
        !bottomAreaRef.current.contains(e.target as Node)
      ) {
        setIndexOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [indexOpen]);

  // Keyboard shortcuts: Space (Play/Pause), [ / ] or Left / Right (Prev/Next), F (Flip Cover), I (Index), Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Escape") {
        setIndexOpen(false);
        return;
      }
      if (e.code === "Space" && tag !== "BUTTON" && tag !== "A") {
        e.preventDefault();
        pulseNotice();
        void audioEngine.toggleTrack();
      } else if (e.key === "[" || e.key === "ArrowLeft") {
        e.preventDefault();
        pulseNotice();
        audioEngine.stepTrack(-1);
      } else if (e.key === "]" || e.key === "ArrowRight") {
        e.preventDefault();
        pulseNotice();
        audioEngine.stepTrack(1);
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setPlateMode((prev) => (prev === "cover" ? "music" : "cover"));
      } else if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        setIndexOpen((prev) => !prev);
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        audioEngine.toggleMute();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Deep-link hash cueing (#cover, #sounds, or #<band-id>) + WebMCP runtime bridge
  useEffect(() => {
    const applyHash = () => {
      const raw = decodeURIComponent(window.location.hash.replace(/^#/, "").trim());
      if (!raw) return;
      if (raw === "cover" || raw === "music" || raw === "sounds") {
        setPlateMode(raw);
        return;
      }
      const diag = COVER_DIAGRAMS.find(
        (d) => d.id === raw || d.code.toLowerCase() === raw.toLowerCase()
      );
      if (diag) {
        setPlateMode("cover");
        setActiveDiagramId(diag.id);
        audioEngine.selectSilent(diag.soundId);
        pulseNotice();
        return;
      }
      const match = GOLDEN_SOUNDS.find(
        (s) => s.id === raw || s.code.toLowerCase() === raw.toLowerCase()
      );
      if (match) {
        setPlateMode(match.side);
        setActiveDiagramId(null);
        prevActiveIdRef.current = match.id;
        audioEngine.selectSilent(match.id);
        pulseNotice();
      }
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);

    type WebMcpBridge = {
      search: (args?: {
        query?: string;
        side?: string;
        country?: string;
        limit?: number;
      }) => unknown;
      playGroove: (args: { id: string; intraBandRatio?: number }) => unknown;
      setSide: (args: { side: PlateMode }) => unknown;
      parkStylus: () => unknown;
    };

    const win = window as Window & { __goldenRecordWebMcp?: WebMcpBridge };
    win.__goldenRecordWebMcp = {
      search: (args = {}) => {
        const q = (args.query ?? "").trim().toLowerCase();
        const side = args.side ?? "all";
        const country = (args.country ?? "").trim().toLowerCase();
        const limit = Math.max(1, Math.min(48, Number(args.limit) || 20));
        const matches = GOLDEN_SOUNDS.filter((s) => {
          if (side === "music" || side === "sounds") {
            if (s.side !== side) return false;
          }
          if (country && !s.country.toLowerCase().includes(country)) return false;
          if (!q) return true;
          return (
            s.id.toLowerCase().includes(q) ||
            s.code.toLowerCase() === q ||
            s.title.toLowerCase().includes(q) ||
            s.country.toLowerCase().includes(q) ||
            s.artist.toLowerCase().includes(q) ||
            s.summary.toLowerCase().includes(q)
          );
        }).slice(0, limit);
        return {
          count: matches.length,
          results: matches.map((s) => ({
            id: s.id,
            side: s.side,
            code: s.code,
            title: s.title,
            country: s.country,
            artist: s.artist,
            radiusMm: s.radiusMm,
            durationSec: s.durationSec,
            durationLabel: s.durationLabel,
            url: `https://h3manth.com/fun/golden-record/#${s.id}`
          }))
        };
      },
      playGroove: ({ id, intraBandRatio }) => {
        const target = GOLDEN_SOUNDS.find(
          (s) => s.id === id || s.code.toLowerCase() === String(id).toLowerCase()
        );
        if (!target) return { error: `Unknown groove id: ${id}` };
        setPlateMode(target.side);
        setActiveDiagramId(null);
        prevActiveIdRef.current = target.id;
        pulseNotice();
        const ratio =
          typeof intraBandRatio === "number"
            ? Math.max(0, Math.min(0.96, intraBandRatio))
            : 0;
        audioEngine.dropStylusOnTrack(target.id, ratio);
        return {
          playing: target.id,
          title: target.title,
          country: target.country,
          side: target.side,
          cuedAtSec: Math.round(ratio * target.durationSec)
        };
      },
      setSide: ({ side }) => {
        if (side !== "music" && side !== "sounds" && side !== "cover") {
          return { error: "side must be 'music', 'sounds', or 'cover'" };
        }
        setPlateMode(side);
        pulseNotice();
        return { plateMode: side };
      },
      parkStylus: () => {
        pulseNotice();
        audioEngine.parkStylus();
        return { stylusParked: true, platterSpeed: 0 };
      }
    };

    return () => {
      window.removeEventListener("hashchange", applyHash);
      delete win.__goldenRecordWebMcp;
    };
  }, []);

  const activeSound = useMemo(
    () => GOLDEN_SOUNDS.find((s) => s.id === snap.activeId) ?? GOLDEN_SOUNDS[0],
    [snap.activeId]
  );

  const activeRing = RING_CHAPTERS[activeSound.ring];

  const activeDiagram = useMemo(
    () =>
      activeDiagramId
        ? (COVER_DIAGRAMS.find((d) => d.id === activeDiagramId) ?? null)
        : null,
    [activeDiagramId]
  );

  const progress =
    snap.duration > 0 ? Math.min(1, Math.max(0, snap.currentTime / snap.duration)) : 0;

  const handleModeSwitch = (nextMode: PlateMode) => {
    setPlateMode(nextMode);
    setCountryFilter("All");
    if (nextMode === "music" || nextMode === "sounds") {
      setActiveDiagramId(null);
      if (!snap.isPlaying && activeSound.side !== nextMode) {
        const first = nextMode === "music" ? MUSIC_SOUNDS[0] : EARTH_SOUNDS[0];
        prevActiveIdRef.current = first.id;
        audioEngine.selectSilent(first.id);
        pulseNotice();
      }
    }
  };

  const handleSectorSelect = (id: string) => {
    setActiveDiagramId(null);
    setIndexOpen(false);
    pulseNotice();
    if (id === snap.activeId && !snap.stylusParked) {
      void audioEngine.toggleTrack(id);
    } else {
      void audioEngine.playTrack(id, undefined, true);
    }
  };

  const handleDropStylus = (id: string, intraBandRatio: number) => {
    setActiveDiagramId(null);
    setIndexOpen(false);
    pulseNotice();
    audioEngine.dropStylusOnTrack(id, intraBandRatio);
  };

  const handleParkStylus = () => {
    pulseNotice();
    audioEngine.parkStylus();
  };

  const handleDiagramSelect = (diagram: CoverDiagramRegion) => {
    setActiveDiagramId(diagram.id);
    setIndexOpen(false);
    pulseNotice();
    void audioEngine.playTrack(diagram.soundId, undefined, true);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    audioEngine.seek(Math.max(0, Math.min(1, ratio)));
  };

  // Determine which side's bands to show in the optional compact index popover
  const popoverSide: "music" | "sounds" =
    plateMode === "sounds" ? "sounds" : plateMode === "music" ? "music" : activeSound.side;
  const sideBands = popoverSide === "music" ? MUSIC_SOUNDS : EARTH_SOUNDS;

  const uniqueCountries = useMemo(() => {
    if (popoverSide !== "music") return [];
    const seen = new Set<string>();
    const list: string[] = [];
    for (const s of MUSIC_SOUNDS) {
      const base = baseCountryName(s.country);
      if (!seen.has(base)) {
        seen.add(base);
        list.push(base);
      }
    }
    return list;
  }, [popoverSide]);

  const filteredBands = useMemo(() => {
    if (popoverSide !== "music" || countryFilter === "All") return sideBands;
    return sideBands.filter((s) => baseCountryName(s.country) === countryFilter);
  }, [popoverSide, sideBands, countryFilter]);

  const subtitleLine = snap.stylusLifted
    ? "Stylus lifted · Drop onto any gold groove to play"
    : plateMode === "cover" && activeDiagram
      ? `Cover ${activeDiagram.code} · ${activeDiagram.title}`
      : snap.stylusParked && !snap.isPlaying
        ? `${activeSound.artist} · Drag needle or tap groove`
        : `${activeSound.artist} · ${activeSound.radiusMm} mm groove`;

  const renderSidePills = (extraClass: string) => (
    <div
      className={`hud-pill-group ${extraClass}`}
      role="group"
      aria-label="Golden Record side"
    >
      <button
        type="button"
        className={`hud-pill ${plateMode === "music" ? "is-on" : ""}`}
        onClick={() => handleModeSwitch("music")}
        aria-pressed={plateMode === "music"}
        title="Side 1: All 27 Music from Earth tracks across 19 countries"
      >
        Music · 27
      </button>
      <button
        type="button"
        className={`hud-pill ${plateMode === "sounds" ? "is-on" : ""}`}
        onClick={() => handleModeSwitch("sounds")}
        aria-pressed={plateMode === "sounds"}
        title="Side 2: Greetings in 55 Languages & 19 Sounds of Earth"
      >
        Sounds · 21
      </button>
      <button
        type="button"
        className={`hud-pill ${plateMode === "cover" ? "is-on" : ""}`}
        onClick={() => handleModeSwitch("cover")}
        aria-pressed={plateMode === "cover"}
        title="Engraved 24k Gold Cover Plate"
      >
        Cover
      </button>
    </div>
  );

  return (
    <main className="fullscreen-stage" aria-label="NASA Voyager Golden Record 3D Player">
      <div className="pastel-atmosphere" aria-hidden="true" />

      {/* Fullscreen Three.js 24k Gold Record & Cover Plate */}
      <RecordPlateScene
        activeId={snap.activeId}
        hoveredId={hoveredId}
        isPlaying={snap.isPlaying}
        stylusParked={snap.stylusParked}
        progress={progress}
        plateMode={plateMode}
        activeDiagramId={activeDiagramId}
        cameraPreset={cameraPreset}
        spinLocked={false}
        onHoverSector={setHoveredId}
        onSelectSector={handleSectorSelect}
        onDropStylus={handleDropStylus}
        onParkStylus={handleParkStylus}
        onSelectDiagram={handleDiagramSelect}
        onToggleCenterPlay={() => {
          pulseNotice();
          void audioEngine.toggleTrack();
        }}
      />

      {/* Minimalist Single-Line Whisper Top Bar */}
      <header className="hud-top">
        <a
          className="hud-wordmark"
          href="https://science.nasa.gov/mission/voyager/golden-record-contents/sounds/"
          target="_blank"
          rel="noreferrer"
          title="NASA Voyager Golden Record — Music & Sounds of Earth Archive"
        >
          <span className="hud-serif">Golden Record</span>
          <span className="hud-mono">VOYAGER · 1977</span>
        </a>

        <div className="hud-controls">
          {renderSidePills("hud-side-desktop")}

          <div className="hud-pill-group" role="group" aria-label="Camera angle">
            <button
              type="button"
              className={`hud-pill ${cameraPreset === "studio" ? "is-on" : ""}`}
              onClick={() => setCameraPreset("studio")}
              aria-pressed={cameraPreset === "studio"}
            >
              Tilt
            </button>
            <button
              type="button"
              className={`hud-pill ${cameraPreset === "overhead" ? "is-on" : ""}`}
              onClick={() => setCameraPreset("overhead")}
              aria-pressed={cameraPreset === "overhead"}
            >
              Top
            </button>
          </div>
        </div>
      </header>

      {/* Subtle Bottom Band Info Whisper + Thumb-Zone Switcher + Country Popover */}
      <div className="hud-bottom" ref={bottomAreaRef} aria-live="polite">
        {indexOpen ? (
          <section
            className="groove-popover"
            aria-label={
              popoverSide === "music"
                ? "Music from Earth — All 19 Countries & 27 Grooves"
                : "Greetings in 55 Languages & Sounds of Earth — 21 Grooves"
            }
          >
            <div className="groove-popover-head">
              <span className="groove-popover-eyebrow">
                {popoverSide === "music"
                  ? `${uniqueCountries.length} COUNTRIES · 27 GROOVES`
                  : "55 LANGUAGES & 19 SOUNDS"}
              </span>

              <div className="groove-side-mini">
                <button
                  type="button"
                  className={`mini-tab ${popoverSide === "music" ? "is-on" : ""}`}
                  onClick={() => handleModeSwitch("music")}
                >
                  Music · 27
                </button>
                <button
                  type="button"
                  className={`mini-tab ${popoverSide === "sounds" ? "is-on" : ""}`}
                  onClick={() => handleModeSwitch("sounds")}
                >
                  Sounds · 21
                </button>
                <button
                  type="button"
                  className="mini-close-btn"
                  onClick={() => setIndexOpen(false)}
                  aria-label="Close groove index"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            {popoverSide === "music" && (
              <div className="country-chip-rail" role="tablist" aria-label="Filter by country">
                <button
                  type="button"
                  className={`country-chip ${countryFilter === "All" ? "is-on" : ""}`}
                  onClick={() => setCountryFilter("All")}
                >
                  All 19
                </button>
                {uniqueCountries.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`country-chip ${countryFilter === c ? "is-on" : ""}`}
                    onClick={() => setCountryFilter(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}

            <div className="groove-popover-list">
              {filteredBands.map((band) => {
                const isSelected = band.id === activeSound.id;
                const rMeta = RING_CHAPTERS[band.ring];
                return (
                  <button
                    key={band.id}
                    type="button"
                    className={`groove-row ${isSelected ? "is-active" : ""}`}
                    onMouseEnter={() => setHoveredId(band.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => {
                      if (plateMode === "cover" || plateMode !== band.side) {
                        setPlateMode(band.side);
                      }
                      setActiveDiagramId(null);
                      setIndexOpen(false);
                      pulseNotice();
                      void audioEngine.playTrack(band.id);
                    }}
                  >
                    <span
                      className="groove-row-code"
                      style={{
                        backgroundColor: rMeta.pillBg,
                        color: rMeta.pillInk
                      }}
                    >
                      {band.code}
                    </span>
                    <div className="groove-row-text">
                      <span className="groove-row-title">{band.title}</span>
                      <span className="groove-row-country">
                        {band.country} · {band.artist}
                      </span>
                    </div>
                    <span className="groove-row-dur">{band.durationLabel}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          renderSidePills("hud-side-mobile")
        )}

        <div
          key={`${activeSound.id}-${activeDiagramId ?? "lp"}`}
          className={`band-whisper ${
            bandNoticeFresh || snap.isPlaying || indexOpen ? "is-fresh" : "is-calm"
          }`}
        >
          <button
            type="button"
            className="band-badge"
            style={{
              backgroundColor: activeRing.pillBg,
              color: activeRing.pillInk
            }}
            onClick={() => setIndexOpen((prev) => !prev)}
            aria-expanded={indexOpen}
            title="Browse all countries & groove bands (I)"
          >
            <VectorGlyph kind={activeSound.glyph} size={13} />
            <span>
              {activeSound.code} · {baseCountryName(activeSound.country)}
            </span>
            <ChevronUpDownIcon open={indexOpen} />
          </button>

          <div className="band-meta">
            <strong className="band-title">{activeSound.title}</strong>
            <span className="band-sub">{subtitleLine}</span>
          </div>

          <span className="band-time">
            {formatClock(snap.currentTime)} /{" "}
            {formatClock(snap.duration || activeSound.durationSec)}
          </span>

          <div className="band-actions">
            <button
              type="button"
              className="whisper-icon-btn"
              onClick={() => {
                pulseNotice();
                audioEngine.stepTrack(-1);
              }}
              aria-label="Previous band"
            >
              <ChevronLeftIcon />
            </button>

            <button
              type="button"
              className="whisper-play-btn"
              style={{
                backgroundColor: activeRing.pillBg,
                color: activeRing.pillInk
              }}
              onClick={() => {
                pulseNotice();
                void audioEngine.toggleTrack();
              }}
              aria-label={snap.isPlaying ? "Pause band" : "Play band"}
            >
              {snap.isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>

            <button
              type="button"
              className="whisper-icon-btn"
              onClick={() => {
                pulseNotice();
                audioEngine.stepTrack(1);
              }}
              aria-label="Next band"
            >
              <ChevronRightIcon />
            </button>
          </div>

          <div
            className="band-progress-track"
            onClick={handleProgressClick}
            role="slider"
            tabIndex={0}
            aria-label="Playback position"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <div
              className="band-progress-fill"
              style={{
                transform: `scaleX(${progress})`,
                backgroundColor: activeRing.pillInk
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7.5 5.2v13.6L18.6 12 7.5 5.2Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function ChevronUpDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        transform: open ? "rotate(180deg)" : "none",
        transition: "transform 160ms ease"
      }}
    >
      <path d="M6 15l6-6 6 6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
