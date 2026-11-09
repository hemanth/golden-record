---
name: golden-record-archive
description: Query and control the interactive 3D NASA Voyager Golden Record archive (all 27 Music from Earth works across 19 countries, 55 Greetings, 19 Sounds of Earth, and 6 Frank Drake cover diagrams).
---

# Voyager Golden Record Archive Skill

## Endpoints

- `GET https://h3manth.com/fun/golden-record/api/tracks?q=<query>&side=music|sounds&country=<country>&limit=20`
- `GET https://h3manth.com/fun/golden-record/api/track?id=<groove-id-or-code>`
- `GET https://h3manth.com/fun/golden-record/api/diagrams`
- `GET https://h3manth.com/fun/golden-record/api/stats`
- `GET https://h3manth.com/fun/golden-record/data/golden-record.json`

## WebMCP Browser Tools

When inspecting `https://h3manth.com/fun/golden-record/` in a WebMCP-enabled browser agent:
- `search_golden_record({ query, side, country, limit })`
- `play_golden_record_groove({ id, intraBandRatio })`
- `set_plate_side({ side })`
- `park_stylus()`
