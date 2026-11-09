# Authentication & Access Policy

Voyager Golden Record (`https://h3manth.com/fun/golden-record/`) is a public, open-access interactive 3D exhibition and JSON API.

- **Authentication**: None required (`NoAuth`). No API keys, OAuth bearer tokens, or cookies are needed.
- **CORS**: All read endpoints and static JSON datasets emit `Access-Control-Allow-Origin: *`.
- **Content Signals**: `ai-train=yes, search=yes, ai-input=yes`.
- **Rate Guidance**: Please keep automated `/api/tracks` and `/api/track` queries to `<= 15` requests/second per client; for bulk ingestion, fetch `https://h3manth.com/fun/golden-record/data/golden-record.json` directly.
