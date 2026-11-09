export type PastelRingId = "planetary" | "biosphere" | "craft" | "human";
export type PlateMode = "music" | "sounds" | "cover";

export type GlyphKind =
  | "orbit"
  | "geothermal"
  | "waves"
  | "amphibian"
  | "fauna"
  | "primate"
  | "canid"
  | "pulse"
  | "flame"
  | "flint"
  | "companion"
  | "anvil"
  | "rivet"
  | "morse"
  | "wheel"
  | "steam"
  | "highway"
  | "embrace"
  | "pulsar";

export interface RingMeta {
  id: PastelRingId;
  ringNumber: number;
  label: string;
  shortLabel: string;
  pillBg: string;
  pillInk: string;
  highlightHex: string;
}

export interface GoldenSound {
  id: string;
  side: "music" | "sounds";
  /** 1..27 on Side 1 (World Music) or 1..21 on Side 2 (Greetings & Sounds of Earth) */
  index: number;
  code: string;
  title: string;
  /** Country of origin (verbatim from NASA's Music from Earth table, or Earth / 55 Languages on Side 2) */
  country: string;
  artist: string;
  ring: PastelRingId;
  /** Concentric LP groove inner/outer radius in Three.js disc units (1.19 .. 3.49) */
  rInner: number;
  rOuter: number;
  /** Physical radius in millimeters on the 305 mm (12-inch) copper disc */
  radiusMm: number;
  durationSec: number;
  durationLabel: string;
  audioSrc: string;
  fallbackAudioSrc?: string;
  glyph: GlyphKind;
  summary: string;
}

export interface CoverDiagramRegion {
  id: string;
  code: string;
  shortLabel: string;
  title: string;
  subtitle: string;
  decodingNote: string;
  soundId: string;
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
}

export const RING_CHAPTERS: Record<PastelRingId, RingMeta> = {
  planetary: {
    id: "planetary",
    ringNumber: 1,
    label: "Europe & Classical Polyphony",
    shortLabel: "Sky",
    pillBg: "#DFEFF7",
    pillInk: "#215773",
    highlightHex: "#D6ECF8"
  },
  biosphere: {
    id: "biosphere",
    ringNumber: 2,
    label: "Asia & Oceania",
    shortLabel: "Sage",
    pillBg: "#E2F1E5",
    pillInk: "#295C39",
    highlightHex: "#D8F0DE"
  },
  craft: {
    id: "craft",
    ringNumber: 3,
    label: "Africa & Caucasus",
    shortLabel: "Sand",
    pillBg: "#F8EED8",
    pillInk: "#7B5316",
    highlightHex: "#FCEBC2"
  },
  human: {
    id: "human",
    ringNumber: 4,
    label: "The Americas",
    shortLabel: "Blush",
    pillBg: "#F7E3E7",
    pillInk: "#853242",
    highlightHex: "#FADCE3"
  }
};

function archiveTrackUrls(trackNumber: number): {
  audioSrc: string;
  fallbackAudioSrc: string;
} {
  const file = encodeURIComponent(
    `NASA - The Golden Voyager Record - Track (${String(trackNumber).padStart(2, "0")}).mp3`
  );
  return {
    audioSrc: `https://dn801300.us.archive.org/0/items/the-golden-voyager-record/${file}`,
    fallbackAudioSrc: `https://archive.org/download/the-golden-voyager-record/${file}`
  };
}

interface RawTrackSeed {
  id: string;
  side: "music" | "sounds";
  country: string;
  title: string;
  artist: string;
  ring: PastelRingId;
  durationSec: number;
  audioSrc: string;
  fallbackAudioSrc?: string;
  glyph: GlyphKind;
  summary: string;
}

/**
 * SIDE 1 — All 27 "Music from Earth" compositions in exact NASA table order,
 * covering every single Country of origin on https://science.nasa.gov/mission/voyager/golden-record-contents/sounds/:
 * Germany, Java (Indonesia), Senegal, Zaire (DR Congo), Australia, Mexico, United States,
 * New Guinea, Japan, Austria, Georgia, Peru, Azerbaijan, Russia, Bulgaria,
 * United Kingdom, Solomon Islands, China, and India.
 */
