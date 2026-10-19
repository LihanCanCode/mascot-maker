/*
 * <page-mascot> -- a clickable, cursor-following sprite-sheet mascot as a framework-free
 * custom element (ES2019, no build step).
 *
 * Adapted from page-mascot (MIT License, Copyright (c) 2026 Kamran Ahmed) and shipped with
 * your mascot by mascot-maker.
 *
 *   <script type="module" src="/mascots/page-mascot.js"></script>
 *   <page-mascot directions="..." reactions="..." size="140" label="fox"></page-mascot>
 */

var DIRECTIONS = ['up-left', 'up', 'up-right', 'left', 'center', 'right', 'down-left', 'down', 'down-right']
var REACTIONS = ['blink', 'heart', 'sparkle', 'surprised', 'wink', 'bashful', 'sleepy', 'dizzy', 'delighted']

// Clockwise from the right, matching atan2 with y pointing down.
var CLOCKWISE = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right']
var SECTOR = (Math.PI * 2) / CLOCKWISE.length
var HYSTERESIS = 0.12
var DEAD_ZONE = 70

var PAYOFFS = ['heart', 'sparkle', 'delighted']
var BOOP_PAYOFF = 120
var BOOP_END = 560
var SQUASH_MS = 420
var DIZZY_AFTER = 4
var DIZZY_WINDOW = 1600
var DIZZY_END = 1100
var DEFAULT_SIZE = 140
var TAG = 'page-mascot'

var SQUASH = [
  { transform: 'scale(1, 1)', easing: 'ease-in' },
  { transform: 'scale(1.10, 0.86)', offset: 0.18, easing: 'ease-out' },
  { transform: 'scale(0.95, 1.08)', offset: 0.45, easing: 'ease-in-out' },
  { transform: 'scale(1.03, 0.97)', offset: 0.72, easing: 'ease-in-out' },
  { transform: 'scale(1, 1)' }
]

function wrap(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

/** -1 = centre (dead zone), `current` while inside the hysteresis margin, else the new sector. */
export function sectorFor(dx, dy, current) {
  if (Math.hypot(dx, dy) < DEAD_ZONE) {
    return -1
  }
  var angle = Math.atan2(dy, dx)
  if (current !== -1 && Math.abs(wrap(angle - current * SECTOR)) < SECTOR / 2 + HYSTERESIS) {
    return current
  }
  return (Math.round(angle / SECTOR) + CLOCKWISE.length) % CLOCKWISE.length
}

// background-size 300% makes each cell a clean 0/50/100% step on both axes.
function cellPosition(index) {
  return (index % 3) * 50 + '% ' + Math.floor(index / 3) * 50 + '%'
}

function cssUrl(value) {
  var escaped = String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r\n|\r|\n/g, '\\a ')
  return 'url("' + escaped + '")'
}

function mediaMatches(query) {
  return typeof window.matchMedia === 'function' && window.matchMedia(query).matches
}

function applyStyles(element, styles) {
  Object.keys(styles).forEach(function (name) {
    element.style[name] = styles[name]
  })
  return element
}

// Styles are set through the CSSOM so the element works under a strict Content-Security-Policy.
var LAYER_STYLE = {
  position: 'absolute',
  top: '0',
  right: '0',
  bottom: '0',
  left: '0',
  backgroundSize: '300% 300%',
  backgroundRepeat: 'no-repeat'
}

function createLayer() {
  return applyStyles(document.createElement('span'), LAYER_STYLE)
}

function createParts() {
  var button = applyStyles(document.createElement('button'), {
    position: 'relative',
    display: 'block',
    flexShrink: '0',
    padding: '0',
    border: '0',
    background: 'transparent',
    appearance: 'none',
    cursor: 'pointer',
    userSelect: 'none'
  })
  button.type = 'button'
  var squash = applyStyles(document.createElement('span'), {
    position: 'relative',
    display: 'block',
    width: '100%',
    height: '100%',
    transformOrigin: '50% 78%'
  })
  var directions = createLayer()
  var reactions = createLayer()
  squash.appendChild(directions)
  squash.appendChild(reactions)
  button.appendChild(squash)
  return { button: button, squash: squash, directions: directions, reactions: reactions }
}

