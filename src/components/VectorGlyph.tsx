import type { GlyphKind } from "../data/sounds";

interface VectorGlyphProps {
  kind: GlyphKind;
  size?: number;
  className?: string;
}

/**
 * Minimalist geometric technical glyphs inspired by Frank Drake & Linda Salzman Sagan's
 * 1977 Voyager Golden Record aluminum cover etchings.
 */
export function VectorGlyph({ kind, size = 18, className }: VectorGlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {renderPaths(kind)}
    </svg>
  );
}

function renderPaths(kind: GlyphKind) {
  switch (kind) {
    case "orbit":
      return (
        <>
          <circle cx="12" cy="12" r="2.2" />
          <ellipse cx="12" cy="12" rx="9" ry="4.4" transform="rotate(-24 12 12)" />
          <circle cx="18.8" cy="9.1" r="1.3" fill="currentColor" />
        </>
      );
    case "geothermal":
      return (
        <>
          <circle cx="8.5" cy="15.5" r="3" />
          <circle cx="15.5" cy="14" r="2.2" />
          <circle cx="12" cy="8.2" r="1.5" />
          <path d="M4 20h16" />
        </>
      );
    case "waves":
      return (
        <>
          <path d="M3 9.5c2.2-2 4.5-2 6.7 0s4.5 2 6.7 0 3.4-1.5 4.6-.4" />
          <path d="M3 14.5c2.2-2 4.5-2 6.7 0s4.5 2 6.7 0 3.4-1.5 4.6-.4" />
        </>
      );
    case "amphibian":
      return (
        <>
          <path d="M6 16c2-5 10-5 12 0" />
          <circle cx="9" cy="10" r="1.3" />
          <circle cx="15" cy="10" r="1.3" />
          <path d="M4 18.5h16" />
        </>
      );
    case "fauna":
      return (
        <>
          <path d="M4 14c3-5 7-5 9-1 2-4 5-4 7 0" />
          <path d="M8 18c2.5-1.6 5.5-1.6 8 0" />
        </>
      );
    case "primate":
      return (
        <>
          <circle cx="12" cy="9.5" r="4.2" />
          <circle cx="7" cy="9.5" r="1.4" />
          <circle cx="17" cy="9.5" r="1.4" />
          <path d="M8.5 17.5c2-1.8 5-1.8 7 0" />
        </>
      );
    case "canid":
      return (
        <>
          <path d="M6 18l2.5-9 3.5 3 4-5 2 11" />
          <path d="M5 18h14" />
        </>
      );
    case "pulse":
      return <path d="M3 12h4l2.4-5.5 3.4 11 2.4-5.5H21" />;
    case "flame":
      return (
        <>
          <path d="M12 4.5c3.2 3.8 5 6.6 5 9.4a5 5 0 0 1-10 0c0-2.8 1.8-5.6 5-9.4Z" />
          <path d="M12 11.5c1.2 1.5 2 2.6 2 3.7a2 2 0 0 1-4 0c0-1.1.8-2.2 2-3.7Z" />
        </>
      );
    case "flint":
      return (
        <>
          <polygon points="12,4 18.5,13.5 14.5,20 9.5,20 5.5,13.5" />
          <path d="M12 4v16" />
        </>
      );
    case "companion":
      return (
        <>
          <circle cx="9" cy="10" r="1.8" />
          <circle cx="15" cy="10" r="1.8" />
          <circle cx="12" cy="15" r="2.8" />
        </>
      );
    case "anvil":
      return (
        <>
          <path d="M5 9h14l-2.5 4H8.5L5 9Z" />
          <path d="M9 13v5M15 13v5M6.5 18h11" />
        </>
      );
    case "rivet":
      return (
        <>
          <rect x="5" y="7" width="14" height="10" rx="1.5" />
          <circle cx="8.5" cy="12" r="1.1" fill="currentColor" />
          <circle cx="12" cy="12" r="1.1" fill="currentColor" />
          <circle cx="15.5" cy="12" r="1.1" fill="currentColor" />
        </>
      );
    case "morse":
      return (
        <>
          <circle cx="5.5" cy="12" r="1.5" fill="currentColor" />
          <path d="M10 12h5" strokeWidth="2.2" />
          <circle cx="18.5" cy="12" r="1.5" fill="currentColor" />
          <path d="M5 17h14" strokeWidth="1.2" />
        </>
      );
    case "wheel":
      return (
        <>
          <circle cx="12" cy="12" r="7.5" />
          <circle cx="12" cy="12" r="1.8" />
          <path d="M12 4.5v15M4.5 12h15M6.7 6.7l10.6 10.6M17.3 6.7L6.7 17.3" />
        </>
      );
    case "steam":
      return (
        <>
          <path d="M4 16h16" />
          <rect x="6" y="10" width="9" height="6" />
          <path d="M15 8v8h3l-1.5-5H15" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="14.5" cy="18" r="1.5" />
        </>
      );
    case "highway":
      return (
        <>
          <path d="M8.5 4L4.5 20M15.5 4l4 16" />
          <path d="M12 6v3M12 12v3M12 18v2" />
        </>
      );
    case "embrace":
      return (
        <>
          <circle cx="9.5" cy="12" r="4.5" />
          <circle cx="14.8" cy="12" r="3.4" />
        </>
      );
    case "pulsar":
      return (
        <>
          <circle cx="12" cy="12" r="1.8" fill="currentColor" />
          <path d="M12 3v5M12 16v5M3 12h5M16 12h5M5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6" />
        </>
      );
  }
}