const RAW_MUSIC_TRACKS: RawTrackSeed[] = [
  {
    id: "music-01-germany-brandenburg",
    side: "music",
    country: "Germany",
    title: "Brandenburg Concerto No. 2 in F, I",
    artist: "J.S. Bach · Munich Bach Orchestra, Karl Richter",
    ring: "planetary",
    durationSec: 280,
    ...archiveTrackUrls(5),
    glyph: "orbit",
    summary: "Opening musical selection on the Voyager Golden Record."
  },
  {
    id: "music-02-java-puspawarna",
    side: "music",
    country: "Java · Indonesia",
    title: 'Court Gamelan, "Kinds of Flowers"',
    artist: "Ketawang Puspåwårnå · Rec. Robert Brown",
    ring: "biosphere",
    durationSec: 283,
    ...archiveTrackUrls(6),
    glyph: "waves",
    summary: "Javanese royal court gamelan ensemble recorded in Pura Paku Alaman."
  },
  {
    id: "music-03-senegal-percussion",
    side: "music",
    country: "Senegal",
    title: "Senegalese Percussion (Cengunmé)",
    artist: "Tama & Sabar Ensemble · Rec. Charles Duvelle",
    ring: "craft",
    durationSec: 128,
    ...archiveTrackUrls(7),
    glyph: "pulse",
    summary: "Polyrhythmic West African percussion recorded by ethnomusicologist Charles Duvelle."
  },
  {
    id: "music-04-zaire-initiation",
    side: "music",
    country: "Zaire · DR Congo",
    title: "Pygmy Girls’ Initiation Song",
    artist: "Mbuti Vocal Polyphony · Rec. Colin Turnbull",
    ring: "craft",
    durationSec: 56,
    ...archiveTrackUrls(8),
    glyph: "fauna",
    summary: "Ituri rainforest Alima vocal song recorded by anthropologist Colin Turnbull."
  },
  {
    id: "music-05-australia-morning-star",
    side: "music",
    country: "Australia",
    title: '"Morning Star" and "Devil Bird"',
    artist: "Yolngu Aborigine Songs · Rec. Sandra LeBrun Holmes",
    ring: "biosphere",
    durationSec: 86,
    ...archiveTrackUrls(9),
    glyph: "pulsar",
    summary: "Traditional Arnhem Land didgeridoo, clapsticks, and vocal songlines."
  },
  {
    id: "music-06-mexico-el-cascabel",
    side: "music",
    country: "Mexico",
    title: '"El Cascabel"',
    artist: "Lorenzo Barcelata & Mariachi México",
    ring: "human",
    durationSec: 194,
    ...archiveTrackUrls(10),
    glyph: "flame",
    summary: "Son jarocho classic performed with vibrant trumpets, violins, and harp."
  },
  {
    id: "music-07-usa-johnny-b-goode",
    side: "music",
    country: "United States",
    title: '"Johnny B. Goode"',
    artist: "Written & performed by Chuck Berry",
    ring: "human",
    durationSec: 158,
    ...archiveTrackUrls(11),
    glyph: "highway",
    summary: "1958 Chess Records electric rock-and-roll landmark."
  },
  {
    id: "music-08-new-guinea-mens-house",
    side: "music",
    country: "New Guinea",
    title: "Men’s House Song (Mariuamangɨ)",
    artist: "Sepik River Flutes · Rec. Robert MacLennan",
    ring: "biosphere",
    durationSec: 80,
    ...archiveTrackUrls(12),
    glyph: "amphibian",
    summary: "Paired bamboo ceremonial flutes from the Kandingei village of Papua New Guinea."
  },
  {
    id: "music-09-japan-cranes-nest",
    side: "music",
    country: "Japan",
    title: 'Shakuhachi, "Crane’s Nest"',
    artist: "Tsuru No Sugomori · Goro Yamaguchi",
    ring: "biosphere",
    durationSec: 291,
    ...archiveTrackUrls(13),
    glyph: "waves",
    summary: "Edo-period honkyoku solo bamboo flute piece performed by Living National Treasure Goro Yamaguchi."
  },
  {
    id: "music-10-germany-gavotte",
    side: "music",
    country: "Germany",
    title: '"Gavotte en rondeaux" (Partita No. 3)',
    artist: "J.S. Bach · Arthur Grumiaux, solo violin",
    ring: "planetary",
    durationSec: 175,
    ...archiveTrackUrls(14),
    glyph: "orbit",
    summary: "Unaccompanied violin dance movement from BWV 1006 in E major."
  },
  {
    id: "music-11-austria-magic-flute",
    side: "music",
    country: "Austria",
    title: "The Magic Flute, Queen of the Night Aria",
    artist: "W.A. Mozart · Edda Moser & Bavarian State Opera",
    ring: "planetary",
    durationSec: 175,
    ...archiveTrackUrls(15),
    glyph: "pulsar",
    summary: "Coloratura soprano aria No. 14 conducted by Wolfgang Sawallisch."
  },
  {
    id: "music-12-georgia-tchakrulo",
    side: "music",
    country: "Georgia",
    title: 'Chorus, "Tchakrulo"',
    artist: "Georgian State Folk Ensemble · Radio Moscow",
    ring: "craft",
    durationSec: 138,
    ...archiveTrackUrls(16),
    glyph: "anvil",
    summary: "Three-part Kakhetian polyphonic choral song from Georgia."
  },
  {
    id: "music-13-peru-panpipes",
    side: "music",
    country: "Peru",
    title: "Panpipes and Drum",
    artist: "Ancash Roncadoras · Casa de la Cultura, Lima",
    ring: "human",
    durationSec: 52,
    ...archiveTrackUrls(17),
    glyph: "wheel",
    summary: "Andean pipe-and-tabor festival melody collected in Peru."
  },
  {
    id: "music-14-usa-melancholy-blues",
    side: "music",
    country: "United States",
    title: '"Melancholy Blues"',
    artist: "Louis Armstrong and his Hot Seven",
    ring: "human",
    durationSec: 185,
    ...archiveTrackUrls(18),
    glyph: "steam",
    summary: "1927 New Orleans jazz recording featuring Louis Armstrong’s trumpet solo."
  },
  {
    id: "music-15-azerbaijan-bagpipes",
    side: "music",
    country: "Azerbaijan",
    title: "Bagpipes (Muğam / Ugam)",
    artist: "Balaban Duo · Recorded by Radio Moscow",
    ring: "craft",
    durationSec: 150,
    ...archiveTrackUrls(19),
    glyph: "flame",
    summary: "Improvised modal double-reed balaban duet over sustained drone."
  },
  {
    id: "music-16-russia-rite-of-spring",
    side: "music",
    country: "Russia",
    title: "Rite of Spring, Sacrificial Dance",
    artist: "Igor Stravinsky & Columbia Symphony Orchestra",
    ring: "planetary",
    durationSec: 275,
    ...archiveTrackUrls(20),
    glyph: "rivet",
    summary: "Conducted by composer Igor Stravinsky himself."
  },
  {
    id: "music-17-germany-wtc",
    side: "music",
    country: "Germany",
    title: "Well-Tempered Clavier II, Prelude & Fugue No. 1",
    artist: "J.S. Bach · Glenn Gould, piano",
    ring: "planetary",
    durationSec: 288,
    ...archiveTrackUrls(21),
    glyph: "morse",
    summary: "Contrapuntal Prelude and Fugue in C major, BWV 870."
  },
  {
    id: "music-18-germany-beethoven-5",
    side: "music",
    country: "Germany",
    title: "Fifth Symphony, First Movement",
    artist: "L. van Beethoven · Philharmonia Orch., Otto Klemperer",
    ring: "planetary",
    durationSec: 440,
    ...archiveTrackUrls(22),
    glyph: "orbit",
    summary: "Allegro con brio in C minor, Op. 67."
  },
  {
    id: "music-19-bulgaria-izlel",
    side: "music",
    country: "Bulgaria",
    title: '"Izlel je Delyo Hagdutin"',
    artist: "Sung by Valya Balkanska with gaida bagpipes",
    ring: "planetary",
    durationSec: 299,
    ...archiveTrackUrls(23),
    glyph: "fauna",
    summary: "Soaring Rhodope Mountain folk ballad from southern Bulgaria."
  },
  {
    id: "music-20-usa-navajo-chant",
    side: "music",
    country: "United States · Navajo",
    title: "Navajo Indians, Night Chant",
    artist: "Yeibichai Dance · Recorded by Willard Rhodes",
    ring: "human",
    durationSec: 57,
    ...archiveTrackUrls(24),
    glyph: "pulse",
    summary: "Traditional Diné healing ceremonial chant from the American Southwest."
  },
  {
    id: "music-21-uk-fairie-round",
    side: "music",
    country: "United Kingdom",
    title: '"The Fairie Round"',
    artist: "Anthony Holborne · Early Music Consort of London",
    ring: "planetary",
    durationSec: 77,
    ...archiveTrackUrls(25),
    glyph: "wheel",
    summary: "1599 Elizabethan Renaissance consort dance directed by David Munrow."
  },
  {
    id: "music-22-solomon-islands-panpipes",
    side: "music",
    country: "Solomon Islands",
    title: "Solomon Islands Panpipes",
    artist: "Malaita Ensemble · Solomon Islands Broadcasting",
    ring: "biosphere",
    durationSec: 72,
    ...archiveTrackUrls(26),
    glyph: "amphibian",
    summary: "Interlocking bamboo panpipes imitating the call of the megapode bird."
  },
  {
    id: "music-23-peru-wedding-song",
    side: "music",
    country: "Peru",
    title: "Peruvian Wedding Song",
    artist: "Huancavelica Quechua Song · Rec. John Cohen",
    ring: "human",
    durationSec: 38,
    ...archiveTrackUrls(27),
    glyph: "embrace",
    summary: "High-altitude Quechua vocal wedding song recorded in the Peruvian Andes."
  },
  {
    id: "music-24-china-flowing-streams",
    side: "music",
    country: "China",
    title: 'Ch’in, "Flowing Streams" (Liu Shui)',
    artist: "Performed by Kuan P’ing-hu (Guan Pinghu)",
    ring: "biosphere",
    durationSec: 457,
    ...archiveTrackUrls(28),
    glyph: "waves",
    summary: "Ancient seven-string silk-strung guqin meditation dating back over two millennia."
  },
  {
    id: "music-25-india-jaat-kahan-ho",
    side: "music",
    country: "India",
    title: 'Raga, "Jaat Kahan Ho"',
    artist: "Raga Bhairavi · Sung by Surshri Kesar Bai Kerkar",
    ring: "biosphere",
    durationSec: 210,
    ...archiveTrackUrls(29),
    glyph: "orbit",
    summary: "Hindustani classical khyal masterwork recommended by ethnomusicologist Robert Brown."
  },
  {
    id: "music-26-usa-dark-was-the-night",
    side: "music",
    country: "United States",
    title: '"Dark Was the Night"',
    artist: "Written & performed by Blind Willie Johnson",
    ring: "human",
    durationSec: 195,
    ...archiveTrackUrls(30),
    glyph: "pulsar",
    summary: "1927 wordless bottleneck slide-guitar expression of human solitude in the cosmos."
  },
  {
    id: "music-27-germany-cavatina",
    side: "music",
    country: "Germany",
    title: "String Quartet No. 13 in B-flat, Op. 130: Cavatina",
    artist: "L. van Beethoven · Budapest String Quartet",
    ring: "planetary",
    durationSec: 397,
    ...archiveTrackUrls(31),
    glyph: "embrace",
    summary: "Final musical groove on the Voyager Golden Record."
  }
];