export function definePageMascot() {
  if (typeof customElements === 'undefined' || customElements.get(TAG)) {
    return
  }

  class PageMascot extends HTMLElement {
    static get observedAttributes() {
      return ['directions', 'reactions', 'size', 'label']
    }

    constructor() {
      super()
      this._parts = createParts()
      this._timers = []
      this._boops = { count: 0, at: 0 }
      this._sector = -1
      this._pointer = null
      this._reaction = null
      this._listening = false
      this._onPointerMove = this._onPointerMove.bind(this)
      this._aim = this._aim.bind(this)
      this._boop = this._boop.bind(this)
      this.attachShadow({ mode: 'open' }).appendChild(this._parts.button)
    }

    connectedCallback() {
      if (!this.style.display) {
        this.style.display = 'inline-block'
      }
      this._parts.button.addEventListener('click', this._boop)
      this._startAiming()
      this._render()
    }

    disconnectedCallback() {
      this._parts.button.removeEventListener('click', this._boop)
      this._stopAiming()
      this._clearTimers()
      this._sector = -1
      this._pointer = null
      this._reaction = null
    }

    attributeChangedCallback() {
      this._render()
    }

    _startAiming() {
      if (this._listening || !mediaMatches('(hover: hover) and (pointer: fine)')) {
        return
      }
      this._listening = true
      window.addEventListener('pointermove', this._onPointerMove, { passive: true })
      window.addEventListener('scroll', this._aim, { passive: true })
    }

    _stopAiming() {
      if (!this._listening) {
        return
      }
      this._listening = false
      window.removeEventListener('pointermove', this._onPointerMove)
      window.removeEventListener('scroll', this._aim)
    }

    _onPointerMove(event) {
      this._pointer = { x: event.clientX, y: event.clientY }
      this._aim()
    }

    _aim() {
      if (!this._pointer) {
        return
      }
      var box = this._parts.button.getBoundingClientRect()
      var dx = this._pointer.x - (box.left + box.width / 2)
      var dy = this._pointer.y - (box.top + box.height / 2)
      this._sector = sectorFor(dx, dy, this._sector)
      this._render()
    }

    _clearTimers() {
      this._timers.forEach(function (id) {
        window.clearTimeout(id)
      })
      this._timers = []
    }

    _later(ms, next) {
      var self = this
      this._timers.push(
        window.setTimeout(function () {
          self._reaction = next
          self._render()
        }, ms)
      )
    }

    _boop() {
      this._clearTimers()
      var now = Date.now()
      var count = now - this._boops.at < DIZZY_WINDOW ? this._boops.count + 1 : 1
      this._boops = { count: count >= DIZZY_AFTER ? 0 : count, at: now }

      if (count >= DIZZY_AFTER) {
        this._reaction = 'dizzy'
        this._later(DIZZY_END, null)
      } else {
        this._reaction = 'blink'
        this._later(BOOP_PAYOFF, PAYOFFS[(count - 1) % PAYOFFS.length])
        this._later(BOOP_END, null)
      }
      this._render()

      var squash = this._parts.squash
      if (mediaMatches('(prefers-reduced-motion: reduce)') || typeof squash.animate !== 'function') {
        return
      }
      squash.animate(SQUASH, { duration: SQUASH_MS, easing: 'linear' })
    }

    _size() {
      var size = parseFloat(this.getAttribute('size'))
      return isFinite(size) && size > 0 ? size : DEFAULT_SIZE
    }

    _render() {
      var parts = this._parts
      var size = this._size() + 'px'
      var label = this.getAttribute('label') || 'mascot'
      var direction = this._sector === -1 ? 'center' : CLOCKWISE[this._sector]
      var reacting = this._reaction !== null

      parts.button.style.width = size
      parts.button.style.height = size
      parts.button.setAttribute('aria-label', 'Boop the ' + label)
      parts.directions.style.backgroundImage = cssUrl(this.getAttribute('directions') || '')
      parts.directions.style.backgroundPosition = cellPosition(DIRECTIONS.indexOf(direction))
      parts.directions.style.opacity = reacting ? '0' : '1'
      parts.reactions.style.backgroundImage = cssUrl(this.getAttribute('reactions') || '')
      parts.reactions.style.backgroundPosition = cellPosition(REACTIONS.indexOf(this._reaction || 'blink'))
      parts.reactions.style.opacity = reacting ? '1' : '0'
    }
  }

  customElements.define(TAG, PageMascot)
}

definePageMascot()
