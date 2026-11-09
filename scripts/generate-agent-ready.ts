import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  COVER_DIAGRAMS,
  EARTH_SOUNDS,
  GOLDEN_SOUNDS,
  MUSIC_SOUNDS,
  RING_CHAPTERS
} from "../src/data/sounds.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const PUB = path.join(ROOT, "public");
const BASE_URL = "https://h3manth.com/fun/golden-record/";
const BASE_PATH = "/fun/golden-record";

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(relPath: string, obj: unknown) {
  const full = path.join(PUB, relPath);
  ensureDir(path.dirname(full));
  fs.writeFileSync(full, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function writeText(relPath: string, content: string) {
  const full = path.join(PUB, relPath);
  ensureDir(path.dirname(full));
  fs.writeFileSync(full, content, "utf8");
}

// 1. Export structured corpus JSON
const countriesSet = new Set<string>();
for (const s of MUSIC_SOUNDS) {
  const idx = s.country.indexOf(" · ");
  countriesSet.add(idx >= 0 ? s.country.slice(0, idx) : s.country);
}
const countries = Array.from(countriesSet);

const resolveAudioUrl = (src: string) =>
  src.startsWith("http://") || src.startsWith("https://")
    ? src
    : `${BASE_URL}${src.replace(/^\.?\//, "")}`;

const dataset = {
  meta: {
    name: "Voyager Golden Record · The Sounds of Earth (1977)",
    url: BASE_URL,
    launchedYear: 1977,
    spacecraft: ["Voyager 1", "Voyager 2"],
    turntableSpeedRpm: 16.6667,
    secondsPerRevolution: 3.6,
    discDiameterMm: 305,
    metallurgy: "24-karat gold electroplated copper LP with brushed gold-anodized aluminum Frank Drake cover plate",
    totalGrooves: GOLDEN_SOUNDS.length,
    musicTracksCount: MUSIC_SOUNDS.length,
    musicCountriesCount: countries.length,
    musicCountries: countries,
    earthSoundsAndGreetingsCount: EARTH_SOUNDS.length,
    coverDiagramsCount: COVER_DIAGRAMS.length
  },
  rings: RING_CHAPTERS,
  tracks: GOLDEN_SOUNDS.map((s) => ({
    id: s.id,
    side: s.side,
    index: s.index,
    code: s.code,
    title: s.title,
    country: s.country,
    artist: s.artist,
    ring: s.ring,
    radiusMm: s.radiusMm,
    rInner: s.rInner,
    rOuter: s.rOuter,
    durationSec: s.durationSec,
    durationLabel: s.durationLabel,
    audioUrl: resolveAudioUrl(s.audioSrc),
    fallbackAudioUrl: s.fallbackAudioSrc ? resolveAudioUrl(s.fallbackAudioSrc) : null,
    summary: s.summary,
    url: `${BASE_URL}#${s.id}`
  })),
  coverDiagrams: COVER_DIAGRAMS.map((d) => ({
    id: d.id,
    code: d.code,
    shortLabel: d.shortLabel,
    title: d.title,
    subtitle: d.subtitle,
    decodingNote: d.decodingNote,
    linkedSoundId: d.soundId,
    url: `${BASE_URL}#${d.id}`
  }))
};

writeJson("data/golden-record.json", dataset);

// 2. Build llms.txt and llms-full.txt
const llmsSummary = `# Voyager Golden Record · 3D 24k Gold Disc & Sounds of Earth (1977)

> Interactive 3D NASA Voyager Golden Record at 16⅔ RPM (${BASE_URL}) featuring tactile stylus grab/drop cueing, direct-drive platter braking & varispeed pitch shifting, all 27 *Music from Earth* works across 19 countries, *Greetings in 55 Languages*, all 19 *Sounds of Earth*, and Frank Drake's photo-etched 24k gold protective cover plate.

## Corpus & Physical Telemetry

- **Spacecraft**: Voyager 1 & Voyager 2 (launched August–September 1977, committee chaired by Carl Sagan)
- **Turntable Physics**: 16⅔ RPM (\`3.6 s\` per revolution), 305 mm (12-inch) 24-karat gold-plated copper disc
- **Side 1 — Music from Earth (\`27\` grooves across \`19\` countries)**: ${countries.join(", ")}
- **Side 2 — Greetings & Sounds of Earth (\`21\` grooves)**: Greetings in 55 Languages, UN Greetings & Whale Songs, plus all 19 NASA biosphere & human civilization soundscapes
- **Protective Cover Plate (\`${COVER_DIAGRAMS.length}\` Frank Drake diagrams)**: Stylus elevation & 16⅔ RPM binary period, video scan waveform, 14-pulsar solar map, and the hydrogen hyperfine transition (\`1420.405 MHz\` / \`0.704 ns\`)

## Agent & HTTP API Endpoints

- **Track Search / Filter**: \`GET ${BASE_URL}api/tracks?q=<query>&side=music|sounds&country=<country>&limit=20\`
- **Single Groove Lookup**: \`GET ${BASE_URL}api/track?id=<track-id-or-code>\` (e.g. \`?id=01\`, \`?id=26\`, \`?id=S01\`, \`?id=music-27-beethoven-cavatina\`)
- **Cover Plate Diagrams**: \`GET ${BASE_URL}api/diagrams\`
- **Corpus Telemetry**: \`GET ${BASE_URL}api/stats\`
- **Full Static Dataset**: \`GET ${BASE_URL}data/golden-record.json\`
- **OpenAPI 3.1 Specification**: \`GET ${BASE_URL}openapi.json\`
- **Complete Groove Manifest**: \`GET ${BASE_URL}llms-full.txt\`

## In-Browser WebMCP Tools (\`navigator.modelContext\`)

- \`search_golden_record({ query, side, country, limit })\` — Filter all 48 grooves by country, composer, title, or LP side
- \`play_golden_record_groove({ id, intraBandRatio })\` — Drop the 3D diamond stylus onto any groove and start 16⅔ RPM playback
- \`set_plate_side({ side })\` — Flip between \`"music"\` (Side 1), \`"sounds"\` (Side 2), and \`"cover"\` (Frank Drake cover plate)
- \`park_stylus()\` — Lift the tonearm and park it on the sculpted U-cradle rest post
`;

const musicLines = MUSIC_SOUNDS.map(
  (s) =>
    `- **${s.code}** (\`${s.id}\`) — *${s.title}* · **${s.country}** · ${s.artist} · \`${s.durationLabel}\` · \`${s.radiusMm} mm\` groove`
).join("\n");

const soundLines = EARTH_SOUNDS.map(
  (s) =>
    `- **${s.code}** (\`${s.id}\`) — *${s.title}* · **${s.country}** · \`${s.durationLabel}\` · \`${s.radiusMm} mm\` groove — ${s.summary}`
).join("\n");

const diagLines = COVER_DIAGRAMS.map(
  (d) => `- **Diagram ${d.code}** (\`${d.id}\`) — *${d.title}* (${d.subtitle}): ${d.decodingNote}`
).join("\n");

const llmsFull = `${llmsSummary}
## Side 1 · All 27 Music from Earth Grooves (19 Countries)

${musicLines}

## Side 2 · Greetings & All 19 Sounds of Earth (21 Grooves)

${soundLines}

## Engraved 24k Gold Cover Plate · ${COVER_DIAGRAMS.length} Frank Drake Diagrams

${diagLines}
`;

writeText("llms.txt", llmsSummary);
writeText("llms-full.txt", llmsFull);

// 3. auth.md, robots.txt, sitemap.xml
writeText(
  "auth.md",
  `# Authentication & Access Policy

Voyager Golden Record (\`${BASE_URL}\`) is a public, open-access interactive 3D exhibition and JSON API.

- **Authentication**: None required (\`NoAuth\`). No API keys, OAuth bearer tokens, or cookies are needed.
- **CORS**: All read endpoints and static JSON datasets emit \`Access-Control-Allow-Origin: *\`.
- **Content Signals**: \`ai-train=yes, search=yes, ai-input=yes\`.
- **Rate Guidance**: Please keep automated \`/api/tracks\` and \`/api/track\` queries to \`<= 15\` requests/second per client; for bulk ingestion, fetch \`${BASE_URL}data/golden-record.json\` directly.
`
);

writeText(
  "robots.txt",
  `User-agent: *
Allow: /

Sitemap: ${BASE_URL}sitemap.xml
Content-Signal: ai-train=yes, search=yes, ai-input=yes
`
);

writeText(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${BASE_URL}llms.txt</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${BASE_URL}llms-full.txt</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${BASE_URL}openapi.json</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>
`
);

// 4. OpenAPI 3.1.0 specification
const openapi = {
  openapi: "3.1.0",
  info: {
    title: "Voyager Golden Record 3D Archive API",
    version: "1.0.0",
    description:
      "Query all 48 concentric grooves of NASA's 1977 Voyager Golden Record (27 Music from Earth works across 19 countries + 21 Greetings & Sounds of Earth) and all 6 Frank Drake protective cover plate diagrams."
  },
  servers: [{ url: BASE_URL.replace(/\/$/, "") }],
  paths: {
    "/api/tracks": {
      get: {
        operationId: "searchGoldenRecordTracks",
        summary: "Search and filter all 48 Voyager Golden Record grooves",
        parameters: [
          {
            name: "q",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Free-text query matching title, country, artist, summary, or band code"
          },
          {
            name: "side",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["all", "music", "sounds"], default: "all" }
          },
          {
            name: "country",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Filter by country of origin (e.g. India, Germany, Peru, Japan, Senegal)"
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 48, default: 48 }
          }
        ],
        responses: {
          "200": {
            description: "Matching Golden Record grooves",
            content: { "application/json": { schema: { type: "object" } } }
          }
        }
      }
    },
    "/api/track": {
      get: {
        operationId: "getGoldenRecordTrack",
        summary: "Retrieve full metadata and groove geometry for a single band ID or code",
        parameters: [
          {
            name: "id",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Groove ID or band code (e.g. 01, 26, 27, S01, music-01-bach-brandenburg)"
          }
        ],
        responses: {
          "200": {
            description: "Single Golden Record groove record",
            content: { "application/json": { schema: { type: "object" } } }
          },
          "404": { description: "Groove ID not found" }
        }
      }
    },
    "/api/diagrams": {
      get: {
        operationId: "listCoverPlateDiagrams",
        summary: "List all 6 Frank Drake scientific diagrams etched on the 24k gold cover plate",
        responses: {
          "200": {
            description: "Cover plate diagram manifest",
            content: { "application/json": { schema: { type: "object" } } }
          }
        }
      }
    },
    "/api/stats": {
      get: {
        operationId: "getGoldenRecordStats",
        summary: "Return physical turntable telemetry and groove/country counts",
        responses: {
          "200": {
            description: "Golden Record summary statistics",
            content: { "application/json": { schema: { type: "object" } } }
          }
        }
      }
    }
  }
};
writeJson("openapi.json", openapi);

// 5. RFC 9727 API Catalog, A2A Agent Card, SEP-1649 MCP Server Card, AI Catalog, OAuth Metadata, JWKS
const apiCatalog = {
  linkset: [
    {
      anchor: BASE_URL,
      "service-desc": [
        {
          href: `${BASE_URL}openapi.json`,
          type: "application/json"
        }
      ],
      "service-doc": [
        {
          href: `${BASE_URL}llms-full.txt`,
          type: "text/plain"
        },
        {
          href: `${BASE_URL}auth.md`,
          type: "text/markdown"
        }
      ],
      describedby: [
        {
          href: `${BASE_URL}.well-known/agent-card.json`,
          type: "application/json"
        },
        {
          href: `${BASE_URL}.well-known/mcp/server-card.json`,
          type: "application/json"
        },
        {
          href: `${BASE_URL}llms.txt`,
          type: "text/plain"
        }
      ]
    }
  ]
};
writeJson("api-catalog.json", apiCatalog);
writeJson(".well-known/api-catalog", apiCatalog);

const agentCard = {
  $schema: "https://a2a-protocol.org/schemas/agent-card/v1.0.0.json",
  schemaVersion: "1.0.0",
  name: "Voyager Golden Record",
  description:
    "Interactive 3D 24k Gold NASA Voyager Golden Record (1977) with real-life stylus cueing, 16⅔ RPM platter physics, all 27 Music from Earth tracks across 19 countries, 55 World Greetings, 19 Sounds of Earth, and Frank Drake's protective cover plate.",
  url: BASE_URL,
  version: "1.0.0",
  provider: {
    organization: "Hemanth HM",
    url: "https://h3manth.com"
  },
  capabilities: {
    streaming: false,
    pushNotifications: false,
    webmcp: true,
    tools: [
      {
        name: "search_golden_record",
        description:
          "Search or filter all 48 NASA Voyager Golden Record grooves by country, title, artist, or LP side.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
            side: { type: "string", enum: ["all", "music", "sounds"], default: "all" },
            country: { type: "string" },
            limit: { type: "integer", default: 20 }
          }
        }
      },
      {
        name: "play_golden_record_groove",
        description:
          "Physically drop the 3D diamond stylus onto a specific Voyager Golden Record groove ID or band code and start 16⅔ RPM playback.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string" },
            intraBandRatio: { type: "number" }
          },
          required: ["id"]
        }
      },
      {
        name: "set_plate_side",
        description: "Flip the 3D 24k gold disc between 'music', 'sounds', and 'cover'.",
        parameters: {
          type: "object",
          properties: {
            side: { type: "string", enum: ["music", "sounds", "cover"] }
          },
          required: ["side"]
        }
      }
    ]
  },
  communication: {
    preferredChannel: "https",
    endpoints: {
      tracks: `${BASE_URL}api/tracks`,
      track: `${BASE_URL}api/track`,
      diagrams: `${BASE_URL}api/diagrams`,
      stats: `${BASE_URL}api/stats`,
      openapi: `${BASE_URL}openapi.json`
    }
  }
};
writeJson("agent-card.json", agentCard);
writeJson(".well-known/agent-card.json", agentCard);

writeJson(".well-known/mcp/server-card.json", {
  $schema: "https://modelcontextprotocol.io/schemas/server-card/v1.json",
  name: "voyager-golden-record",
  version: "1.0.0",
  description:
    "Query and play all 48 grooves of NASA's 1977 Voyager Golden Record across 19 countries and Earth's biosphere via HTTP JSON API and in-browser WebMCP.",
  homepage: BASE_URL,
  transport: {
    type: "webmcp",
    endpoint: BASE_URL,
    openapi: `${BASE_URL}openapi.json`
  },
  capabilities: {
    tools: true,
    resources: true,
    prompts: false
  }
});

writeJson(".well-known/ai-catalog.json", {
  version: "1.0",
  name: "Voyager Golden Record · 1977",
  description:
    "Interactive 3D 24k gold NASA Voyager Golden Record turntable and structured archive of all 48 interstellar audio grooves and 6 Frank Drake cover diagrams.",
  url: BASE_URL,
  resources: [
    {
      type: "llms-txt",
      url: `${BASE_URL}llms.txt`,
      description: "Structured overview and API guide for autonomous agents"
    },
    {
      type: "openapi",
      url: `${BASE_URL}openapi.json`,
      description: "OpenAPI 3.1 specification for Golden Record groove & cover diagram endpoints"
    },
    {
      type: "mcp-server-card",
      url: `${BASE_URL}.well-known/mcp/server-card.json`,
      description: "SEP-1649 MCP Server Card"
    },
    {
      type: "a2a-agent-card",
      url: `${BASE_URL}.well-known/agent-card.json`,
      description: "A2A v1.0.0 Agent Card"
    },
    {
      type: "agent-skills",
      url: `${BASE_URL}.well-known/agent-skills/index.json`,
      description: "Agent Skills RFC v0.2.0 manifest"
    }
  ]
});

const skillMd = `---
name: golden-record-archive
description: Query and control the interactive 3D NASA Voyager Golden Record archive (all 27 Music from Earth works across 19 countries, 55 Greetings, 19 Sounds of Earth, and 6 Frank Drake cover diagrams).
---

# Voyager Golden Record Archive Skill

## Endpoints

- \`GET ${BASE_URL}api/tracks?q=<query>&side=music|sounds&country=<country>&limit=20\`
- \`GET ${BASE_URL}api/track?id=<groove-id-or-code>\`
- \`GET ${BASE_URL}api/diagrams\`
- \`GET ${BASE_URL}api/stats\`
- \`GET ${BASE_URL}data/golden-record.json\`

## WebMCP Browser Tools

When inspecting \`${BASE_URL}\` in a WebMCP-enabled browser agent:
- \`search_golden_record({ query, side, country, limit })\`
- \`play_golden_record_groove({ id, intraBandRatio })\`
- \`set_plate_side({ side })\`
- \`park_stylus()\`
`;

const skillRelPath = ".well-known/agent-skills/golden-record-archive/SKILL.md";
writeText(skillRelPath, skillMd);
const skillSha256 = crypto.createHash("sha256").update(skillMd, "utf8").digest("hex");

writeJson(".well-known/agent-skills/index.json", {
  $schema: "https://agentskills.io/schemas/index/v0.2.0.json",
  version: "0.2.0",
  skills: [
    {
      name: "golden-record-archive",
      type: "skill-md",
      description:
        "Query and control NASA's 1977 Voyager Golden Record across all 27 Music from Earth works (19 countries), 55 World Greetings, 19 Sounds of Earth, and 6 Frank Drake cover diagrams.",
      url: `${BASE_URL}${skillRelPath}`,
      entrypoint: `${BASE_PATH}/${skillRelPath}`,
      sha256: skillSha256
    }
  ]
});

// Deterministic Ed25519 public JWK derived from project identifier for RFC 9421 Web Bot Auth directory
const seed = crypto.createHash("sha256").update("h3manth-fun-golden-record-ed25519-v1").digest();
const pkcs8Prefix = Buffer.from("302e020100300506032b657004220420", "hex");
const privKey = crypto.createPrivateKey({
  key: Buffer.concat([pkcs8Prefix, seed]),
  format: "der",
  type: "pkcs8"
});
const pubJwk = crypto.createPublicKey(privKey).export({ format: "jwk" }) as { x: string };

writeJson(".well-known/http-message-signatures-directory", {
  keys: [
    {
      kty: "OKP",
      crv: "Ed25519",
      x: pubJwk.x,
      kid: "golden-record-ed25519-1",
      use: "sig",
      alg: "Ed25519"
    }
  ]
});

writeJson(".well-known/oauth-protected-resource", {
  resource: BASE_URL,
  scopes_supported: ["public:read"],
  bearer_methods_supported: [],
  resource_documentation: `${BASE_URL}auth.md`
});

// 6. PHP 5.6+ compatible api.php (note: CORS origin header is emitted by .htaccess to avoid duplicate *, *)
const apiPhp = `<?php
$action = isset($_GET['action']) ? (string)$_GET['action'] : '';

header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');
header('content-signal: ai-train=yes, search=yes, ai-input=yes');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($action === 'markdown') {
    $mdBody = @file_get_contents(__DIR__ . '/llms.txt');
    if (!$mdBody) {
        $mdBody = "# Voyager Golden Record (1977)\\n\\nInteractive 3D 24k Gold NASA Voyager Golden Record.\\n";
    }
    $htmlRaw = @file_get_contents(__DIR__ . '/index.html');
    if (!$htmlRaw) $htmlRaw = '';
    $frontmatter = "---\\n"
        . "title: \\"Voyager Golden Record · 3D 24k Gold Disc & Sounds of Earth (1977)\\"\\n"
        . "description: \\"Interactive 3D NASA Voyager Golden Record at 16 2/3 RPM with real-life stylus cueing, platter physics, all 27 musical works across 19 countries, 55 Greetings, and 19 Sounds of Earth.\\"\\n"
        . "url: \\"${BASE_URL}\\"\\n"
        . "---\\n\\n";
    $fullMd = $frontmatter . $mdBody;
    header('Content-Type: text/markdown; charset=utf-8');
    header('Vary: Accept');
    header('x-markdown-tokens: ' . (string)(int)ceil(strlen($fullMd) / 4));
    if ($htmlRaw !== '') {
        header('x-original-tokens: ' . (string)(int)ceil(strlen($htmlRaw) / 4));
    }
    echo $fullMd;
    exit;
}

header('Content-Type: application/json; charset=utf-8');

$rawJson = @file_get_contents(__DIR__ . '/data/golden-record.json');
$data = $rawJson ? json_decode($rawJson, true) : null;
if (!$data || !isset($data['tracks'])) {
    http_response_code(500);
    echo json_encode(array('error' => 'Dataset unavailable'));
    exit;
}

if ($action === 'stats') {
    echo json_encode($data['meta'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}

if ($action === 'diagrams') {
    echo json_encode(array(
        'count' => count($data['coverDiagrams']),
        'diagrams' => $data['coverDiagrams']
    ), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}

if ($action === 'track') {
    $id = isset($_GET['id']) ? trim((string)$_GET['id']) : '';
    if ($id === '') {
        http_response_code(400);
        echo json_encode(array('error' => 'Provide ?id=<groove-id-or-code>'));
        exit;
    }
    $needle = strtolower($id);
    foreach ($data['tracks'] as $track) {
        $tid = isset($track['id']) ? strtolower((string)$track['id']) : '';
        $tcode = isset($track['code']) ? strtolower((string)$track['code']) : '';
        if ($tid === $needle || $tcode === $needle) {
            echo json_encode($track, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
            exit;
        }
    }
    http_response_code(404);
    echo json_encode(array('error' => 'Groove not found', 'id' => $id));
    exit;
}

if ($action === 'tracks') {
    $q = isset($_GET['q']) ? trim((string)$_GET['q']) : '';
    $side = isset($_GET['side']) ? strtolower(trim((string)$_GET['side'])) : 'all';
    $country = isset($_GET['country']) ? trim((string)$_GET['country']) : '';
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 48;
    if ($limit < 1) $limit = 1;
    if ($limit > 48) $limit = 48;

    $qLower = mb_strtolower($q, 'UTF-8');
    $cLower = mb_strtolower($country, 'UTF-8');
    $results = array();

    foreach ($data['tracks'] as $t) {
        if (($side === 'music' || $side === 'sounds') && (!isset($t['side']) || $t['side'] !== $side)) {
            continue;
        }
        if ($cLower !== '') {
            $tc = isset($t['country']) ? mb_strtolower((string)$t['country'], 'UTF-8') : '';
            if (mb_strpos($tc, $cLower) === false) continue;
        }
        if ($qLower !== '') {
            $hay = mb_strtolower(
                (isset($t['id']) ? $t['id'] : '') . ' ' .
                (isset($t['code']) ? $t['code'] : '') . ' ' .
                (isset($t['title']) ? $t['title'] : '') . ' ' .
                (isset($t['country']) ? $t['country'] : '') . ' ' .
                (isset($t['artist']) ? $t['artist'] : '') . ' ' .
                (isset($t['summary']) ? $t['summary'] : ''),
                'UTF-8'
            );
            if (mb_strpos($hay, $qLower) === false) continue;
        }
        $results[] = $t;
        if (count($results) >= $limit) break;
    }

    echo json_encode(array(
        'query' => $q,
        'side' => $side,
        'country' => $country,
        'count' => count($results),
        'results' => $results
    ), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}

http_response_code(400);
echo json_encode(array(
    'error' => 'Supported actions: tracks, track, diagrams, stats, markdown',
    'openapi' => '${BASE_URL}openapi.json'
), JSON_UNESCAPED_SLASHES);
`;
writeText("api.php", apiPhp);

// 7. Apache .htaccess
const htaccess = `Options -Indexes

<IfModule mod_headers.c>
  Header set Access-Control-Allow-Origin "*"
  Header set Cross-Origin-Resource-Policy "cross-origin"
  Header set content-signal "ai-train=yes, search=yes, ai-input=yes"
  Header append Vary "Accept"
  Header add Link "<${BASE_PATH}/.well-known/api-catalog>; rel=\\"api-catalog\\"; type=\\"application/linkset+json\\", <${BASE_PATH}/.well-known/agent-skills/index.json>; rel=\\"service-desc\\"; type=\\"application/json\\", <${BASE_PATH}/.well-known/mcp/server-card.json>; rel=\\"describedby\\"; type=\\"application/json\\", <${BASE_PATH}/.well-known/agent-card.json>; rel=\\"describedby\\"; type=\\"application/json\\", <${BASE_PATH}/llms.txt>; rel=\\"describedby\\"; type=\\"text/plain\\", <${BASE_PATH}/openapi.json>; rel=\\"service-desc\\"; type=\\"application/json\\", <${BASE_PATH}/.well-known/ai-catalog.json>; rel=\\"ai-catalog\\"; type=\\"application/json\\""
</IfModule>

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase ${BASE_PATH}/

  # Markdown content negotiation for agents requesting Accept: text/markdown
  RewriteCond %{REQUEST_URI} ^${BASE_PATH}/?$
  RewriteCond %{HTTP_ACCEPT} text/markdown [NC]
  RewriteRule ^$ api.php?action=markdown [QSA,L]

  # JSON API routes
  RewriteRule ^api/tracks/?$ api.php?action=tracks [QSA,L]
  RewriteRule ^api/track/?$ api.php?action=track [QSA,L]
  RewriteRule ^api/diagrams/?$ api.php?action=diagrams [QSA,L]
  RewriteRule ^api/stats/?$ api.php?action=stats [QSA,L]

  # RFC 9727 API catalog
  RewriteRule ^\\.well-known/api-catalog$ api-catalog.json [L]
</IfModule>

<Files "llms.txt">
  ForceType "text/plain; charset=utf-8"
</Files>

<Files "llms-full.txt">
  ForceType "text/plain; charset=utf-8"
</Files>

<Files "auth.md">
  ForceType "text/markdown; charset=utf-8"
</Files>

<Files "api-catalog.json">
  ForceType "application/linkset+json; charset=utf-8"
</Files>

<Files "agent-card.json">
  ForceType "application/json; charset=utf-8"
</Files>

<Files "server-card.json">
  ForceType "application/json; charset=utf-8"
</Files>

<Files "openapi.json">
  ForceType "application/json; charset=utf-8"
</Files>

<Files "http-message-signatures-directory">
  ForceType "application/json; charset=utf-8"
</Files>

<Files "oauth-protected-resource">
  ForceType "application/json; charset=utf-8"
</Files>
`;
writeText(".htaccess", htaccess);

console.log(
  `Generated Agent-Ready Level 5 artifacts (${GOLDEN_SOUNDS.length} grooves, ${countries.length} countries, ${COVER_DIAGRAMS.length} cover diagrams, skill sha256=${skillSha256.slice(0, 12)}...)`
);
