'use strict'
// Puter.js image spike. All dynamic text goes through textContent; no secrets are read or logged.
const $ = (id) => document.getElementById(id)
const QUALITY_BY_MODEL = {
  'gemini-3.1-flash-image': ['512', '1K', '2K', '4K'],
  'gemini-3-pro-image': ['1K', '2K', '4K'],
  'gemini-3.1-flash-lite-image': ['1K'],
}
const DEFAULT_QUALITY = '1K'
const state = { prompts: null, photo: null, images: { 1: null, 2: null }, busy: false }

function logLine(text, isError) {
  const log = $('log')
  log.textContent += (log.textContent ? '\n' : '') + new Date().toLocaleTimeString() + '  ' + text
  log.scrollTop = log.scrollHeight
}
function setStatus(text, isError) {
  const s = $('status')
  s.textContent = text
  s.className = isError ? 'err' : ''
}

function friendlyError(e) {
  const code = e && (typeof e.error === 'string' ? e.error : e.error && e.error.code) || (e && e.code) || ''
  const msg = (e && (e.msg || e.message || (e.error && e.error.message))) || ''
  const status = e && (e.status || e.statusCode)
  const blob = (String(code) + ' ' + msg + ' ' + status).toLowerCase()
  if (blob.includes('insufficient_funds') || status === 402 || /\b402\b/.test(blob)) return ['402 insufficient_funds', 'Free allowance is used up (or the balance cannot cover this call).']
  if (blob.includes('popup_blocked')) return ['popup_blocked', 'The sign-in popup was blocked. Allow popups for this page and click the button again.']
  if (blob.includes('auth_window_closed')) return ['auth_window_closed', 'The sign-in window was closed before finishing.']
  if (blob.includes('unsupported_origin')) return ['unsupported_origin', 'Serve this page over http://localhost or http://127.0.0.1, not file://.']
  if (blob.includes('bad_request')) return ['bad_request', 'Puter rejected the request options (for example an unsupported quality tier for this model).']
  if (blob.includes('failed to fetch') || blob.includes('network')) return ['network', 'Network problem. Check your connection and that js.puter.com is reachable.']
  if (blob.includes('auth') || blob.includes('token') || status === 401) return [String(code || 'auth'), 'You are not signed in. Click "Sign in with Puter" first.']
  return [String(code || 'error'), msg || 'Unknown error (see log).']
}

function fillQuality() {
  const tiers = QUALITY_BY_MODEL[$('model').value]
  const sel = $('quality')
  sel.replaceChildren()
  for (const q of tiers) {
    const o = document.createElement('option')
    o.value = q
    o.textContent = q
    sel.append(o)
  }
  sel.value = tiers.includes(DEFAULT_QUALITY) ? DEFAULT_QUALITY : tiers[0]
}

function buildPrompt(kind) {
  const p = state.prompts
  if (!p) throw new Error('prompts.json is not loaded. Run: node spikes/puter/dump-prompts.mjs')
  const describe = $('describe').value.trim().replace(/[.!?,;:\s]+$/, '') || 'a cute chibi character'
  const set = p.styles[$('style').value]
  return set[kind].split(p.placeholder).join(describe)
}

function refreshButtons() {
  $('step1').disabled = state.busy
  $('step2').disabled = state.busy || !state.images[1]
  $('dl1').disabled = !state.images[1]
  $('dl2').disabled = !state.images[2]
  $('dlboth').disabled = !(state.images[1] && state.images[2])
}

