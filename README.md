# golden-record

Play NASA's 1977 Voyager Golden Record in 3D at 16⅔ RPM with physical stylus cueing, direct-drive platter braking, and all 48 interstellar grooves.

```bash
npm install
```

## Quick start

```bash
npm run dev
```

`RecordPlateScene` renders the 24k gold-plated copper disc, Frank Drake cover plate, and articulated titanium tonearm in Three.js. `audioEngine` couples Web Audio groove acoustics and varispeed pitch shifting to platter RPM.

## Physical needle and platter control

```ts
import { audioEngine } from "./src/lib/audioEngine";

audioEngine.setStylusLifted(true);
audioEngine.dropStylusOnTrack("music-27-beethoven-cavatina", 0.3);
audioEngine.updatePlatterMotion(0.0, true, 0.016);
audioEngine.parkStylus();
```

`dropStylusOnTrack()` drops the stylus with a 64→27 Hz cartridge resonance thump at any proportional radial depth inside a groove. `updatePlatterMotion()` brakes, pitch-bends (`preservesPitch = false`), or reverse-scrubs audio from finger angular velocity.

## Agent API and WebMCP

```bash
curl -s "https://h3manth.com/fun/golden-record/api/tracks?country=India"
curl -s -H "Accept: text/markdown" "https://h3manth.com/fun/golden-record/"
```

Exposes all 27 *Music from Earth* works across 19 countries, *Greetings in 55 Languages*, all 19 *Sounds of Earth*, and all 6 photo-etched Frank Drake cover diagrams via OpenAPI, RFC 9727 `api-catalog`, A2A `agent-card.json`, SEP-1649 MCP `server-card.json`, and `navigator.modelContext` WebMCP tools.

## Build

```bash
node scripts/generate-agent-ready.ts
npm run build
```

Generates the static corpus and Agent-Ready manifests into `public/` and bundles the production app into `dist/`.

## Live

- [h3manth.com/fun/golden-record](https://h3manth.com/fun/golden-record/)

## License

MIT © [Hemanth.HM](https://h3manth.com)
