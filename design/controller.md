# Controllers and TV mode

Owner ask (relayed): add game controller support plus a TV mode, so the game
plays well in Microsoft Edge on Xbox Series X|S or One, and in any desktop
browser with a controller. No native app. Built after council round 8.

## Mapping (Gamepad API, standard mapping)

| Input | In play | In menus and cards |
| --- | --- | --- |
| Left stick | Aim (squared response: fine near the centre) and look up/down | Move the focus ring (auto-repeat) |
| D-pad | Nudge the aim, slowly | Move the focus ring |
| Right stick | **Swing:** pull back (depth = power), push forward (tempo), push at an angle (curve) | |
| Right stick click | Overswing: up to 115%, if clicked in at the top | |
| Ⓐ | Skip: flyover, wheel, bullet cam, goose airlift, scare, Sasquack. Tee off now (Final Group). Mash it in a tug. Hold it to reel | Press the focused button; on a text field, open the on-screen keys |
| Ⓑ | Cancel a swing (free) | Back: close Help, the leaderboard, the keys or quick chat; on the between card, back to "Next hole" |
| Ⓧ | Take a gimme, or put a ball back | Be the Goose / Stand here: send it to the middle of the view. On the keys: delete |
| Ⓨ | Quick chat (rooms) | Quick-chat phrases on the between card |
| LB / RB | Previous / next club | |
| LT (hold) | Rangefinder scope | |
| RT (hold) | Steady the scope (hold your breath). Also reels | |
| ☰ Menu | Help (Controls) | Close Help |
| ⧉ View | Sound on/off | |
| Waggle either stick | Tug-of-war effort | |

## The stick swing, through the council's lenses

- **Golf Purist: deterministic and learnable.** The right stick replays the
  mouse swing exactly. How far you pull (after a radial dead zone of 0.18) is
  power, full deflection is 100%, and the meter shows it as you pull. Leaving
  the top starts the tempo clock, and the push completes the strike: the same
  `tempoNow()` the mouse flick uses, so holding at the top is free and a
  smooth, quick push is a pure strike. The push's angle curves the ball as a
  slanted flick does (a 45° push at full power gives the full hook or slice).
  The same stick path always gives the same shot. Overswing is a deliberate
  extra (click the stick in), never something you fall into by holding the
  stick on its rim.
- **Player Advocate: no punishment for fumbling.** Letting the stick spring
  back to centre without a push cancels at no cost (the S14 replacement,
  "lift to cancel", in stick form), and so does Ⓑ. A goose that steals the
  ball mid-backswing cancels it, and a fresh swing needs the stick back at
  centre first. The first Ⓐ in a menu only shows where the focus ring is;
  it never presses anything.
- **Slide-up-to-lower-power (S14) stays rejected.** Easing the stick back
  toward you after leaving the top winds the swing up again at no cost, but
  the power never goes down mid-swing.

Swing checks (rubric criterion 2, headless, simulated pad):

| Push | Power | Tempo | Carry | Side |
| --- | --- | --- | --- | --- |
| Fast (40 ms) | 100% | 1.00 | 108.8 m | 0.4 m |
| Medium (350 ms) | 100% | 0.53 | 88.1 m | 0.3 m |
| Slow (800 ms) | 100% | 0.00 | 62.4 m | 0.2 m |
| Fast, 45° right | 100% | 1.00 | 103.6 m | 23.6 m |
| Fast, 30° left | 100% | 1.00 | 105.0 m | −16.2 m |

The tempo spread is 43% (the bar is 30%), and the curve is 23% of carry
(the bar is 10%).

## Input switching and TV mode

- Whichever input moved last (touch, mouse/keyboard, or the pad) decides
  every hint, Help row, card and skip label. Phones still never carry
  keyboard strings in the page (round 8, S10).
- **TV mode** (`body.tv`): on while a controller is driving, and always on an
  Xbox. The HUD sits inside 5% safe margins and is drawn 1.3× larger. Cards
  are 1.2× larger on screens taller than 820 px, and the tug, reel and
  money-putt strips scale too. A desktop monitor driven by a mouse is never
  enlarged.
- **The focus ring** is a 4 px gold outline with a soft glow, on every menu,
  the lobby, Help, the between-hole card and the end card.
- **On-screen keys** (A–Z, space, delete, Done) are used for names and room
  codes. A room code closes the keys by itself after four letters and
  focuses Join.
- `navigator.gamepadInputEmulation = 'gamepad'` is set where it exists, so
  the browser doesn't turn the controller into a mouse pointer. Arrow and
  paging keys never scroll the page.

## Not verified without a real Xbox

- Edge on Xbox: whether the browser hands the controller to the page
  (Gamepad API) or keeps it as a cursor. If it stays a cursor, the player
  may need to switch the browser's controller mode.
- How the Xbox Edge viewport and safe area look on a real TV (overscan).
- Real stick feel: dead zone, rim deflection and spring return speed were
  simulated. Tune `DZ` and `SWING.settle` in `web/js/pad.js` if a real
  release fails to cancel, or a slow push cancels.
- The controller vibrating. No rumble was added.
