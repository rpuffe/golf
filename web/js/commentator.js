// Whisper-to-Hysteria: a hushed golf-broadcast voice that comes unglued as
// things go wrong. Every line is captioned (captions never depend on
// speechSynthesis), lines never repeat back-to-back, and speech is
// fire-and-forget so it can never block input.

import { voiceText, voiceTag, voiceKey, TOM_LINES, tomKey } from './voice.js';
import { playVoice, stopVoice } from './audio.js';

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
          ['Safely on the putting surface.', 'On the green. Now the hard part.', 'GREEEEN! SOMEONE GIVE {name} A KNIGHTHOOD!']],
  // (round 8, S15) only said when the next putt really is for birdie
  greenBirdie: [['That will leave a look at birdie.', 'Green in regulation. Mostly in regulation.', 'GREEEEN! SOMEONE GIVE {name} A KNIGHTHOOD!']],
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
  gooseTheft: [['Oh. Oh no. The goose has {ball}.', 'THE GOOSE. The goose has taken {ball}. Get ready to pull, {name}!', 'THE GOOSE IS A THIEF! A FEATHERED THIEF! GET READY TO PULL!'],
    ['And the goose... has taken {ball}.', 'Thief! The goose is off with {ball}!', 'ROBBERY! BROAD DAYLIGHT! THE GOOSE HAS {ball}!']],
  knockOn: [['A little contact there. {rival} will not enjoy that.', 'Oh, it has clattered into {rival}! Billiards!', 'IT HIT {rival}! IT IS SNOOKER NOW! NOBODY IS SAFE!'],
    ['{name} has moved {rival} on. Rub of the green.', 'Knocked {rival} clean off the spot! Cheeky!', 'CLACK! {name} IS PLAYING POOL WITH A FRIENDSHIP!']],
  knockedBy: [["And {rival} has moved {name}'s ball for them.", '{rival} has knocked {name} sideways! Literally!', '{rival} HIT THE BALL! THE BALL IS MOVING! THIS IS AN ASSAULT!']],
  knockIn: [['Knocked in by {rival}. Under the old rules, that counts.', '{rival} has holed it for {name}! Is that allowed? It is!', '{rival} PUTTED {name} IN! NINETEEN FIFTY-ONE RULES! IT COUNTS!']],
  teeth: [['A goose with a familiar walk. That is {rival}.', "That goose is {rival}! It wants {name}'s ball!", '{rival} HAS BECOME A GOOSE AND IS COMING FOR {name}! HIT IT! HIT IT NOW!'],
    ["The goose is wearing {rival}'s colours. Hurry, {name}.", '{rival}, in goose form, is closing in!', 'IT IS {rival}! IN A GOOSE! WHY IS {rival} A GOOSE!']],
  teethMiss: [['And {name} plays before the goose arrives.', 'Too slow, {rival}! The goose face-plants!', '{name} HIT IT FIRST! THE GOOSE HAS FALLEN OVER! LOOK AT IT!']],
  fanSave: [["Off {rival}'s umbrella and out of trouble. Lovely.", '{rival} has saved it! With an umbrella!', "{rival}'S BROLLY HAS SAVED {name}! KNIGHTHOOD! KNIGHTHOOD FOR THE BROLLY!"]],
  fanRob: [["Off {rival}'s umbrella. That will cost {name}.", "{rival}'s umbrella has robbed {name}! Daylight robbery!", '{rival} STOOD THERE ON PURPOSE! I SAW IT! THE UMBRELLA IS GUILTY!']],
  fanBonk: [["A gentle bonk off {rival}'s umbrella.", 'Off the brolly! {rival} is part of the course now!', '{rival} HAS BEEN HIT! {rival} IS FINE! THE UMBRELLA IS NOT!']],
  tugRelay: [['A lateral pass. The geese are organised.', 'They are PASSING it! It is a team sport now!', 'IT IS RUGBY! THE GEESE PLAY RUGBY! TRY! TRY!']],
  tugBrood: [['The goose is... sitting on {ball}.', 'It is BROODING on {ball}. That is not an egg!', 'IT LAID AN EGG! {ball} IS AN EGG NOW! SCIENCE IS OVER!']],
  tugPond: [['A hammer throw. Into the water.', 'Olympic form from the goose! Into the drink!', 'IT THREW {ball} IN THE LAKE! GET THE ROD! IT IS FREE! GET IT!']],
  tugStash: [['The goose has hidden {ball} up a tree.', 'Up the tree! Why the tree? What is in the tree?', 'DO NOT GO IN THE TREES! NOBODY GOES IN THE TREES!']],
  sasquack: [['Something in the trees has taken an interest in {ball}.', 'That is not a goose. That is a GOOSE. It has arms, {name}.', 'IT HAS ARMS! WHY DOES THE GOOSE HAVE ARMS! WHO HAS BEEN FEEDING IT!'],
    ['And the Sasquack will play this one for {name}. With a tree.', 'It pulled a pine tree out of nowhere. It is taking a practice swing.', 'IT IS GOLFING WITH A TREE! ITS TEMPO IS BETTER THAN {name}! I AM GOING HOME!']],
  tugStart: [['It has come to this. A tug of war.', 'Pull, {name}! Pull for {ball}!', 'PULL! PULL! PULL FOR YOUR LIFE! PULL FOR {ball}!'],
    ['The goose plants its feet.', 'Man against goose. Only one leaves with {ball}.', 'IT IS A TUG OF WAR WITH A GOOSE! THIS IS NOT GOLF! I LOVE IT!']],
  tugWin: [['And {name} wrestles {ball} free. Remarkable.', 'YOINK! {ball} is back! The goose is furious!', '{name} BEAT THE GOOSE! {name} BEAT A GOOSE IN SINGLE COMBAT!'],
    ['{ball} is recovered. The goose sulks.', 'The goose lets go! {name} wins the tug!', 'THE GOOSE HAS LOST! FEATHERS EVERYWHERE! WHAT A COMEBACK!']],
  tugPunt: [['The goose... has kicked {ball}. Away.', 'The goose PUNTED {ball}! Look at it go!', 'THE GOOSE DROP-KICKED {ball}! INTO THE SKY! I HAVE SEEN EVERYTHING!'],
    ['A tidy little punt from the goose.', 'It won, and it kicked {ball} for good measure!', 'IT KICKED THE BALL! GEESE CAN KICK? NOBODY TOLD ME GEESE CAN KICK!']],
  tugBunker: [['The goose is airborne, with {ball}.', 'It is flying {ball} to the bunker! Out of spite!', 'THE GOOSE HAS AN AIR FORCE! {ball} IS GOING TO THE BEACH!'],
    ['A short flight to the sand.', 'Special delivery: one {ball}, to the bunker.', 'IT FLEW AWAY WITH IT! IT FLEW AWAY WITH {ball}!']],
  tugSwallow: [['The goose has... eaten {ball}. Goodbye, {ball}.', 'It SWALLOWED {ball}! Is that allowed? It is not allowed!', 'IT ATE {ball}! IT ATE {ball} WHOLE! SOMEBODY CALL A VET!']],
  tugGooseHoled: [['The goose has holed it. For you. Unbelievable.', 'THE GOOSE PUNTED IT IN! The goose should turn pro!', 'THE GOOSE HOLED IT! SIGN THE GOOSE! SIGN THE GOOSE!']],
  // round 7: the Bowling Green, crazy golf, and the finale
  strike: [['A strike. Ten geese, all down.', 'STRIKE! All ten! The geese are furious!', 'STRIKE! TEN GEESE! I HAVE NEVER BEEN SO PROUD!']],
  // (owner) bowling calls by the count
  pinsOne: [['One goose down. A start.', 'ONE goose! The other nine are laughing!', 'ONE GOOSE! I WILL TAKE IT! I WILL TAKE ONE GOOSE!']],
  pinsFew: [['A few geese down. Polite applause.', 'Some geese down! The rest are furious!', 'GEESE DOWN! NOT ALL OF THEM, BUT GEESE!']],
  pinsHalf: [['Half the flock is down.', 'Half the geese down! The other half is livid!', 'HALF THE GEESE! THAT IS SO MANY GEESE!']],
  pinsMost: [['Nearly all of them. So close.', 'So close! The last goose is standing smugly!', 'ALMOST ALL OF THEM! THE LAST ONE IS LAUGHING AT US!']],
  gutter: [['Into the gutter. Unlucky.', 'Gutter ball! In golf! That is a first.', 'GUTTER BALL! WRONG SPORT! WRONG SPORT ENTIRELY!']],
  crazy: [['Off the woodwork. Classic crazy golf.', 'It is a pinball machine in there!', 'IT HIT EVERYTHING! THIS IS NOT GOLF, IT IS AN ARCADE!']],
  bossAngry: [['The Honk Hole is getting stronger.', 'The whirlpool is growing! Hurry, {name}!', 'IT IS GROWING! THE HONK HOLE IS HUNGRY!']],
  finale: [['And that is the round. What a day.', 'That is the round! Fetch me a lie-down!', 'THE ROUND IS OVER! I HAVE NO VOICE LEFT! GOODNIGHT!']],
  windmill: [['Oh, the windmill has taken an interest.', 'SWATTED by the windmill! It only moves when you swing!', 'THE WINDMILL! THE WINDMILL HATES {name}! IT WAITED FOR THIS!'],
    ['Off the sails. Mini golf rules apply.', 'The windmill sends it back. Spiteful thing.', 'IT HIT THE WINDMILL! WHO PUT A WINDMILL ON A GOLF COURSE!']],
  tomb: [['Off a headstone. Respectfully.', 'Clattered a gravestone. Sorry, whoever you were.', 'IT HIT A GRAVE! DO NOT WAKE THEM! DO NOT WAKE ANYONE!']],
  scared: [['What was that. Par, I think.', 'WHAT WAS THAT. Was that Old Tom? Par, I think.', 'WHAT WAS THAT! WHAT WAS THAT! I AM UNDER THE DESK! PAR, I THINK!']],
  // (owner's inside joke) the brood hands the ball back mucky, or as a potato
  broodWash: [['It brooded on it. It is... sticky.', 'Goose muck! Somebody fetch the pressure washer!', 'IT IS COVERED IN GOOSE! POWER WASH IT! POWER WASH IT NOW!']],
  broodPotato: [['The egg has hard-boiled. Into a potato.', 'It is a potato now! Peel it! Peel it!', 'A POTATO! SHE SAT ON IT AND MADE A POTATO! PEEL FOR YOUR LIFE!']],
  sandWash: [['Sand in every dimple. Give it a wash.', 'Sandy ball! Fetch the pressure washer!', 'IT IS FULL OF SAND! POWER WASH IT! POWER WASH IT NOW!']],
  // (council round 9) the Boss fight and the Honk Strike
  bossGuard: [['The Boss is sitting on the cup.', 'It is ON the cup! Bonk it!', 'THE BOSS HAS THE CUP! BONK IT!']],
  bossBonk: [['A clean bonk. The crown is off.', 'BONK! Right on the crown, {name}!', 'YOU BONKED THE BOSS! LONG LIVE {name}!']],
  bossYield: [['The Boss steps aside. Out of pity.', 'It just... let you in. Embarrassing.', 'IT FELT SORRY FOR YOU! SORRY!']],
  honkStrike: [['The Boss has called in air support.', 'Geese inbound! Swing, {name}, swing!', 'INCOMING! IT IS RAINING GEESE!']],
  choreWin: [['Spotless. Back to golf.', 'Good as new! Better than new!', 'SPARKLING! I CAN SEE MY FACE IN IT!']],
  choreFail: [['Not quite done. That will play heavy.', 'Half a job! That will cost you some distance!', 'HALF DONE! THE NEXT SHOT IS GOING TO BE UGLY!']],
  // the scare on a hole that wasn't a par: the gag, without a wrong score
  scaredOff: [['What was that. I have lost count.', 'WHAT WAS THAT. Was that Old Tom? Somebody else keep score.', 'WHAT WAS THAT! WHAT WAS THAT! I AM UNDER THE DESK! I CANNOT COUNT FROM HERE!']],
  gallery: [['The gallery has opinions.', 'The gallery has opinions, and they are loud.', 'THE GALLERY IS GOING WILD! EVERYONE HAS AN OPINION!']],
  gooseBlock: [['The goose was in the way.', 'Bounced right off the goose. Unbelievable.', 'THE GOOSE BLOCKED IT! THE GOOSE IS PLAYING DEFENCE!'],
    ['The goose stands its ground.', 'Off the goose! It did not even flinch!', 'THE GOOSE IS A WALL! A FEATHERED WALL!']],
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
  saved: [['{ball} is landed! Saved from the deep.', 'Reeled in! {ball} lives to roll again!', '{name} CAUGHT IT! {ball} LIVES! IT IS A MIRACLE!'],
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
  overswing: [['A big, big swing.', 'Swinging out of the shoes there.', '{name} SWUNG SO HARD THE HAT FLEW OFF!'],
    ['Everything on that one.', '{name} has gone after that with real violence.', '{name} SWUNG LIKE THE BALL OWED THEM MONEY!']],
};

