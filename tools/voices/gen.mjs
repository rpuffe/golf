// Generate the commentator's voice clips with ElevenLabs (eleven_v3, which
// reads inline emotion tags like [whispers] / [sarcastic] / [shouting]).
//
//   node tools/voices/gen.mjs --dry        # count lines, characters, estimated cost
//   node tools/voices/gen.mjs              # generate whatever is missing
//   node tools/voices/gen.mjs --limit 5    # try a few first
//
// The API key is read from ELEVENLABS_API_KEY in the repo's .env (gitignored)
// or the environment. It is never printed. Optional: ELEVENLABS_VOICE_ID.
// Output: web/voice/<key>.mp3 plus web/voice/index.json. Re-running only
// generates clips that are missing, so editing a line costs one clip.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'web/voice');
const { LINES } = await import(path.join(ROOT, 'web/js/commentator.js'));
const { voiceText, voiceTag, voiceKey, tomKey, VOICE_BALLS, VOICE_GHOSTS, VOICE_VERSION, COMMENTATOR_VOICE, TOM_VOICE, TOM_LINES } = await import(path.join(ROOT, 'web/js/voice.js'));

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const LIMIT = args.includes('--limit') ? +args[args.indexOf('--limit') + 1] : Infinity;
const PRUNE = args.includes('--prune');   // delete clips no line uses any more (e.g. an old voice)
const MODEL = 'eleven_v3';
const PRICE_PER_1K = 0.10;   // rough public API rate; check your plan

// ---- every spoken line the game can produce
const jobs = new Map();   // key -> { text, tag }
for (const [cls, sets] of Object.entries(LINES)) {
  for (const set of sets) set.forEach((tpl, tier) => {
    // a generic "the ball" clip first, then one per named ball
    const balls = tpl.includes('{ball}') ? ['(generic)', ...VOICE_BALLS] : [undefined];
    const ghosts = tpl.includes('{ghost}') ? [...VOICE_GHOSTS, '(rival)'] : [undefined];
    for (const ball of balls) for (const ghost of ghosts) {
      const generic = ball === '(generic)';
      const text = voiceText(tpl, { ball, ghost }, generic);
      if (!text) continue;
      const tag = voiceTag(cls, tier), key = voiceKey(text, tag);
      jobs.set(key, { text, tag, cls, tier, named: !!ball && !generic, voice: COMMENTATOR_VOICE });
    }
  });
}
// Old Tom's own lines, in his own voice
for (const [cls, lines] of Object.entries(TOM_LINES)) for (const line of lines) jobs.set(tomKey(line), { text: line, tag: '', cls: 'tom:' + cls, tier: 2, named: false, voice: TOM_VOICE });
fs.mkdirSync(OUT, { recursive: true });
const have = new Set(fs.readdirSync(OUT).filter(f => f.endsWith('.mp3')).map(f => f.slice(0, -4)));
// Funniest first, so a run that stops early (credits, rate limits) still
// covers the best moments: the goose and tug-of-war disasters, the scare,
// deaths and whiffs, with the hysterical tier ahead of the calm ones.
// Most important and funniest first: the goose saga and the scare, then the
// lines you hear every hole, then the rest.
const FUNNY = ['gooseTheft', 'tugStart', 'tugPunt', 'tugSwallow', 'tugBunker', 'tugWin', 'tom:fore', 'tom:laugh', 'scared', 'windmill', 'tugGooseHoled',
  'tee', 'holed', 'ace', 'pure', 'fairway', 'green', 'rough', 'sand', 'water', 'snap', 'saved', 'junk', 'whiff', 'overswing', 'oob', 'tree', 'close', 'lip', 'lipIn',
  'tom:stymie', 'tom:ahead', 'tom:behind', 'tom:holed', 'tom:goose', 'stymie', 'ghostHit', 'calledIt', 'bulletcam', 'rangeBall', 'gooseBlock', 'tomb',
  'rivalHit', 'roomStymie', 'gallery', 'overtake', 'fallBehind', 'roomOvertake', 'roomFallBehind', 'roomLevel', 'rivalHoled'];
// every situation gets a voice before any ball gets its own named clip
const rank = j => (j.named ? 1000 : 0) + (FUNNY.includes(j.cls) ? FUNNY.indexOf(j.cls) : FUNNY.length) * 3 + (2 - j.tier);
const todo = [...jobs.entries()].filter(([k]) => !have.has(k)).sort((a, b) => rank(a[1]) - rank(b[1]));
const chars = todo.reduce((s, [, j]) => s + j.tag.length + 1 + j.text.length, 0);
console.log(`${jobs.size} lines in total, ${have.size} already generated, ${todo.length} to go: ${chars.toLocaleString()} characters (about $${(chars / 1000 * PRICE_PER_1K).toFixed(2)} at $${PRICE_PER_1K}/1k)`);
writeIndex();
if (DRY || !todo.length) process.exit(0);

// ---- key from .env (never echoed)
function envKey(name) {
  if (process.env[name]) return process.env[name];
  try {
    for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && m[1] === name) return m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* no .env */ }
  return '';
}
const API_KEY = envKey('ELEVENLABS_API_KEY');
if (!API_KEY) { console.error('Set ELEVENLABS_API_KEY in .env (repo root, gitignored) first.'); process.exit(1); }
const H = { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' };

// ---- voices come from voice.js; ELEVENLABS_VOICE_ID overrides the commentator
let VOICE = envKey('ELEVENLABS_VOICE_ID') || COMMENTATOR_VOICE;
if (!VOICE) {
  const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: H });
  if (!r.ok) { console.error('Could not list voices:', r.status, (await r.text()).slice(0, 200)); process.exit(1); }
  const { voices } = await r.json();
  const pick = ['George', 'Daniel', 'Brian', 'Charlie'].map(n => voices.find(v => v.name?.startsWith(n))).find(Boolean) ?? voices[0];
  VOICE = pick.voice_id;
  console.log(`voice: ${pick.name} (${pick.labels?.accent ?? '?'} ${pick.labels?.description ?? ''})`);
}

// ---- generate, a few at a time, retrying rate limits
async function gen([key, j]) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${j.voice === COMMENTATOR_VOICE ? VOICE : j.voice}?output_format=mp3_22050_32`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ text: j.tag ? `${j.tag} ${j.text}` : j.text, model_id: MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    });
    if (r.ok) { fs.writeFileSync(path.join(OUT, key + '.mp3'), Buffer.from(await r.arrayBuffer())); return true; }
    if (r.status === 429 || r.status >= 500) { await new Promise(res => setTimeout(res, 2000 * (attempt + 1))); continue; }
    console.error(`\n${key} failed: ${r.status} ${(await r.text()).slice(0, 300)}`);
    if (r.status === 401 || r.status === 402) process.exit(1);   // bad key / out of credits: stop spending
    return false;
  }
  return false;
}
const queue = todo.slice(0, LIMIT);
let done = 0, failed = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (queue.length) {
    const job = queue.shift();
    if (await gen(job)) done++; else failed++;
    process.stdout.write(`\r${done} generated, ${failed} failed, ${queue.length} left   `);
  }
}));
console.log();
writeIndex();

function writeIndex() {
  if (PRUNE) for (const f of fs.readdirSync(OUT)) if (f.endsWith('.mp3') && !jobs.has(f.slice(0, -4))) fs.unlinkSync(path.join(OUT, f));
  const keys = fs.readdirSync(OUT).filter(f => f.endsWith('.mp3')).map(f => f.slice(0, -4)).filter(k => jobs.has(k)).sort();
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ version: VOICE_VERSION, model: MODEL, keys }) + '\n');
}
