// Preset characters. Every field is optional (see DEFAULTS in rig.js).
// Colours avoid pure green so the #00FF00 key-colour path stays a fair test.
export const PRESETS = {
  fox: {
    label: 'Fox', ears: 'fox', skin: '#f08a3c', muzzle: '#fff3e2', earInner: '#fff3e2', earTip: '#4a2a2e',
    hairStyle: 'none', eyeColor: '#7a4a1e', noseColor: '#3a2430',
    shirt: '#3f6fb5', neckline: 'scarf', accent: '#e6465a', shirtDetail: 'none',
  },
  bear: {
    label: 'Bear', ears: 'bear', skin: '#a8714a', muzzle: '#ecd0a8', earInner: '#d9a07a', noseColor: '#2f1d27',
    hairStyle: 'none', eyeColor: '#3a2418', glasses: 'none',
    shirt: '#e8a23a', neckline: 'crew', accent: '#fff3d6', shirtDetail: 'stripe', blushColor: '#ff8aa0',
  },
  cat: {
    label: 'Cat', ears: 'cat', skin: '#b9b4c9', muzzle: '#f4f1fa', earInner: '#f7a8c0',
    hairStyle: 'none', eyeColor: '#2f87b8',
    shirt: '#c05fa8', neckline: 'v', accent: '#ffd36b', shirtDetail: 'badge',
  },
  beard: {
    label: 'Beard guy', ears: 'human', skin: '#e0a97e', hairStyle: 'messy', hairColor: '#3b2c42',
    facialHair: 'beard', eyeColor: '#4a2f22',
    shirt: '#44465f', neckline: 'crew', accent: '#e8505b',
  },
  bun: {
    label: 'Bun + glasses', ears: 'human', skin: '#f5d0b0', hairStyle: 'bun', hairColor: '#7a3b2a',
    glasses: 'round', glassesColor: '#2b1d33', eyeColor: '#2f6f8f',
    shirt: '#e9d58a', neckline: 'collar', accent: '#e8688a',
  },
  bunny: {
    label: 'Bunny', ears: 'bunny', skin: '#f3eef6', muzzle: '#ffffff', earInner: '#f7a8c0',
    hairStyle: 'none', eyeColor: '#a03d6a',
    shirt: '#7aa6e8', neckline: 'turtle', accent: '#ffb3c8', blushColor: '#ff7fa0',
  },
  robot: {
    label: 'Robot', ears: 'bolt', headShape: 'square', skin: '#b9c8da', hairStyle: 'none',
    headwear: 'antenna', eyeColor: '#18b7d9', blush: false, accent: '#ffb02e',
    shirt: '#5a6a85', neckline: 'boat', shirtDetail: 'badge',
  },
  beanie: {
    label: 'Beanie bob', ears: 'human', skin: '#8a5a3c', hairStyle: 'bob', hairColor: '#1d1520',
    headwear: 'beanie', headwearColor: '#d9453f', accent: '#fff0d0', eyeColor: '#3a2418',
    glasses: 'square', glassesColor: '#e8a23a', shirt: '#6a4fb8', neckline: 'turtle',
  },
}