/**
 * SIDE 2 — Spoken Greetings (55 Languages + UN/Whales) & All 19 NASA "Sounds of Earth" tracks.
 */
const RAW_SOUND_TRACKS: RawTrackSeed[] = [
  {
    id: "greetings-55-languages",
    side: "sounds",
    country: "55 World Languages",
    title: "Greetings to the Universe in 55 Languages",
    artist: "Sumerian, Arabic, Mandarin, Hindi, Kannada, Spanish, English & 48 more",
    ring: "human",
    durationSec: 226,
    ...archiveTrackUrls(2),
    glyph: "morse",
    summary: "Spoken greetings from populations across Earth in 55 ancient and modern languages."
  },
  {
    id: "un-greetings-whale-songs",
    side: "sounds",
    country: "United Nations & Oceans",
    title: "UN Greetings & Humpback Whale Songs",
    artist: "UN Delegates & Roger Payne Whale Recordings",
    ring: "planetary",
    durationSec: 244,
    ...archiveTrackUrls(3),
    glyph: "waves",
    summary: "International voices followed by songs of humpback whales off Bermuda."
  },
  {
    id: "music-of-the-spheres",
    side: "sounds",
    country: "Earth · Bell Labs",
    title: "Music of the Spheres",
    artist: "Johannes Kepler / Laurie Spiegel",
    ring: "planetary",
    durationSec: 37.4,
    audioSrc: "audio/10-216602239.mp3",
    glyph: "orbit",
    summary: "Kepler’s Harmonices Mundi planetary orbital velocity ratios realized on synthesizer."
  },
  {
    id: "mud-pots",
    side: "sounds",
    country: "Earth · Lithosphere",
    title: "Mud Pots",
    artist: "NASA Sounds of Earth",
    ring: "planetary",
    durationSec: 6.2,
    audioSrc: "audio/11-216602946.mp3",
    glyph: "geothermal",
    summary: "Geothermal steam vents bursting through volcanic mineral clay."
  },
  {
    id: "wind-rain-surf",
    side: "sounds",
    country: "Earth · Hydrosphere",
    title: "Wind, Rain, Surf",
    artist: "NASA Sounds of Earth",
    ring: "planetary",
    durationSec: 97.8,
    audioSrc: "audio/12-216603087.mp3",
    glyph: "waves",
    summary: "Atmospheric gales, continental rainfall, and tidal ocean surf."
  },
  {
    id: "crickets-frogs",
    side: "sounds",
    country: "Earth · Biosphere",
    title: "Crickets, Frogs",
    artist: "NASA Sounds of Earth",
    ring: "biosphere",
    durationSec: 24.7,
    audioSrc: "audio/13-216603252.mp3",
    glyph: "amphibian",
    summary: "Nocturnal chorus of stridulating field crickets and wetland frogs."
  },
  {
    id: "birds-hyena-elephant",
    side: "sounds",
    country: "Earth · Savanna & Forest",
    title: "Birds, Hyena, Elephant",
    artist: "NASA Sounds of Earth",
    ring: "biosphere",
    durationSec: 57.6,
    audioSrc: "audio/14-216603492.mp3",
    glyph: "fauna",
    summary: "Woodland birdsong, spotted hyena call, and African elephants."
  },
  {
    id: "chimpanzee",
    side: "sounds",
    country: "Earth · Primate Forest",
    title: "Chimpanzee",
    artist: "Pan troglodytes · NASA Sounds of Earth",
    ring: "biosphere",
    durationSec: 7.9,
    audioSrc: "audio/15-216603695.mp3",
    glyph: "primate",
    summary: "Social pant-hoot call of humanity’s closest living evolutionary relative."
  },
  {
    id: "wild-dog",
    side: "sounds",
    country: "Earth · Wilderness",
    title: "Wild Dog",
    artist: "NASA Sounds of Earth",
    ring: "biosphere",
    durationSec: 25.6,
    audioSrc: "audio/16-216603833.mp3",
    glyph: "canid",
    summary: "Solitary wild canid howling across open night air."
  },
  {
    id: "footsteps-heartbeat-laughter",
    side: "sounds",
    country: "Earth · Humanity",
    title: "Footsteps, Heartbeat, Laughter",
    artist: "Recorded at Cornell University",
    ring: "human",
    durationSec: 30.5,
    audioSrc: "audio/17-216603951.mp3",
    glyph: "pulse",
    summary: "Measured footsteps, human cardiac pulse, and warm laughter."
  },
  {
    id: "fire-speech",
    side: "sounds",
    country: "Earth · Early Hearth",
    title: "Fire, Speech",
    artist: "NASA Sounds of Earth",
    ring: "craft",
    durationSec: 9.0,
    audioSrc: "audio/18-216604033.mp3",
    glyph: "flame",
    summary: "Dry timber crackling in a hearth paired with early vocal speech."
  },
  {
    id: "the-first-tools",
    side: "sounds",
    country: "Earth · Paleolithic",
    title: "The First Tools",
    artist: "Flint Knapping · NASA Sounds of Earth",
    ring: "craft",
    durationSec: 14.7,
    audioSrc: "audio/19-216604184.mp3",
    glyph: "flint",
    summary: "Percussive strikes of hammerstone flaking sharp flint edges."
  },
  {
    id: "tame-dog",
    side: "sounds",
    country: "Earth · Settlement",
    title: "Tame Dog",
    artist: "Canis familiaris · NASA Sounds of Earth",
    ring: "craft",
    durationSec: 4.7,
    audioSrc: "audio/09-216604323.mp3",
    glyph: "companion",
    summary: "Domestic dog bark marking humanity’s earliest interspecies bond."
  },
  {
    id: "herding-sheep-blacksmith-sawing",
    side: "sounds",
    country: "Earth · Pastoral & Craft",
    title: "Herding Sheep, Blacksmith, Sawing",
    artist: "NASA Sounds of Earth",
    ring: "craft",
    durationSec: 56.4,
    audioSrc: "audio/08-216604447.mp3",
    glyph: "anvil",
    summary: "Pastoral flock voices, forged iron anvil blows, and wood sawing."
  },
  {
    id: "tractor-riveter",
    side: "sounds",
    country: "Earth · Industry",
    title: "Tractor, Riveter",
    artist: "NASA Sounds of Earth",
    ring: "craft",
    durationSec: 13.5,
    audioSrc: "audio/07-216604691.mp3",
    glyph: "rivet",
    summary: "Agricultural traction followed by rapid steel frame riveting."
  },
  {
    id: "morse-code-ships",
    side: "sounds",
    country: "Earth · Telegraphy",
    title: "Morse Code, Ships",
    artist: "Ad Astra Per Aspera · NASA Sounds of Earth",
    ring: "craft",
    durationSec: 30.8,
    audioSrc: "audio/06-216604827.mp3",
    glyph: "morse",
    summary: "Radiotelegraph spelling 'AD ASTRA PER ASPERA' and a harbor horn."
  },
  {
    id: "horse-and-cart",
    side: "sounds",
    country: "Earth · Roads",
    title: "Horse and Cart",
    artist: "NASA Sounds of Earth",
    ring: "craft",
    durationSec: 20.3,
    audioSrc: "audio/05-216604954.mp3",
    glyph: "wheel",
    summary: "Shod hooves and spoked carriage wheels along stone pavement."
  },
  {
    id: "train",
    side: "sounds",
    country: "Earth · Steam Rail",
    title: "Train",
    artist: "NASA Sounds of Earth",
    ring: "human",
    durationSec: 21.4,
    audioSrc: "audio/04-216605092.mp3",
    glyph: "steam",
    summary: "Locomotive steam whistle, crossing bell, and steel rail rhythm."
  },
  {
    id: "tractor-bus-auto",
    side: "sounds",
    country: "Earth · Modern Transit",
    title: "Tractor, Bus, Auto",
    artist: "NASA Sounds of Earth",
    ring: "human",
    durationSec: 39.9,
    audioSrc: "audio/03-216605244.mp3",
    glyph: "highway",
    summary: "Gear shifts, urban buses, and highway engines."
  },
  {
    id: "kiss-mother-and-child",
    side: "sounds",
    country: "Earth · Human Bond",
    title: "Kiss, Mother and Child",
    artist: "NASA Sounds of Earth",
    ring: "human",
    durationSec: 24.8,
    audioSrc: "audio/02-216605594.mp3",
    glyph: "embrace",
    summary: "A human kiss, newborn cry, and mother’s comforting voice."
  },
  {
    id: "life-signs-pulsar",
    side: "sounds",
    country: "Earth · Brainwaves & Vela Pulsar",
    title: "Life Signs, Pulsar",
    artist: "Ann Druyan EEG & Pulsar · NASA Sounds of Earth",
    ring: "human",
    durationSec: 51.1,
    audioSrc: "audio/01-216605748.mp3",
    glyph: "pulsar",
    summary: "Ann Druyan’s compressed EEG brainwave trace closing with a pulsar clock."
  }
];

