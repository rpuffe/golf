// Whisper-to-Hysteria: a hushed golf-broadcast voice that comes unglued as
// things go wrong. Every line is captioned (captions never depend on
// speechSynthesis), lines never repeat back-to-back, and speech is
// fire-and-forget so it can never block input.

const L = {
  // [calm, rattled, hysterical]
  tee: [
    ['And {name} steps up to the tee. {ball} in hand. The crowd... is silent.', 'Here we go again. {ball} on the tee. Deep breaths, everyone.', 'THEY ARE STILL PLAYING. {ball} ON THE TEE. SOMEBODY CALL MY MOTHER.'],
  ],
  pure: [['Oh, that is pure. Listen to that.', 'Now THAT is a golf shot.', 'PURE! PURE! I AM WEEPING ON LIVE TELEVISION!'],
    ['Flushed.', 'Off the screws, as they say.', 'THAT IS THE SOUND OF GOLF! THAT IS THE SOUND!']],
  fairway: [['Finds the short grass. Lovely.', 'Fairway. Thank heavens.', 'FAIRWAY! THE FAIRWAY! I HAD FORGOTTEN IT EXISTED!'],
            ['Settles nicely in the fairway.', 'Safely in the fairway, for once.', 'IT IS ON THE GRASS. THE NICE GRASS. I COULD KISS IT.']],
  rough: [['Into the rough. A tricky lie.', 'The rough again. The rough knows {ball} by name now.', 'THE ROUGH! THE JUNGLE! {ball} IS GONE TO THE WILD!'],
          ['A touch wayward. Long grass.', 'Wayward. Very, very wayward.', 'WHERE ARE YOU AIMING? THE GRASS IS SO LONG, JIM!']],
  sand: [['The bunker. A test of nerve.', 'Sand. Of course it is sand.', 'THE BEACH! WE ARE ON HOLIDAY NOW, APPARENTLY!'],
         ['Plugged in the trap.', 'In the trap. The trap was laid and we walked right in.', 'SAND! SAND EVERYWHERE! IN MY SHOES! IN MY SOUL!']],
  green: [['On the dance floor.', 'On the green. Hold your applause, it may not last.', 'THE GREEN! I AM STANDING UP! I AM STANDING ON MY CHAIR!'],
          ['That will leave a look at birdie.', 'Green in regulation. Mostly in regulation.', 'GREEEEN! SOMEONE GIVE {name} A KNIGHTHOOD!']],
  water: [['Oh dear. A splash. {ball} is in the water.', 'Into the drink. {ball} is swimming with the fishes.', 'WATER! {ball} IS DROWNING! GET THE ROD! GET THE ROD!'],
          ['Wet. That is wet.', 'The lake claims another.', 'SPLASH! WHY IS IT ALWAYS THE WATER, JIM? WHY?']],
  oob: [['Out of bounds. Stroke and distance.', 'Out of bounds. {ball} has left the property.', 'IT IS IN THE CAR PARK! {ball} IS ON THE MOTORWAY!'],
    ['That one has left the golf course.', 'Gone. Over the fence. Somebody check the greenhouse.', 'OUT! OUT! IT IS IN A DIFFERENT POSTCODE!']],
  holed: [['And it drops. Lovely stuff.', 'In! In the hole! Finally!', 'IN THE HOLE! IN THE HOLE! I AM LOSING MY VOICE!'],
          ['Holed. The gallery murmurs approvingly.', 'It rattles in. Thank goodness.', 'IT IS IN! IT IS IN! CALL THE NEWSPAPERS!']],
  ace: [['A hole in one. I... have no words.', 'A HOLE IN ONE. I take back everything.', 'HOLE IN ONE! HOLE IN ONE! I AM QUITTING MY JOB TO FOLLOW {name}!']],
  lip: [['Lips out. Agonising.', 'Around the edge and OUT. The cup hates us.', 'IT LIPPED OUT! THE HOLE SPAT IT OUT! THIS IS PERSONAL!'],
    ['Ohh, it caught the edge.', 'Lip out. The hole is being petty.', 'THE CUP SAID NO! THE CUP SAID NO, JIM!']],
  lipIn: [['Round the lip... and in.', 'It lipped... AND IN! Cheeky!', 'IT WENT ROUND THE RIM AND IN! MY HEART!'],
    ['Took the scenic route. Still counts.', 'All the way round the edge... and down!', 'THE LIP! THE LIP! IT FELL IN! IT FELL IN!']],
  tree: [['Clips the timber.', 'Into the trees. A woodpecker would have done better.', 'THE TREE! THE TREE HAS BETRAYED US!'],
    ['Timber. Literally.', 'The trees want it more than we do.', 'IT HIT ANOTHER TREE! THE FOREST IS WINNING!']],
  gooseTheft: [['Oh. Oh no. The goose has {ball}.', 'THE GOOSE. The goose has taken {ball}. Shoo it, {name}!', 'THE GOOSE IS A THIEF! A FEATHERED THIEF! HIT IT! HIT THE GOOSE!'],
    ['And the goose... has taken {ball}.', 'Thief! The goose is off with {ball}!', 'ROBBERY! BROAD DAYLIGHT! THE GOOSE HAS {ball}!']],
  gooseHit: [['Direct hit on the goose. It drops {ball}.', 'BONK! Right on the goose. Justice!', 'YOU HIT THE GOOSE! THE GOOSE IS FURIOUS! I LOVE THIS SPORT!'],
    ['A well-aimed shoo. The goose objects.', 'Goose struck! It drops {ball} in disgust!', 'DIRECT HIT! FEATHERS EVERYWHERE! GLORIOUS!']],
  gooseBlock: [['The goose was in the way.', 'Bounced right off the goose. Unbelievable.', 'THE GOOSE BLOCKED IT! THE GOOSE IS PLAYING DEFENCE!'],
    ['The goose stands its ground.', 'Off the goose! It did not even flinch!', 'THE GOOSE IS A WALL! A FEATHERED WALL!']],
  gooseDrop: [['The goose loses interest and drops {ball}.', 'The goose has dropped {ball}. We may continue.', 'THE GOOSE LET IT GO. THE GOOSE IS IN CHARGE NOW.'],
    ['The goose tires of {ball}.', '{ball} has been released by the goose. Generously.', 'THE GOOSE DROPPED IT! WE ARE ALLOWED TO PLAY AGAIN!']],
  shooMiss: [['The shoo misses. The goose is unbothered.', 'Missed the goose. The goose noticed.', 'MISSED! THE GOOSE IS LAUGHING AT US!'],
    ['Wide of the goose.', 'The goose watched that one sail past.', 'MISSED AGAIN! THE GOOSE IS GETTING AWAY WITH IT!']],
  ghostHit: [['A collision with the ghost of {ghost}!', 'Bounced off {ghost}! The dead are playing defence!', 'THE GHOST! THE GHOST HIT IT! I SAW IT WITH MY OWN EYES!'],
    ['A spectral nudge from {ghost}.', 'Clipped by the ghost! The afterlife is competitive!', 'THE DEAD ARE ON THE COURSE! THE DEAD ARE ON THE COURSE!']],
  stymie: [['A stymie. {ghost} is sitting right on the line.', 'Stymied! {ghost} is blocking the putt. Golf banned this in 1952!', 'A STYMIE! FROM BEYOND THE GRAVE! {ghost} WILL NOT MOVE!'],
    ['{ghost} is right on your line.', 'The ghost ball sits in the way. Curl it round, or chip over.', 'BLOCKED! BLOCKED BY A SPIRIT! THIS SPORT IS HAUNTED!']],
  overtake: [['And {name} edges ahead of {ghost}.', 'Ahead of {ghost}! Take that, spectre!', 'AHEAD OF THE GHOST! ANYTHING IS POSSIBLE!'],
    ['{name} nudges in front of {ghost}.', 'And {name} takes the lead from {ghost}!', 'IN FRONT! IN FRONT OF A GHOST! HISTORY!']],
  fallBehind: [['{ghost} slips ahead.', '{ghost} pulls ahead. The dead are good at this.', 'BEHIND A GHOST! BEATEN BY A DEAD MAN!'],
    ['{ghost} edges in front.', 'The ghost of {ghost} glides ahead.', 'THE GHOST IS WINNING! I CANNOT WATCH!']],
  snap: [['The line snaps. {ball} is gone. Rest well, {ball}.', 'SNAP. {ball} sinks. A moment of silence please.', '{ball}! NOOOO! {ball} WAS TOO YOUNG!'],
    ['The line goes slack. {ball} is lost.', '{ball} slips beneath the surface. Forever.', 'NOT {ball}! THEY HAD SO MUCH LEFT TO GIVE!']],
  saved: [['{ball} is landed! Saved from the deep.', 'Reeled in! {ball} lives to roll again!', 'HE CAUGHT IT! {ball} LIVES! IT IS A MIRACLE!'],
    ['Out of the depths comes {ball}.', '{ball} is back from the brink!', '{ball} RISES FROM THE LAKE! A RESURRECTION!']],
  junk: [['That is... a boot.', 'That is not a golf ball. That is rubbish.', 'IT IS A BOOT! WHY IS THERE A BOOT! WHERE IS {ball}!'],
    ['Well. That is a catch, of sorts.', 'Not what we were fishing for.', 'THAT IS NOT A GOLF BALL! WHAT HAVE YOU CAUGHT!']],
  rangeBall: [['All five balls are gone. Range Ball four-four-seven-one, everyone.', 'Out of balls. Here comes the range ball. It smells.', 'NO BALLS LEFT! THEY ARE USING A RANGE BALL! THE SHAME!']],
  bulletcam: [['Watch this...', 'Watch this, watch this, watch this...', 'LOOK AT IT GO! LOOK AT IT GO!'],
    ['Here it comes...', 'Oh, look at this, look at this...', 'GET IN! GET IN! GET IN!']],
  close: [['Stiff. That is stiff to the pin.', 'Right next to the flag!', 'NEXT TO THE PIN! THE CROWD IS ON FIRE!'],
    ['Tight to the flag. Lovely.', 'Tap-in range!', 'IT IS STONE DEAD! THE CROWD IS LOSING IT!']],
  whiff: [['Hm. That barely moved.', 'That... was a swing. Technically.', 'IT MOVED ONE INCH! ONE! INCH!'],
    ['A gentle... nudge.', 'That was more of a suggestion than a shot.', 'IT BARELY MOVED! IS THE BALL GLUED DOWN?']],
  // multiplayer rooms: {rival} is a real friend's name
  roomOvertake: [['And {name} moves past {rival}.', '{name} overtakes {rival}! Friendships are being tested!', '{name} IS AHEAD OF {rival}! SOMEBODY CHECK ON {rival}!'],
    ['{name} edges in front of {rival}.', 'Past {rival}! The group chat will hear about this!', 'OVERTAKEN! {rival} HAS BEEN OVERTAKEN! I NEED A LIE DOWN!']],
  roomFallBehind: [['{rival} slips ahead.', '{rival} goes past. {name} will not enjoy that.', '{rival} IS AHEAD! THIS IS A BETRAYAL OF THE HIGHEST ORDER!'],
    ['{rival} moves in front.', 'And {rival} takes the lead from {name}.', '{rival} PULLS AHEAD! {name} IS BEING HUMILIATED IN FRONT OF FRIENDS!']],
  rivalHoled: [['{rival} holes out. Polite applause.', '{rival} is in. The pressure mounts.', '{rival} HOLED IT! {name}, YOUR MOVE! YOUR MOVE!'],
    ['And {rival} is down.', 'Holed by {rival}. Make of that what you will.', '{rival} IS IN THE HOLE! THE NERVE OF IT!']],
  rivalHit: [["Oh, that has struck {rival}'s ball.", "Straight into {rival}'s ball! Billiards, now!", "{name} HAS HIT {rival}'S BALL! THIS IS SNOOKER! THIS IS WAR!"],
    ["A clip off {rival}'s ball.", "Cannoned off {rival}! Deliberate? We may never know.", "OFF {rival}'S BALL! I DEMAND A STEWARDS' ENQUIRY!"]],
  calledIt: [['Right on the number. Called it.', 'Called the shot! Landed on the mark!', '{name} CALLED IT! POINTED AT THE SKY AND CALLED IT!'],
    ['Exactly where intended.', 'On the mark. Like a dart. A golf dart.', 'ON THE MARK! I HAVE NEVER SEEN SUCH PRECISION! I AM SHAKING!']],
  roomStymie: [["{rival}'s ball is right on {name}'s line.", "Stymied by {rival}! Friendship is a hazard!", "{rival} IS BLOCKING THE HOLE! IS THIS ALLOWED? IT IS ALLOWED!"],
    ["{rival} is in the way.", "{rival}'s ball sits on the line. Curl it, chip it, or knock it in.", "BLOCKED BY {rival}! I SMELL A RIVALRY!"]],
  roomLevel: [['And {name} draws level with {rival}.', 'All square with {rival}! Nobody breathe!', '{name} AND {rival} ARE LEVEL! THE TENSION IS UNBEARABLE!'],
    ['{name} pulls level with {rival}.', 'Level with {rival}. It is anyone\'s round.', 'DEAD LEVEL WITH {rival}! I CANNOT FEEL MY HANDS!']],
  overswing: [['A big, big swing.', 'Swinging out of the shoes there.', 'HE SWUNG SO HARD HIS HAT FELL OFF!'],
    ['Everything on that one.', 'He has gone after that with real violence.', 'HE SWUNG LIKE HE OWED IT MONEY!']],
};

