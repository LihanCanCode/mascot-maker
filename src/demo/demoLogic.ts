const DEFAULT_CUPS = 2
const MIN_CUPS = 1
const MAX_CUPS = 8
const CUP_ML = 250
const WATER_PER_COFFEE = 16

export const DEMO_PICKS: readonly string[] = ['fox', 'otter', 'panda', 'cat', 'owl', 'raccoon', 'chef', 'gearbot']

const DEFAULT_SIZE = 200
const MIN_SIZE = 80
const MAX_SIZE = 280

export function clampMascotSize(size: number): number {
  if (Number.isNaN(size)) return DEFAULT_SIZE
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(size)))
}

export function brewAmounts(cups: number): { coffeeGrams: number; waterGrams: number } {
  const count = Number.isNaN(cups) ? DEFAULT_CUPS : Math.min(MAX_CUPS, Math.max(MIN_CUPS, Math.round(cups)))
  const waterGrams = count * CUP_ML
  return { coffeeGrams: Math.round(waterGrams / WATER_PER_COFFEE), waterGrams }
}

export function brewSentence(cups: number): string {
  const { coffeeGrams, waterGrams } = brewAmounts(cups)
  return `Use ${coffeeGrams} g of coffee and ${waterGrams} g of water.`
}