function formatDuration(sec: number): string {
  const rounded = Math.max(1, Math.round(sec));
  const mins = Math.floor(rounded / 60);
  const rem = rounded % 60;
  return `${mins}:${String(rem).padStart(2, "0")}`;
}

export const LP_OUTER_GROOVE_RADIUS = 3.49;
export const LP_INNER_GROOVE_RADIUS = 1.19;

function layoutBandsForSide(seeds: RawTrackSeed[], landGap: number): GoldenSound[] {
  const maxDur = Math.max(...seeds.map((s) => s.durationSec));
  const weights = seeds.map(
    (s) => 0.68 + 0.32 * (Math.log1p(s.durationSec) / Math.log1p(maxDur))
  );
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const totalSpan = LP_OUTER_GROOVE_RADIUS - LP_INNER_GROOVE_RADIUS;
  const usableSpan = totalSpan - landGap * (seeds.length - 1);

  let cursorOuter = LP_OUTER_GROOVE_RADIUS;
  const mmPerUnit = 152.4 / 3.62;

  return seeds.map((seed, idx) => {
    const bandWidth = (weights[idx] / totalWeight) * usableSpan;
    const rOuter = cursorOuter;
    const rInner = cursorOuter - bandWidth;
    cursorOuter = rInner - landGap;

    return {
      ...seed,
      index: idx + 1,
      code: String(idx + 1).padStart(2, "0"),
      rInner,
      rOuter,
      radiusMm: Math.round(((rInner + rOuter) * 0.5) * mmPerUnit),
      durationLabel: formatDuration(seed.durationSec)
    };
  });
}

