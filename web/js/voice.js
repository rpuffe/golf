// Pre-generated commentator voice (ElevenLabs, made once by
// tools/voices/gen.mjs and shipped in web/voice/). Shared by the game and the
// generator so both turn a caption template into exactly the same spoken text.
//
// Player names can't be pre-recorded, so the spoken line says "the golfer"
// or "their rival" where the caption shows the real name. Ball names and Old
// Tom are fixed, so those are voiced for real.

export const VOICE_VERSION = 'v2';   // v2: Nathaniel (live football commentator) replaces George
// ElevenLabs voice-library ids (public, not secrets)
export const COMMENTATOR_VOICE = '9rR45HW0vcBmpCbkc4m9';   // Nathaniel: British, live football commentary
export const TOM_VOICE = 'ztnpYzQJyWffPj1VC5Uw';           // Sean: an old Scotsman, for the ghost of Old Tom

// Old Tom speaks for himself (solo rounds): short, dry, Scottish, a bit smug.
export const TOM_LINES = {
  fore: ['[whispers] Fore.'],
  laugh: ['[laughs] Heh heh heh.'],
  stymie: ['[mischievously] Och. Is that my ball in yer way? What a shame.', '[mischievously] I was here first. I was here in eighteen eighty-two.',
    '[innocently] Oh, am I in the way? I hadnae noticed.', '[smug] Chip over me, if ye\'ve the nerve.'],
  ahead: ['[smug] Par was my religion. You are a heretic.', '[chuckles] Ye cannae beat a dead man at his own game.',
    '[smug] I can see yer scorecard from up here. Dear me.', '[chuckles] Take yer time. I\'ve got eternity.', '[dry] Even the geese are embarrassed for ye.'],
  behind: ['[grumbling] Lucky. Pure luck.', '[sighs] In my day the ball was made of feathers.',
    '[grumbling] The greens were faster in my day. Much faster.', '[muttering] I\'d like to see ye do that with a hickory shaft.', '[huffs] Beginner\'s luck. It runs out.'],
  holed: ['[satisfied] In the hole. As it should be.', '[smug] Plop. That\'s the sound of experience.', '[chuckles] Never doubted it. Not once in a hundred years.',
    '[satisfied] Rattled the bottom of the cup. Lovely.', '[dry] Holed. Carve that on my stone.', '[pleased] The old ways still work, laddie.'],
  goose: ['[laughs] The goose! Oh, I do love that goose.', '[cackles] That goose has better hands than you.',
    '[amused] I fed that goose\'s great-grandmother. Good stock.', '[laughs] Never turn yer back on a goose. Never.'],
  final: ['[gravely] Last hole. Loser buys the drinks.'],
  bonk: ['[dryly] Bonked that bird in fifty-two, too.'],
  possessed: ['[outraged] Get yer hands off my ball!', '[indignant] That is cheating. And I would know.',
    '[spluttering] In my day they hanged men for less.', '[grumbling] Mind the leather. It\'s older than yer grandfather.'],
  possessBad: ['[furious] Ye absolute scoundrel!', '[seething] I will remember this. I have eternity to remember this.', '[wailing] My ball! My poor wee ball!'],
  possessHoled: ['[confused] Did... did ye just hole that for me? Well. Thank ye.'],
  haunt: ['[cackles] Let\'s see ye play through a draught, laddie.', '[menacing] Getting a wee bit far ahead, are we?',
    '[whispers] Feel that chill? That\'s me.', '[chuckles] A wee breeze. From the other side.'],
};
export const VOICE_BALLS = ['Bounce Springsteen', 'Sir Thud', 'Butterfingers', 'Clover', 'Lord Floofington', 'Nervous Nigel', 'Range Ball #4471'];
export const VOICE_GHOSTS = ['Old Tom', 'your old self'];
// tier 1 lines that are good news get excitement; the rest get sarcasm
const POSITIVE = new Set(['pinsHalf', 'pinsMost', 'bossBonk', 'choreWin', 'pure', 'fairway', 'green', 'greenBirdie', 'holed', 'ace', 'lipIn', 'saved', 'close', 'overtake', 'calledIt', 'tugWin', 'roomOvertake', 'roomLevel', 'gooseHit', 'tugGooseHoled', 'strike', 'finale']);

export function voiceTag(cls, tier) {
  return tier === 0 ? '[whispers]' : tier === 2 ? '[shouting]' : POSITIVE.has(cls) ? '[excited]' : '[sarcastic]';
}

// The spoken version of a caption template, or null if it can't be voiced.
// generic: say "the ball" instead of the ball's name (one clip covers all balls;
// the game prefers a named clip when one exists).
export function voiceText(template, vars = {}, generic = false) {
  const bare = template.replace(/\{\w+\}/g, '');
  const up = bare === bare.toUpperCase() && /[A-Z]{3}/.test(bare);   // hysterical lines are in caps
  let bad = false;
  let out = template.replace(/\{(\w+)\}/g, (_, k) => {
    let v;
    if (k === 'ball') { v = generic ? 'the ball' : VOICE_BALLS.includes(vars.ball) ? vars.ball : null; if (v === 'Range Ball #4471') v = 'Range Ball four-four-seven-one'; }
    else if (k === 'ghost') v = VOICE_GHOSTS.includes(vars.ghost) ? vars.ghost : 'their rival';
    else if (k === 'name') v = 'the golfer';
    else if (k === 'rival') v = 'their rival';
    else v = null;
    if (v === null) { bad = true; return ''; }
    return up ? v.toUpperCase() : v;
  });
  if (bad) return null;
  // capitalise sentence starts, but not after an ellipsis ("The crowd... is silent.")
  return out.replace(/(^|(?<!\.)[.!?]\s+)([a-z])/g, (_, a, c) => a + c.toUpperCase());
}

export function voiceKey(text, tag, who = '') {
  let h = 2166136261;
  for (const c of `${VOICE_VERSION}|${who}${tag} ${text}`) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// Old Tom's clips: key from the line itself (no separate tag).
export const tomKey = line => voiceKey(line, '', 'tom|');