/**
 * Etches the matching technical line-glyph onto a 2D canvas texture for the 3D record plate.
 */
export function drawGlyphOnCanvas(
  ctx: CanvasRenderingContext2D,
  kind: GlyphKind,
  cx: number,
  cy: number,
  r: number,
  strokeStyle: string
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = strokeStyle;
  ctx.fillStyle = strokeStyle;
  ctx.lineWidth = Math.max(1.8, r * 0.13);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (kind) {
    case "orbit":
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.92, r * 0.44, -0.4, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "geothermal":
      for (const [dx, dy, rr] of [
        [-0.3, 0.25, 0.28],
        [0.34, 0.15, 0.22],
        [0, -0.35, 0.16]
      ]) {
        ctx.beginPath();
        ctx.arc(dx * r, dy * r, rr * r, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    case "waves":
      for (const yOff of [-0.24, 0.26]) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.85, yOff * r);
        ctx.bezierCurveTo(-r * 0.35, (yOff - 0.38) * r, r * 0.35, (yOff + 0.38) * r, r * 0.85, yOff * r);
        ctx.stroke();
      }
      break;
    case "amphibian":
      ctx.beginPath();
      ctx.arc(0, r * 0.35, r * 0.65, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-r * 0.28, -r * 0.22, r * 0.12, 0, Math.PI * 2);
      ctx.arc(r * 0.28, -r * 0.22, r * 0.12, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "fauna":
      ctx.beginPath();
      ctx.moveTo(-r * 0.85, r * 0.2);
      ctx.quadraticCurveTo(-r * 0.4, -r * 0.55, 0, 0);
      ctx.quadraticCurveTo(r * 0.4, -r * 0.55, r * 0.85, r * 0.2);
      ctx.stroke();
      break;
    case "primate":
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-r * 0.62, 0, r * 0.16, 0, Math.PI * 2);
      ctx.arc(r * 0.62, 0, r * 0.16, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "canid":
      ctx.beginPath();
      ctx.moveTo(-r * 0.65, r * 0.6);
      ctx.lineTo(-r * 0.3, -r * 0.4);
      ctx.lineTo(0, 0);
      ctx.lineTo(r * 0.4, -r * 0.6);
      ctx.lineTo(r * 0.68, r * 0.6);
      ctx.stroke();
      break;
    case "pulse":
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, 0);
      ctx.lineTo(-r * 0.42, 0);
      ctx.lineTo(-r * 0.18, -r * 0.62);
      ctx.lineTo(r * 0.18, r * 0.62);
      ctx.lineTo(r * 0.42, 0);
      ctx.lineTo(r * 0.9, 0);
      ctx.stroke();
      break;
    case "flame":
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.82);
      ctx.bezierCurveTo(r * 0.65, -r * 0.1, r * 0.55, r * 0.72, 0, r * 0.78);
      ctx.bezierCurveTo(-r * 0.55, r * 0.72, -r * 0.65, -r * 0.1, 0, -r * 0.82);
      ctx.stroke();
      break;
    case "flint":
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.85);
      ctx.lineTo(r * 0.68, r * 0.15);
      ctx.lineTo(r * 0.3, r * 0.8);
      ctx.lineTo(-r * 0.3, r * 0.8);
      ctx.lineTo(-r * 0.68, r * 0.15);
      ctx.closePath();
      ctx.stroke();
      break;
    case "companion":
      for (const [dx, dy, rr] of [
        [-0.35, -0.25, 0.18],
        [0.35, -0.25, 0.18],
        [0, 0.28, 0.32]
      ]) {
        ctx.beginPath();
        ctx.arc(dx * r, dy * r, rr * r, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    case "anvil":
      ctx.beginPath();
      ctx.moveTo(-r * 0.75, -r * 0.32);
      ctx.lineTo(r * 0.75, -r * 0.32);
      ctx.lineTo(r * 0.4, r * 0.22);
      ctx.lineTo(-r * 0.4, r * 0.22);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, r * 0.62);
      ctx.lineTo(r * 0.55, r * 0.62);
      ctx.stroke();
      break;
    case "rivet":
      ctx.strokeRect(-r * 0.75, -r * 0.45, r * 1.5, r * 0.9);
      for (const dx of [-0.42, 0, 0.42]) {
        ctx.beginPath();
        ctx.arc(dx * r, 0, r * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case "morse":
      ctx.beginPath();
      ctx.arc(-r * 0.65, 0, r * 0.14, 0, Math.PI * 2);
      ctx.arc(r * 0.65, 0, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-r * 0.28, 0);
      ctx.lineTo(r * 0.28, 0);
      ctx.stroke();
      break;
    case "wheel":
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.76, 0, Math.PI * 2);
      ctx.stroke();
      for (let a = 0; a < 4; a++) {
        const ang = (a * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * -r * 0.74, Math.sin(ang) * -r * 0.74);
        ctx.lineTo(Math.cos(ang) * r * 0.74, Math.sin(ang) * r * 0.74);
        ctx.stroke();
      }
      break;
    case "steam":
      ctx.strokeRect(-r * 0.68, -r * 0.25, r * 1.15, r * 0.58);
      ctx.beginPath();
      ctx.moveTo(-r * 0.85, r * 0.55);
      ctx.lineTo(r * 0.85, r * 0.55);
      ctx.stroke();
      break;
    case "highway":
      ctx.beginPath();
      ctx.moveTo(-r * 0.32, -r * 0.8);
      ctx.lineTo(-r * 0.72, r * 0.8);
      ctx.moveTo(r * 0.32, -r * 0.8);
      ctx.lineTo(r * 0.72, r * 0.8);
      ctx.moveTo(0, -r * 0.55);
      ctx.lineTo(0, -r * 0.15);
      ctx.moveTo(0, r * 0.15);
      ctx.lineTo(0, r * 0.55);
      ctx.stroke();
      break;
    case "embrace":
      ctx.beginPath();
      ctx.arc(-r * 0.24, 0, r * 0.48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(r * 0.3, 0, r * 0.34, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "pulsar":
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4;
        const r1 = r * 0.32;
        const r2 = i % 2 === 0 ? r * 0.88 : r * 0.65;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
        ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2);
        ctx.stroke();
      }
      break;
  }

  ctx.restore();
}
