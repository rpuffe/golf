// The course. Tees sit near the origin and holes play toward -Z, so the
// default first-person view looks down the fairway.
//
// Ellipses are [cx, cz, rx, rz]. Hills are [x, z, radius, height].
// Each hole spotlights one feature (see design/). The windmill, the graveyard
// and moon gravity came from the round-6 council (design/council-round6.md);
// the bowling green, crazy golf and the finale from round 7
// (design/council-round7.md).

import { mulberry32 } from './trees.js';

export const HOLES = [
  {
    name: 'The Welcome Committee',
    par: 4, seed: 11,
    spotlight: 'goose',
    tee: [0, 0], pin: [14, -248],
    path: [[0, -6], [-3, -140], [14, -248]],
    fairwayWidth: 28,
    bounds: [-55, -278, 60, 14],
    greenSize: [14, 12], greenTilt: [-0.012, 0.01],
    hills: [[-35, -80, 30, 3], [40, -190, 35, 4], [10, -275, 22, 1.0]],   // the green sits low and gentle
    bunkers: [[19, -156, 8, 5], [-6, -238, 4, 3], [26, -252, 3.5, 4]],
    ponds: [],
    trees: { density: 0.9 },
    geese: [{ area: [-2, -158, 14], radius: 26 }],   // the welcome committee meets a lot of drives
    goslings: 2,
    wind: 3,
  },
  {
    name: "Gerald's Lake",
    par: 3, seed: 23,
    spotlight: 'angler',
    tee: [0, 0], pin: [-8, -116],
    path: [[0, -6], [0, -30], [-8, -116]],
    fairwayWidth: 18,
    bounds: [-45, -145, 42, 14],
    greenSize: [12, 10], greenTilt: [0.01, 0.014],
    hills: [[-28, -50, 18, 2.5], [25, -100, 18, 3]],
    bunkers: [[-9, -129, 7, 2.5], [4, -107, 2.5, 3.5]],
    ponds: [[-3, -66, 20, 17]],
    trees: { density: 0.7 },
    geese: [{ area: [-22, -108, 6], radius: 14 }, { area: [14, -124, 5], radius: 14 }],
    wind: 4,
  },
  {
    name: "Old Tom's Stymie",
    par: 4, seed: 37,
    spotlight: 'stymie',
    tee: [0, 0], pin: [-60, -222],
    path: [[0, -6], [0, -135], [-60, -222]],
    fairwayWidth: 24,
    bounds: [-105, -250, 40, 14],
    greenSize: [15, 12], greenTilt: [0.02, -0.016], greenBumps: 0.25,
    hills: [[-60, -230, 30, 0.9], [22, -55, 26, 3]],
    bunkers: [[-44, -208, 4, 3], [14, -140, 7, 4]],
    ponds: [],
    trees: { density: 1.1, clumps: [[-30, -98, 14], [-85, -150, 12]] },
    geese: [{ area: [-10, -150, 10], radius: 14 }, { area: [-50, -196, 5], radius: 14, breed: 'toulouse' }],
    wind: 2.5,
  },
  {
    name: 'Sunset Strip',
    par: 5, seed: 51,
    spotlight: 'scope',
    tee: [0, 0], pin: [28, -382],
    path: [[0, -6], [-5, -160], [10, -270], [28, -382]],
    fairwayWidth: 28,
    bounds: [-60, -410, 75, 14],
    greenSize: [13, 11], greenTilt: [-0.016, 0.012],
    hills: [[-35, -110, 28, 4], [48, -210, 28, 3.5], [14, -400, 22, 1.0]],
    bunkers: [[14, -366, 4, 2.5], [40, -388, 3.5, 4.5], [-22, -175, 6, 4]],
    ponds: [[10, -262, 34, 14]],
    trees: { density: 0.8 },
    geese: [{ area: [4, -330, 12], radius: 14 }, { area: [-12, -150, 12], radius: 14 }, { area: [38, -370, 5], radius: 14, breed: 'canada' }],
    wind: 6.5,
  },
  {
    name: 'The Bowling Green',
    par: 4, seed: 115,
    spotlight: 'bowling',
    tee: [0, 0], pin: [0, -276],
    path: [[0, -6], [0, -200], [0, -276]],
    fairwayWidth: 16, banking: 0.1,
    bounds: [-50, -304, 50, 14],
    greenSize: [14, 12], greenTilt: [0.01, -0.012],
    hills: [[-38, -90, 26, 3], [38, -120, 26, 3], [0, -296, 22, 1.0]],
    bunkers: [[-10.5, -140, 2.2, 26], [10.5, -140, 2.2, 26],   // the gutters
      [-9, -286, 4, 3], [9, -264, 3.5, 4]],
    ponds: [],
    trees: { density: 0.8 },
    // ten geese racked like pins where a pure drive stops; the 5-pin is the Toulouse kingpin
    bowling: { at: [0, -132], gap: 1.15, row: 1.0, rows: 4, kingpin: 4, gutters: [0, 1] },
    geese: [{ area: [-14, -250, 6], radius: 14 }, { area: [14, -228, 6], radius: 14 }],   // lane attendants
    wind: 2,
    hint: 'Ten geese. One ball. Bowl.',
  },
  {
    name: 'The Windmill of Spite',
    par: 4, seed: 67,
    spotlight: 'windmill',
    tee: [0, 0], pin: [-12, -292],
    path: [[0, -6], [0, -160], [-12, -292]],
    fairwayWidth: 36,
    bounds: [-60, -322, 60, 14],
    greenSize: [14, 12], greenTilt: [0.012, -0.01],
    hills: [[-40, -60, 26, 3], [42, -150, 30, 4], [-30, -310, 22, 1.0]],
    bunkers: [[14, -168, 6, 4], [-26, -276, 4, 3], [2, -306, 5, 2.5]],
    ponds: [],
    trees: { density: 0.8 },
    windmill: { at: [0, -100], hubH: 9, len: 8.5, blades: 4, period: 5, step: 0.9, tower: 2.4, towerH: 12, face: 2.6 },
    geese: [{ area: [-6, -175, 14], radius: 14 }, { area: [10, -205, 10], radius: 14 }, { area: [-14, -268, 8], radius: 14 }],
    wind: 3.5,
    hint: 'It only spins when you swing.',
  },
  {
    name: "Old Tom's Plot",
    par: 3, seed: 79,
    spotlight: 'scare',
    tee: [0, 0], pin: [6, -136],
    path: [[0, -6], [0, -60], [6, -136]],
    fairwayWidth: 20,
    bounds: [-42, -162, 46, 14],
    greenSize: [13, 11], greenTilt: [-0.01, 0.012],
    hills: [[-26, -70, 18, 2.5], [28, -120, 16, 3]],
    bunkers: [[-4, -124, 3.2, 1.2], [15, -142, 4, 2.5]],   // the first one is "the open grave"
    ponds: [],
    trees: { density: 0.5, clumps: [[-24, -110, 9], [30, -60, 8]] },
    tombs: { area: [2, -80, 34, 60], n: 46, clear: 5 },
    geese: [{ area: [-12, -150, 5], radius: 9, stare: true }, { area: [18, -128, 5], radius: 9, stare: true }],
    wind: 1.5,
    hint: 'Shh. Old Tom is resting.',
  },
  {
    name: 'Crazy Golf',
    par: 2, seed: 131,
    spotlight: 'mini',
    tee: [0, 0], pin: [2.2, -16],
    path: [[0, 0], [0, -8], [2.2, -16]],
    fairwayWidth: 40, roll: 0, banking: 0, teeLift: 0,
    bounds: [-30, -40, 30, 12],
    greenSize: [8, 13], greenCenter: [1, -8], greenTilt: [0, 0], greenBumps: 0,
    hills: [], bunkers: [], ponds: [],
    trees: { density: 0.5 },
    // a felt lane between rails; one of three obstacle decks is drawn per round (resolveHole)
    mini: {
      w: 2.8, rail: 0.09, railH: 0.22, oobPad: 0.6, decks: [
        { deck: 'The Turnstile', windmill: { axis: 'y', at: [0.7, -11.6], hubH: 0.14, len: 1.25, blades: 3, period: 2.8, step: 1.3, bladeR: 0.11, tower: 0.12, towerH: 0.5, face: 0 } },
        { deck: 'Pinball', bumpers: [[0.5, -4, 0.28], [-0.6, -6, 0.28], [0.9, -7, 0.28], [0.0, -13.5, 0.28], [2.4, -13.0, 0.28]] },
        { deck: 'The Camel', ridges: [[-1.6, -5, 1.6, -5, 0.9, 0.25], [-0.8, -12.4, 3.6, -11.2, 0.9, 0.32]] },
      ],
    },
    geese: [{ area: [0.3, -5, 1.2], radius: 4 }],
    wind: 0,
    hint: 'Crazy golf. Putter only, in spirit.',
  },
  {
    name: 'The Last Moonshot',
    par: 5, seed: 97,
    spotlight: 'moon', finale: true,
    tee: [0, 0], pin: [24, -420],
    path: [[0, -6], [-10, -200], [24, -420]],
    fairwayWidth: 30,
    bounds: [-75, -452, 85, 14],
    greenSize: [16, 13], greenTilt: [0.008, 0.01], greenBumps: 0.2,
    hills: [[0, 6, 26, 12], [24, -420, 34, 9], [-36, -300, 24, 3], [62, -250, 26, 4]],   // a 12 m launch pad, a 9 m mesa
    bunkers: [[6, -404, 4, 3], [44, -412, 3.5, 4], [-26, -292, 6, 4]],
    ponds: [[-6, -168, 34, 13], [8, -372, 30, 9]],   // the crater lake, the moat
    trees: { density: 0.6 },
    airGravity: 0.5,
    // the Honk Hole: stronger every stroke from the third (x1.3, x1.6 ... capped at x2.2)
    bossAura: { at: [16, -385], r: 24, core: 3, pull: 3.5, swirl: 5.0, top: 18, fade: 12, ground: 0.3, grow: 0.3, growMax: 2.2 },
    geese: [{ area: [16, -385, 2], radius: 16, boss: true }, { area: [2, -390, 8], radius: 14 }, { area: [32, -392, 8], radius: 14 },
      { area: [-14, -210, 12], radius: 14, breed: 'canada' }, { area: [10, -240, 12], radius: 14 }, { area: [-30, -300, 10], radius: 14 }],
    goslings: 3,
    wind: 4,
    hint: 'Last hole. The Honk Hole grows.',
  },
];

export const TOTAL_PAR = HOLES.reduce((s, h) => s + h.par, 0);

// Crazy golf draws one obstacle deck per round from the round seed: a pure
// function, so everyone in a room (and Old Tom) plays the same layout.
export function resolveHole(h, seed) {
  const d = h.mini?.decks; if (!d) return h;
  const k = Math.floor(mulberry32(((seed ?? 0) ^ 0x51ed27) >>> 0)() * d.length);
  return { ...h, ...d[k], deckIdx: k };
}
