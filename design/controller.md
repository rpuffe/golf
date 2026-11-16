# Controllers and TV mode

Owner ask (relayed): add game controller support plus a TV mode, so the game
plays well in Microsoft Edge on Xbox Series X|S or One, and in any desktop
browser with a controller. No native app. Built after council round 8.

## Mapping (Gamepad API, standard mapping)

| Input | In play | In menus and cards |
| --- | --- | --- |
| Left stick | Aim (squared response: fine near the centre) and look up/down | Move the focus ring (auto-repeat) |
| D-pad | Nudge the aim, slowly | Move the focus ring |
| Right stick | **Swing:** pull back (depth = power), then one smooth push forward (tempo); leaning the push curves it | |
| RT (hold while swinging) | **Power swing:** the rim becomes 115%, like dragging the mouse further (more distance, a hook). Clicking the stick in does the same | |
| Ⓐ | Skip: flyover, wheel, bullet cam, goose airlift, scare, Sasquack. Tee off now (Final Group). Mash it in a tug. Hold it to reel | Press the focused button; on a text field, open the on-screen keys |
| Ⓑ | Cancel a swing (free) | Back: close Help, the leaderboard, the keys or quick chat; on the between card, back to "Next hole" |
| Ⓧ | Take a gimme, or put a ball back | Be the Goose / Stand here: send it to the middle of the view. On the keys: delete |
| Ⓨ | **Overview:** a sky view of the shot; aim still works up there, Ⓨ or Ⓑ returns | |
| LB / RB | Previous / next club (skips clubs you can't use from here) | |
| LT (hold) | Rangefinder scope | |
| RT (hold) | While scoped: steady (hold your breath). Also reels and sprays | |
| ☰ Menu | Help (Controls) | Close Help |
| ⧉ View | Quick chat in a room; sound on/off when solo | Quick-chat phrases on the between card |
| Waggle either stick | Tug-of-war effort | |

## The stick swing, through the council's lenses

- **Golf Purist: deterministic and learnable.** How far you pull (after a
  radial dead zone of 0.18) is power, full deflection is 100%, and the meter
  shows it as you pull. Leaving the top starts the tempo clock, and the push
  completes the strike. Holding at the top is free.
- **Tempo, owner playtest:** "I have to flick it… it should be one smooth
  motion." Two fixes. First, a units bug: the spring-back cancel compared
  milliseconds with seconds, so any swing that spent two frames crossing the
  centre was cancelled; only a flick survived. Second, the stick has its own
  tempo window (`stickTempo`): a downswing of up to ~0.55 s at full power (a
  little longer for a chip) is a pure strike, with no penalty for being
  quicker, and slower swings fade to a slack strike by ~1.4 s. A thumbstick
  travels the whole gate, so it gets a roomier window than the mouse flick.
- **Curve:** the push's sideways lean at impact sets the curve (`stickDrift`).
  A wobble under 0.1 is straight; a lean of 0.65 or more is the full hook or
  slice. The same stick path always gives the same shot.
- **Overswing parity:** with a mouse or a phone you overswing just by
  dragging further, so holding RT during a stick swing does the same. RT
  power swing 124.7 m against the mouse's 124.5 m at full drag (test hole,
  same tee). It is never something you fall into by resting on the rim.
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

| Smooth sweep, top to full forward | Power | Tempo | Carry | Side |
| --- | --- | --- | --- | --- |
| 0.4 s | 100% | 1.00 | 106.6 m | −0.5 m |
| 0.9 s | 100% | 0.81 | 98.6 m | −0.5 m |
| 2.0 s (very slow) | 100% | 0.00 | 63.5 m | −0.2 m |
| 0.6 s, lean 0.25 | 100% | 1.00 | 106.2 m | 3.7 m |
| 0.6 s, lean 0.8 right | 100% | 1.00 | 101.6 m | 23.1 m |
| 0.6 s, lean 0.6 left | 100% | 1.00 | 102.2 m | −16.9 m |

The tempo spread is 40% (the bar is 30%), and the curve is 23% of carry
(the bar is 10%).

## Aiming in landscape

The address camera stands 0.75 m to the side of the ball (the TV angle). It
used to look parallel to the shot line, so the middle of the screen sat
0.75 m beside where the ball went: about 3° on a 15 m chip, and worse on a
putt. The camera now turns in to meet the shot line at the playing distance
(the pin for a putt, the full-power carry otherwise), so the crosshair is on
the line.

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
