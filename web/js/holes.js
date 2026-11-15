// The course. Tees sit near the origin and holes play toward -Z, so the
// default first-person view looks down the fairway.
//
// Ellipses are [cx, cz, rx, rz]. Hills are [x, z, radius, height].
// Each hole spotlights one of the five signature features (see design/).

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
    hills: [[-35, -80, 30, 3], [40, -190, 35, 4], [10, -275, 22, 3]],
    bunkers: [[19, -156, 8, 5], [-6, -238, 4, 3], [26, -252, 3.5, 4]],
    ponds: [],
    trees: { density: 0.9 },
    goose: { area: [-2, -158, 14], radius: 42 },   // the welcome committee meets every drive
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
    goose: { area: [-22, -108, 6], radius: 9 },
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
    hills: [[-60, -230, 30, 2.6], [22, -55, 26, 3]],
    bunkers: [[-44, -208, 4, 3], [14, -140, 7, 4]],
    ponds: [],
    trees: { density: 1.1, clumps: [[-30, -98, 14], [-85, -150, 12]] },
    goose: { area: [-10, -150, 10], radius: 9 },
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
    hills: [[-35, -110, 28, 4], [48, -210, 28, 3.5], [14, -400, 22, 3]],
    bunkers: [[14, -366, 4, 2.5], [40, -388, 3.5, 4.5], [-22, -175, 6, 4]],
    ponds: [[10, -262, 34, 14]],
    trees: { density: 0.8 },
    goose: { area: [4, -330, 12], radius: 9 },
    wind: 6.5,
  },
];

export const TOTAL_PAR = HOLES.reduce((s, h) => s + h.par, 0);