async function toDataUri(src) {
  if (src.startsWith('data:')) return src
  const res = await fetch(src)
  if (!res.ok) throw new Error('fetch ' + res.status)
  const blob = await res.blob()
  return await new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

async function generate(step) {
  if (state.busy) return
  if (typeof puter === 'undefined') { setStatus('Puter.js did not load from the CDN.', true); return }
  const useReference = step === 1 && $('use-photo').checked
  if (useReference && !state.photo) { setStatus('Choose a photo first, or untick "use my photo".', true); return }
  const kind = step === 2 ? 'reactions' : useReference ? 'reference' : 'directions'
  const model = $('model').value
  const quality = $('quality').value
  const testMode = $('test-mode').checked
  const options = { model, quality, test_mode: testMode }
  if (step === 2) options.input_images = [state.images[1].dataUri]
  else if (useReference) options.input_images = [state.photo]
  let prompt
  try { prompt = buildPrompt(kind) } catch (e) { setStatus(e.message, true); return }

  state.busy = true
  refreshButtons()
  setStatus('Generating step ' + step + '...')
  const t0 = performance.now()
  const label = 'step' + step + ' ' + kind + ' model=' + model + ' quality=' + quality + (testMode ? ' TEST_MODE' : '') + (options.input_images ? ' input_images=1' : '')
  try {
    const img = await puter.ai.txt2img(prompt, options)
    const secs = ((performance.now() - t0) / 1000).toFixed(1)
    let dataUri = img.src
    try { dataUri = await toDataUri(img.src) } catch (e) { logLine('note: could not convert result to a data URI (' + (e.message || e) + '); using the URL') }
    state.images[step] = { dataUri, secs, model }
    if (step === 1) state.images[2] = null
    show(step)
    logLine(label + '  OK  ' + secs + 's')
    setStatus('Step ' + step + ' done in ' + secs + 's.')
  } catch (e) {
    const secs = ((performance.now() - t0) / 1000).toFixed(1)
    const [code, text] = friendlyError(e)
    logLine(label + '  FAILED  ' + secs + 's  code=' + code + '  ' + text)
    setStatus(code + ': ' + text, true)
  } finally {
    state.busy = false
    refreshButtons()
  }
}

function show(step) {
  if (step === 1) { $('out2').replaceChildren(); $('cap2').textContent = 'Reactions sheet: none yet' }
  const holder = $('out' + step)
  holder.replaceChildren()
  const im = state.images[step]
  if (!im) return
  const el = document.createElement('img')
  el.src = im.dataUri
  el.alt = (step === 1 ? 'Directions' : 'Reactions') + ' sheet result'
  holder.append(el)
  $('cap' + step).textContent = (step === 1 ? 'Directions' : 'Reactions') + ' sheet: ' + im.secs + 's, ' + im.model
}

function download(step) {
  const im = state.images[step]
  if (!im) return
  const type = (im.dataUri.match(/^data:image\/(\w+)/) || [null, 'png'])[1].replace('jpeg', 'jpg')
  const a = document.createElement('a')
  a.href = im.dataUri
  a.download = (step === 1 ? 'directions' : 'reactions') + '-sheet.' + type
  document.body.append(a)
  a.click()
  a.remove()
}

async function showUser(res) {
  try {
    const user = (res && res.user) || (await puter.auth.getUser())
    $('user').textContent = 'Signed in as ' + (user && user.username ? user.username : 'unknown user') + '.'
  } catch (e) {
    $('user').textContent = 'Not signed in.'
  }
}

async function signIn() {
  if (typeof puter === 'undefined') { setStatus('Puter.js did not load from the CDN.', true); return }
  try {
    const res = await puter.auth.signIn()
    logLine('signed in')
    await showUser(res)
  } catch (e) {
    const [code, text] = friendlyError(e)
    logLine('sign-in failed code=' + code + '  ' + text)
    setStatus(code + ': ' + text, true)
  }
}

async function refreshUsage() {
  const out = $('usage-out')
  out.hidden = false
  if (typeof puter === 'undefined') { out.textContent = 'Puter.js did not load.'; return }
  try {
    out.textContent = JSON.stringify(await puter.auth.getMonthlyUsage(), null, 2)
    logLine('monthly usage refreshed (JSON shown in the Account box)')
  } catch (e) {
    const [code, text] = friendlyError(e)
    out.textContent = code + ': ' + text
    logLine('usage failed code=' + code)
  }
}

function onPhoto(ev) {
  const file = ev.target.files && ev.target.files[0]
  state.photo = null
  $('photo-note').textContent = ''
  if (!file) return
  if (!file.type.startsWith('image/')) { $('photo-note').textContent = 'That is not an image file.'; return }
  const r = new FileReader()
  r.onload = () => { state.photo = r.result; $('photo-note').textContent = 'Photo loaded: ' + file.name + ' (' + Math.round(file.size / 1024) + ' KB).' }
  r.onerror = () => { $('photo-note').textContent = 'Could not read that file.' }
  r.readAsDataURL(file)
}

async function init() {
  fillQuality()
  $('model').addEventListener('change', fillQuality)
  $('signin').addEventListener('click', signIn)
  $('usage').addEventListener('click', refreshUsage)
  $('step1').addEventListener('click', () => generate(1))
  $('step2').addEventListener('click', () => generate(2))
  $('dl1').addEventListener('click', () => download(1))
  $('dl2').addEventListener('click', () => download(2))
  $('dlboth').addEventListener('click', () => { download(1); setTimeout(() => download(2), 300) })
  $('photo').addEventListener('change', onPhoto)
  $('use-photo').addEventListener('change', (e) => { $('photo').disabled = !e.target.checked })
  refreshButtons()
  if (typeof puter === 'undefined') {
    setStatus('Puter.js did not load from js.puter.com (offline or blocked).', true)
    logLine('puter global missing: CDN script failed to load')
  } else {
    try { if (puter.auth.isSignedIn()) await showUser() } catch (e) { /* stay signed-out */ }
  }
  try {
    const res = await fetch('./prompts.json')
    if (!res.ok) throw new Error('HTTP ' + res.status)
    state.prompts = await res.json()
    logLine('prompts.json loaded')
  } catch (e) {
    setStatus('Could not load prompts.json. Run: node spikes/puter/dump-prompts.mjs', true)
  }
}
init()
