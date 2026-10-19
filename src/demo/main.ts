// The demo uses the SAME framework-free element that Mascot Maker ships to its users.
import '../embed/page-mascot.js'
import { buildEmbed } from '../embed'
import { findMascot, sheetUrls } from '../gallery/mascots'
import { brewAmounts, brewSentence, clampMascotSize, DEMO_PICKS } from './demoLogic'

const THEME_KEY = 'mascot-maker-theme'
const NARROW = '(max-width: 719px)'

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`Demo page is missing #${id}`)
  return el as T
}

function readTheme(): 'light' | 'dark' | null {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

function currentTheme(): 'light' | 'dark' {
  const set = document.documentElement.getAttribute('data-theme')
  if (set === 'light' || set === 'dark') return set
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function setupTheme(): void {
  const stored = readTheme()
  if (stored) document.documentElement.setAttribute('data-theme', stored)
  const button = byId<HTMLButtonElement>('theme-btn')
  const label = (): void => {
    button.textContent = `Switch to ${currentTheme() === 'dark' ? 'light' : 'dark'} theme`
  }
  label()
  button.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // Storage blocked: the choice still applies for this visit.
    }
    label()
  })
}

function setupBrew(): void {
  const slider = byId<HTMLInputElement>('cups')
  const value = byId('cups-value')
  const out = byId('calc-out')
  const update = (): void => {
    const cups = Number(slider.value)
    value.textContent = String(brewAmounts(cups).waterGrams / 250)
    out.textContent = brewSentence(cups)
  }
  slider.addEventListener('input', update)
  update()
}

interface PickerState {
  slug: string
  size: number
}

function applyMascot(state: PickerState): void {
  const mascot = byId('mascot')
  const entry = findMascot(state.slug)
  const urls = sheetUrls(state.slug)
  mascot.setAttribute('directions', urls.directions)
  mascot.setAttribute('reactions', urls.reactions)
  mascot.setAttribute('size', String(state.size))
  mascot.setAttribute('label', entry?.name ?? state.slug)
}

function renderChips(state: PickerState, onPick: (slug: string) => void): void {
  const box = byId('picker-chips')
  box.replaceChildren(
    ...DEMO_PICKS.map((slug) => {
      const chip = document.createElement('button')
      chip.type = 'button'
      chip.className = 'chip'
      chip.textContent = findMascot(slug)?.name ?? slug
      chip.setAttribute('aria-pressed', String(slug === state.slug))
      chip.dataset.slug = slug
      chip.addEventListener('click', () => onPick(slug))
      return chip
    }),
  )
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    document.body.appendChild(area)
    area.select()
    try {
      return document.execCommand('copy')
    } finally {
      area.remove()
    }
  }
}

function setupPicker(): void {
  const state: PickerState = { slug: DEMO_PICKS[0] ?? 'fox', size: 200 }
  const status = byId('picker-status')
  const sizeInput = byId<HTMLInputElement>('mascot-size')
  const sizeValue = byId('mascot-size-value')

  const refresh = (): void => {
    applyMascot(state)
    renderChips(state, (slug) => {
      state.slug = slug
      refresh()
      status.textContent = `Now showing ${findMascot(slug)?.name ?? slug}.`
      byId('picker-chips').querySelector<HTMLElement>(`[data-slug="${slug}"]`)?.focus()
    })
  }
  refresh()

  sizeInput.addEventListener('input', () => {
    state.size = clampMascotSize(Number(sizeInput.value))
    sizeValue.textContent = String(state.size)
    applyMascot(state)
  })

  byId('copy-embed').addEventListener('click', () => {
    const name = findMascot(state.slug)?.name ?? state.slug
    const { html } = buildEmbed({ name: state.slug, basePath: '/mascots', size: state.size, label: name })
    void copyText(html).then((ok) => {
      status.textContent = ok ? `Copied the embed code for ${name}.` : 'Could not copy. Open the gallery to get the code.'
    })
  })

  const toggle = byId<HTMLButtonElement>('picker-toggle')
  const body = byId('picker-body')
  const setOpen = (open: boolean): void => {
    body.hidden = !open
    toggle.setAttribute('aria-expanded', String(open))
    toggle.textContent = open ? 'Hide' : 'Show options'
  }
  setOpen(!window.matchMedia(NARROW).matches)
  toggle.addEventListener('click', () => setOpen(body.hidden))
}

setupTheme()
setupBrew()
setupPicker()