/** Side 1: 27 International Music compositions covering every country on NASA's page */
export const MUSIC_SOUNDS: GoldenSound[] = layoutBandsForSide(RAW_MUSIC_TRACKS, 0.011);

/** Side 2: 21 Spoken Greetings (55 Languages + UN) & Sounds of Earth */
export const EARTH_SOUNDS: GoldenSound[] = layoutBandsForSide(RAW_SOUND_TRACKS, 0.014);

/** Combined lookup across all 48 grooves */
export const GOLDEN_SOUNDS: GoldenSound[] = [...MUSIC_SOUNDS, ...EARTH_SOUNDS];

export const COVER_DIAGRAMS: CoverDiagramRegion[] = [
  {
    id: "plan-view",
    code: "I",
    shortLabel: "16⅔ RPM",
    title: "16⅔ RPM Phonograph & Binary Rotation",
    subtitle: "Upper-Left Cover Etching",
    decodingNote:
      "Plan view of the record and stylus; dashed binary ticks specify 3.6 seconds per revolution.",
    soundId: "music-01-germany-brandenburg",
    uMin: -0.66,
    uMax: -0.15,
    vMin: -0.71,
    vMax: -0.21
  },
  {
    id: "elevation-view",
    code: "II",
    shortLabel: "Elevation",
    title: "Stylus Elevation & Playing Time",
    subtitle: "Mid-Left Cover Etching",
    decodingNote:
      "Side elevation showing the cartridge tracking from outer rim inward (~1 hour per side).",
    soundId: "music-24-china-flowing-streams",
    uMin: -0.65,
    uMax: -0.05,
    vMin: -0.17,
    vMax: 0.11
  },
  {
    id: "pulsar-map",
    code: "III",
    shortLabel: "Pulsar Map",
    title: "14-Pulsar Solar Location Map",
    subtitle: "Lower-Left Cover Etching",
    decodingNote:
      "Fourteen rays specify binary pulse periods to galactic pulsars triangulating our Sun.",
    soundId: "life-signs-pulsar",
    uMin: -0.66,
    uMax: 0.45,
    vMin: 0.02,
    vMax: 0.72
  },
  {
    id: "video-waveform",
    code: "IV",
    shortLabel: "Waveform",
    title: "Video Scan Waveform & Timing",
    subtitle: "Upper-Right Cover Etching",
    decodingNote:
      "Analog video waveform and binary ~8 ms scan-line markers for decoding recorded images.",
    soundId: "greetings-55-languages",
    uMin: -0.03,
    uMax: 0.66,
    vMin: -0.71,
    vMax: -0.18
  },
  {
    id: "calibration-circle",
    code: "V",
    shortLabel: "Circle",
    title: "Raster Interlace & Calibration Circle",
    subtitle: "Mid-Right Cover Etching",
    decodingNote:
      "512-line vertical raster frame and circular calibration image verifying aspect ratio.",
    soundId: "music-25-india-jaat-kahan-ho",
    uMin: 0.15,
    uMax: 0.48,
    vMin: -0.28,
    vMax: 0.20
  },
  {
    id: "hydrogen-atom",
    code: "VI",
    shortLabel: "Hydrogen-1",
    title: "Hydrogen-1 Hyperfine Transition",
    subtitle: "Lower-Right Cover Etching",
    decodingNote:
      "21 cm proton-electron spin-flip transition providing the universal unit of time and length.",
    soundId: "music-26-usa-dark-was-the-night",
    uMin: 0.18,
    uMax: 0.50,
    vMin: 0.44,
    vMax: 0.64
  }
];