const lastIdx = {};
// Big moments outrank chatter: a lower-priority line can't stomp a bigger one
// that's still on screen (e.g. the race update can't cut off a eulogy).
const PRIO = { snap: 3, gooseTheft: 3, ghostHit: 3, stymie: 3, holed: 3, ace: 4, lipIn: 1, rangeBall: 3, saved: 2, junk: 2, water: 2, gooseHit: 3, bulletcam: 1, close: 2, overtake: 0, fallBehind: 0, tee: 1, roomOvertake: 0, roomFallBehind: 0, rivalHoled: 1, rivalHit: 3, calledIt: 1, roomStymie: 3, roomLevel: 0 };
let lastPrio = 0, lastAt = 0, pending = null;
let voice = null, enabled = true, captionEl = null, captionTimer = 0;
export const commentator = { hysteria: 0, lastLine: '', lastClass: '', history: [] };

export function initCommentator(el) {
  captionEl = el;
  const pick = () => {
    try {
      const vs = window.speechSynthesis?.getVoices() ?? [];
      voice = vs.find(v => /en-GB/i.test(v.lang) && /daniel|male|arthur|oliver/i.test(v.name))
        || vs.find(v => /en-GB/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
    } catch { voice = null; }
  };
  pick();
  try { window.speechSynthesis?.addEventListener?.('voiceschanged', pick); } catch {}
}
export function setVoiceEnabled(on) { enabled = on; if (!on) try { window.speechSynthesis?.cancel(); } catch {} }
export function voiceEnabled() { return enabled; }

export function tier() { return commentator.hysteria < 34 ? 0 : commentator.hysteria < 67 ? 1 : 2; }
export function bumpHysteria(d) { commentator.hysteria = Math.max(0, Math.min(100, commentator.hysteria + (d > 0 ? d * 1.5 : d))); }

export function say(cls, vars = {}, { bump = 0 } = {}) {
  if (bump) bumpHysteria(bump);
  const sets = L[cls];
  if (!sets) return;
  const prio = PRIO[cls] ?? 1, now = performance.now();
  if (prio < lastPrio && now - lastAt < 3500) {
    // queue it (latest wins) for when the bigger line has had its moment
    const p = pending = { cls, vars };
    setTimeout(() => { if (pending === p) { pending = null; say(p.cls, p.vars); } }, 3600 - (now - lastAt));
    return;
  }
  if (pending && pending.cls === cls) pending = null;
  lastPrio = prio; lastAt = now;
  const tr = tier();
  // choose a variant set, never repeating the exact same line twice in a row
  const key = cls;
  let i = Math.floor(Math.random() * sets.length);
  if (sets.length > 1 && i === lastIdx[key]) i = (i + 1) % sets.length;
  lastIdx[key] = i;
  let line = sets[i][tr];
  line = line.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  if (line === commentator.lastLine) {
    // never say the exact same thing twice in a row: try the other variants
    const alt = sets.map(s => s[tr]).find(l => l !== sets[i][tr]);
    if (!alt) return;
    line = alt.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  }
  commentator.lastLine = line; commentator.lastClass = cls;
  commentator.history.push({ cls, line, tier: tr });
  showCaption(line, tr);
  speak(line, tr);
}

function showCaption(text, tr) {
  if (!captionEl) return;
  captionEl.textContent = text;
  captionEl.dataset.tier = tr;
  captionEl.classList.remove('show'); void captionEl.offsetWidth; captionEl.classList.add('show');
  clearTimeout(captionTimer);
  captionTimer = setTimeout(() => captionEl.classList.remove('show'), 2600 + text.length * 45);
}

function speak(text, tr) {
  if (!enabled) return;
  try {
    const ss = window.speechSynthesis;
    if (!ss || typeof SpeechSynthesisUtterance === 'undefined') return;
    ss.cancel();
    const u = new SpeechSynthesisUtterance(tr === 2 ? text : text.toLowerCase().replace(/^./, c => c.toUpperCase()));
    if (voice) u.voice = voice;
    u.pitch = [0.8, 1.15, 1.6][tr];
    u.rate = [0.88, 1.08, 1.3][tr];
    u.volume = [0.55, 0.8, 1][tr];
    ss.speak(u);
  } catch { /* captions already shown */ }
}