export const LINES = L;
const lastIdx = {};
// which pre-recorded clips exist (web/voice/index.json); empty until it loads
let clips = new Set();
let clipsFailed = false;
fetch('/voice/index.json').then(r => r.ok ? r.json() : null).then(j => { if (j?.keys?.length) clips = new Set(j.keys); else clipsFailed = true; }).catch(() => { clipsFailed = true; });
// Big moments outrank chatter: a lower-priority line can't stomp a bigger one
// that's still on screen (e.g. the race update can't cut off a eulogy).
const PRIO = { pinsOne: 2, pinsFew: 2, pinsHalf: 3, pinsMost: 3, bossGuard: 4, bossBonk: 4, bossYield: 3, honkStrike: 3, sandWash: 2, broodWash: 3, broodPotato: 3, choreWin: 2, choreFail: 2, greenBirdie: 1, scaredOff: 4, strike: 4, gutter: 2, crazy: 2, bossAngry: 3, finale: 4, knockOn: 3, knockedBy: 3, knockIn: 4, teeth: 3, teethMiss: 2, fanSave: 3, fanRob: 3, fanBonk: 2, tugRelay: 3, tugBrood: 3, tugPond: 3, tugStash: 3, sasquack: 4, windmill: 3, tomb: 2, scared: 4, gallery: 1, tugStart: 3, tugWin: 3, tugPunt: 3, tugBunker: 3, tugSwallow: 4, tugGooseHoled: 4, snap: 3, gooseTheft: 3, ghostHit: 3, stymie: 3, holed: 3, ace: 4, lipIn: 1, rangeBall: 3, saved: 2, junk: 2, water: 2, bulletcam: 1, close: 2, overtake: 0, fallBehind: 0, tee: 1, roomOvertake: 0, roomFallBehind: 0, rivalHoled: 1, rivalHit: 3, calledIt: 1, roomStymie: 3, roomLevel: 0 };
let busyUntil = 0;
// (round 8, S11) one line at a time: a line has the floor for about as long as
// it takes to say. Anything smaller waits in a single pending slot and is
// dropped if it would come out more than ~2 s late (no narrating the last
// shot). Only a bigger line, or a top-priority one, takes the floor early.
const talkMs = line => 900 + line.length * 55;
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
// iOS Safari (and Chrome's autoplay policy) only allow speech once an
// utterance has been started inside a user gesture. Call this from a tap or
// click handler: it speaks one silent word so later lines are allowed.
let primed = false;
export function primeSpeech() {
  // with recorded clips we never use the browser's voice, and on iOS touching
  // speechSynthesis grabs the audio session and can silence Web Audio
  if (primed || !clipsFailed) return;
  try {
    const ss = window.speechSynthesis;
    if (!ss || typeof SpeechSynthesisUtterance === 'undefined') return;
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0; u.rate = 2;
    ss.speak(u);
    primed = true;
    if (!voice) { try { const vs = ss.getVoices(); voice = vs.find(v => /en-GB/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null; } catch { /* later */ } }
  } catch { /* captions still work */ }
}
export function setVoiceEnabled(on) { enabled = on; if (!on) { stopVoice(); if (clipsFailed) try { window.speechSynthesis?.cancel(); } catch {} } }
export function voiceEnabled() { return enabled; }

export function tier() { return commentator.hysteria < 34 ? 0 : commentator.hysteria < 67 ? 1 : 2; }
export function bumpHysteria(d) { commentator.hysteria = Math.max(0, Math.min(100, commentator.hysteria + (d > 0 ? d * 1.5 : d))); }

// (owner playtest) "the voice lines keep talking over each other": one voice
// at a time, never cut off. While a line plays, one slot holds the best line
// waiting (funny and rare beat routine), and a line that would come out stale
// is dropped. The everyday calls (stepping up, fairway, green...) go quiet
// after you've heard them a couple of times; the gags always get their turn.
const COMMON = new Set(['tee', 'fairway', 'green', 'greenBirdie', 'rough', 'sand', 'holed', 'close', 'bulletcam', 'overtake', 'fallBehind',
  'roomOvertake', 'roomFallBehind', 'roomLevel', 'rivalHoled', 'lipIn', 'gallery', 'whiff', 'overswing', 'calledIt', 'pure']);
const FUNNY = new Set(['gooseTheft', 'tugStart', 'tugPunt', 'tugSwallow', 'tugBunker', 'tugWin', 'tugRelay', 'tugBrood', 'tugPond', 'tugStash', 'tugGooseHoled',
  'scared', 'scaredOff', 'windmill', 'snap', 'junk', 'sasquack', 'strike', 'gutter', 'crazy', 'bossAngry', 'finale', 'broodPotato', 'broodWash', 'sandWash',
  'pinsOne', 'pinsFew', 'pinsHalf', 'pinsMost', 'choreWin', 'choreFail', 'bossGuard', 'bossBonk', 'bossYield', 'honkStrike', 'teeth', 'knockIn', 'rangeBall', 'ace', 'tomb', 'ghostHit', 'stymie', 'gooseBlock', 'water', 'oob', 'rivalHit', 'roomStymie']);
const voicedN = {};
let voicePending = null, drainTimer = 0;
function lineValue(cls, tr) {
  const n = voicedN[cls] ?? 0;
  let v = (PRIO[cls] ?? 1) * 10 + (tr === 2 ? 3 : 0);
  if (FUNNY.has(cls)) v += 8;
  if (COMMON.has(cls)) v -= 6 + 4 * Math.min(3, n); else v += Math.max(0, 6 - 3 * n);
  return v;
}
function scheduleDrain() {
  clearTimeout(drainTimer);
  drainTimer = setTimeout(drain, Math.max(0, busyUntil - performance.now()) + 40);
}
function drain() {
  const it = voicePending; voicePending = null;
  if (!it) return;
  if (performance.now() < busyUntil) { voicePending = it; scheduleDrain(); return; }
  if (performance.now() - it.at > (it.tom ? 9000 : it.value >= 40 ? 5000 : 2500)) return;   // too late to be about this moment
  playLine(it);
}
function enqueue(it) {
  const now = performance.now();
  if (now < busyUntil || voicePending) {
    if (COMMON.has(it.cls) && it.value < 20) return;   // chatter never waits in line
    // Old Tom's lines are rare and personal: once waiting, a commentator line never bumps him
    if (!voicePending || (it.value >= voicePending.value && !(voicePending.tom && !it.tom))) voicePending = it;
    scheduleDrain();
    return;
  }
  playLine(it);
}
function playLine(it) {
  const now = performance.now();
  if (it.tom) { showTomCaption(it.text); busyUntil = now + talkMs(it.text); if (enabled && clips.has(it.key)) startVoice(`/voice/${it.key}.mp3`, now); scheduleDrain(); return; }
  commentator.lastLine = it.line; commentator.lastClass = it.cls;
  commentator.history.push({ cls: it.cls, line: it.line, tier: it.tr });
  showCaption(it.line, it.tr);
  // an everyday call you've heard twice: mostly a caption, and it doesn't hold the floor
  const quiet = COMMON.has(it.cls) && (voicedN[it.cls] ?? 0) >= 2 && Math.random() > 0.35;
  busyUntil = now + (quiet ? 900 : talkMs(it.line));
  if (!quiet && speak(it.line, it.tr, it.cls, it.tpl, it.vars, now)) voicedN[it.cls] = (voicedN[it.cls] ?? 0) + 1;
  scheduleDrain();
}
// a clip's real length decides when the next line may start
function startVoice(url, at) {
  playVoice(url).then(d => { if (d > 0) { busyUntil = Math.max(busyUntil, at + d * 1000 + 250); scheduleDrain(); } });
}

export function say(cls, vars = {}, { bump = 0 } = {}) {
  if (bump) bumpHysteria(bump);
  const sets = L[cls];
  if (!sets) return;
  const tr = tier();
  // choose a variant set, never repeating the exact same line twice in a row
  const key = cls;
  let i = Math.floor(Math.random() * sets.length);
  if (sets.length > 1 && i === lastIdx[key]) i = (i + 1) % sets.length;
  lastIdx[key] = i;
  let tpl = sets[i][tr];
  let line = tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  if (line === commentator.lastLine) {
    const alt = sets.map(s => s[tr]).find(l => l !== sets[i][tr]);
    if (!alt) return;
    tpl = alt;
    line = alt.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  }
  enqueue({ cls, vars, tpl, line, tr, at: performance.now(), value: lineValue(cls, tr) });
}

function showCaption(text, tr) {
  if (!captionEl) return;
  delete captionEl.dataset.who;
  captionEl.textContent = text;
  captionEl.dataset.tier = tr;
  captionEl.classList.remove('show'); void captionEl.offsetWidth; captionEl.classList.add('show');
  clearTimeout(captionTimer);
  captionTimer = setTimeout(() => captionEl.classList.remove('show'), 2600 + text.length * 45);
}
function showTomCaption(text) {
  if (!captionEl) return;
  captionEl.textContent = text; captionEl.dataset.tier = 0; captionEl.dataset.who = 'tom';
  captionEl.classList.remove('show'); void captionEl.offsetWidth; captionEl.classList.add('show');
  clearTimeout(captionTimer);
  captionTimer = setTimeout(() => { captionEl.classList.remove('show'); delete captionEl.dataset.who; }, 2600 + text.length * 45);
}

// returns true when a recorded clip (or the browser voice) is speaking the line
function speak(text, tr, cls, tpl, vars, at = performance.now()) {
  if (!enabled) return false;
  // a real voice actor (pre-generated) when we have the clip, else the browser's voice
  if (tpl) {
    const tag = voiceTag(cls, tr);
    // the clip with this ball's name if we have it, else the one that says "the ball"
    for (const vt of [voiceText(tpl, vars), tpl.includes('{ball}') ? voiceText(tpl, vars, true) : null]) {
      if (!vt) continue;
      const key = voiceKey(vt, tag);
      if (clips.has(key)) { startVoice(`/voice/${key}.mp3`, at); return true; }
    }
  }
  if (!clipsFailed) return false;   // recorded voice only: a missing clip stays caption-only
  try {
    const ss = window.speechSynthesis;
    if (!ss || typeof SpeechSynthesisUtterance === 'undefined') return false;
    ss.cancel();
    const u = new SpeechSynthesisUtterance(tr === 2 ? text : text.toLowerCase().replace(/^./, c => c.toUpperCase()));
    if (voice) u.voice = voice;
    u.pitch = [0.8, 1.15, 1.6][tr];
    u.rate = [0.88, 1.08, 1.3][tr];
    u.volume = [0.55, 0.8, 1][tr];
    ss.speak(u);
    return true;
  } catch { return false; }
}

// Old Tom talks for himself (in his own voice, a Scot from 1882). His line
// takes over the caption with a ghostly style. At most once every 20 s.
let tomAt = -1e9;
// Variety (playtest: "the same one a couple of times in a row"): each kind of
// line is dealt from a shuffled deck, so nothing repeats until every line has
// had its turn (and never twice running across a reshuffle), and each kind
// waits its own while before it comes round again.
const TOM_GAP = { holed: 75000, goose: 25000, ahead: 45000, behind: 45000, stymie: 35000 };
const tomDeck = {}, tomLast = {}, tomKindAt = {};
function dealTom(cls, lines) {
  let deck = tomDeck[cls];
  if (!deck?.length) {
    deck = tomDeck[cls] = lines.slice().sort(() => Math.random() - 0.5);
    if (deck.length > 1 && deck[0] === tomLast[cls]) deck.push(deck.shift());
  }
  return (tomLast[cls] = deck.shift());
}
export function tomSay(cls, { force = false } = {}) {
  const lines = TOM_LINES[cls]; if (!lines) return false;
  const now = performance.now();
  if (!force && (now - tomAt < 12000 || now - (tomKindAt[cls] ?? -1e9) < (TOM_GAP[cls] ?? 0))) return false;
  tomAt = now; tomKindAt[cls] = now;
  const line = dealTom(cls, lines);
  const text = line.replace(/\[[^\]]*\]\s*/g, '').trim(), key = tomKey(line);
  const it = { tom: true, cls: 'tom:' + cls, text, key, at: now, value: 70 };
  if (force) { stopVoice(); busyUntil = 0; voicePending = null; playLine(it); }   // the scare's whisper and laugh are timed to the jump
  else enqueue(it);
  return clips.has(key);
}
