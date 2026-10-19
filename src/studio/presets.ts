// Original preset characters. Colours avoid pure green so the #00FF00 key path stays a fair test.
import { normaliseConfig } from './config'
import type { StudioConfig } from './types'

export type PresetTag = 'animal' | 'person' | 'robot'

export interface StudioPreset {
  readonly id: string
  readonly name: string
  readonly tag: PresetTag
  readonly config: StudioConfig
}

const preset = (id: string, name: string, tag: PresetTag, config: Partial<StudioConfig>): StudioPreset =>
  Object.freeze({ id, name, tag, config: normaliseConfig(config) })

export const STUDIO_PRESETS: readonly StudioPreset[] = Object.freeze([
  preset('fox', 'Fox', 'animal', {
    ears: 'fox', skin: '#f08a3c', muzzle: '#fff3e2', earInner: '#fff3e2', earTip: '#4a2a2e', noseColor: '#3a2430',
    hairStyle: 'none', eyeColor: '#7a4a1e', lashes: 'soft', shirt: '#3f6fb5', neckline: 'scarf', accent: '#e6465a',
  }),
  preset('bear', 'Bear', 'animal', {
    ears: 'bear', skin: '#a8714a', muzzle: '#ecd0a8', earInner: '#d9a07a', noseColor: '#2f1d27', hairStyle: 'none',
    eyeColor: '#3a2418', eyeSize: 'small', brows: 'bold', shirt: '#e8a23a', neckline: 'crew', accent: '#fff3d6',
    shirtDetail: 'stripe', blushColor: '#ff8aa0',
  }),
  preset('cat', 'Cat', 'animal', {
    ears: 'cat', skin: '#b9b4c9', muzzle: '#f4f1fa', earInner: '#f7a8c0', hairStyle: 'none', eyeColor: '#2f87b8',
    lashes: 'long', eyeSize: 'large', brows: 'thin', shirt: '#c05fa8', neckline: 'v', accent: '#ffd36b', shirtDetail: 'badge',
  }),
  preset('bunny', 'Bunny', 'animal', {
    ears: 'bunny', skin: '#f3eef6', muzzle: '#ffffff', earInner: '#f7a8c0', hairStyle: 'none', eyeColor: '#a03d6a',
    eyeSize: 'large', lashes: 'soft', shirt: '#7aa6e8', neckline: 'turtle', accent: '#ffb3c8', blushColor: '#ff7fa0',
  }),
  preset('panda', 'Panda', 'animal', {
    ears: 'bear', skin: '#f7f4fa', muzzle: '#ffffff', earColor: '#2b2430', earInner: '#5a4f66', noseColor: '#2b2430',
    eyePatch: 'oval', patchColor: '#2e2735', hairStyle: 'none', eyeColor: '#9a86b0', brows: 'bold', blush: false,
    shirt: '#5fa886', neckline: 'crew', accent: '#ffe08a', shirtDetail: 'badge',
  }),
  preset('robot', 'Robot', 'robot', {
    faceShape: 'square', ears: 'bolt', skin: '#b9c8da', hairStyle: 'none', headwear: 'antenna', eyeColor: '#18b7d9',
    eyeSize: 'large', blush: false, accent: '#ffb02e', shirt: '#5a6a85', neckline: 'boat', shirtDetail: 'badge',
  }),
  preset('sam', 'Sam', 'person', {
    faceShape: 'square', skin: '#d29a6c', hairStyle: 'messy', hairColor: '#17131c', facialHair: 'beard',
    eyeColor: '#3b2a22', brows: 'bold', shirt: '#25252d', neckline: 'crew', accent: '#e8505b',
  }),
  preset('mei', 'Mei', 'person', {
    faceShape: 'heart', skin: '#f5d0b0', hairStyle: 'bun', hairColor: '#7a3b2a', glasses: 'round',
    glassesColor: '#2b1d33', eyeColor: '#2f6f8f', lashes: 'soft', brows: 'arched', shirt: '#e9d58a',
    neckline: 'collar', accent: '#e8688a',
  }),
  preset('zara', 'Zara', 'person', {
    faceShape: 'round', skin: '#8a5a3c', hairStyle: 'curly', hairColor: '#241a22', eyeColor: '#3a2418',
    eyeSize: 'large', lashes: 'long', brows: 'soft', blushColor: '#d9667a', shirt: '#e8a23a', neckline: 'v',
    accent: '#fff3d6',
  }),
  preset('amina', 'Amina', 'person', {
    faceShape: 'oval', skin: '#d9a47a', hairStyle: 'none', headwear: 'hijab', headwearColor: '#3f8f9a',
    hairColor: '#2b2230', eyeColor: '#4a2f22', lashes: 'soft', brows: 'arched', shirt: '#f1e6d3', accent: '#f3c969',
  }),
  preset('leo', 'Leo', 'person', {
    faceShape: 'oval', skin: '#f1c4a0', hairStyle: 'ponytail', hairColor: '#b5522e', eyeColor: '#5a7aa0',
    lids: 'heavy', brows: 'thin', shirt: '#2f7f86', neckline: 'crew', accent: '#ffcf4a',
  }),
  preset('jonas', 'Jonas', 'person', {
    faceShape: 'square', skin: '#e8b894', hairStyle: 'buzz', hairColor: '#5a4636', facialHair: 'stubble',
    glasses: 'square', glassesColor: '#3d3d55', eyeColor: '#4a6a8a', eyeSize: 'small', brows: 'bold',
    shirt: '#c05a3a', neckline: 'collar', accent: '#ffe0a8',
  }),
  preset('noor', 'Noor', 'person', {
    faceShape: 'round', skin: '#5e3b2a', hairStyle: 'bob', hairColor: '#1d1520', headwear: 'beanie',
    headwearColor: '#d9453f', accent: '#fff0d0', eyeColor: '#3a2418', glasses: 'square', glassesColor: '#e8a23a',
    lashes: 'soft', shirt: '#6a4fb8', neckline: 'turtle', blushColor: '#e07088',
  }),
  preset('otto', 'Otto', 'person', {
    faceShape: 'heart', skin: '#e9bf9d', hairStyle: 'none', hairColor: '#bdb5c4', facialHair: 'moustache',
    facialHairColor: '#d9d3de', glasses: 'round', glassesColor: '#6b4a2e', headwear: 'cap', headwearColor: '#5f6f8c',
    eyeColor: '#5a4a3a', lids: 'heavy', brows: 'bold', shirt: '#b98a5a', neckline: 'collar', accent: '#f4ead8',
  }),
])
