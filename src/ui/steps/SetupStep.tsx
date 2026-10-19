import { useId, useMemo, type Dispatch } from 'react'
import { KEY_COLOUR_NAMES, KEY_COLOURS, type KeyColourName } from '../../core/types'
import { buildPrompts, lintDescription } from '../../prompts'
import { ChatHowTo } from '../components/ChatHowTo'
import { PromptCard } from '../components/PromptCard'
import { StylePicker } from '../components/StylePicker'
import type { AppAction, AppState } from '../state/appReducer'

interface Props {
  state: Extract<AppState, { step: 'setup' }>
  dispatch: Dispatch<AppAction>
}

function isKeyName(value: string): value is KeyColourName {
  return (KEY_COLOUR_NAMES as readonly string[]).includes(value)
}

export function SetupStep({ state, dispatch }: Props) {
  const { brief } = state
  const ids = { name: useId(), describe: useId(), key: useId(), warn: useId() }
  const prompts = useMemo(() => (brief.describe.trim() ? buildPrompts(brief) : null), [brief])
  const warnings = useMemo(() => lintDescription(brief.describe), [brief.describe])
  const patch = (p: Partial<typeof brief>): void => dispatch({ type: 'brief/update', patch: p })

  return (
    <div className="step">
      <h2 tabIndex={-1}>Describe your mascot</h2>
      <p className="lede">
        You will paste two messages into a chat app that makes images (Gemini or ChatGPT). Then you bring the two
        pictures back here.
      </p>

      <div className="field">
        <label htmlFor={ids.name}>Name</label>
        <input id={ids.name} type="text" value={brief.name} autoComplete="off" onChange={(e) => patch({ name: e.target.value })} />
      </div>

      <div className="field">
        <label htmlFor={ids.describe}>What does it look like?</label>
        <textarea
          id={ids.describe}
          rows={3}
          value={brief.describe}
          aria-describedby={ids.warn}
          placeholder="An orange fox with a white-tipped tail, round glasses and a green scarf"
          onChange={(e) => patch({ describe: e.target.value })}
        />
        <ul id={ids.warn} className="lint" aria-live="polite">
          {warnings.map((w) => (
            <li key={w.code}>{w.message}</li>
          ))}
        </ul>
      </div>

      <StylePicker value={brief.style} onChange={(style) => patch({ style })} />

      <div className="field-row">
        <label className="check">
          <input type="checkbox" checked={brief.usePhoto} onChange={(e) => patch({ usePhoto: e.target.checked })} />
          I will attach a photo of myself
        </label>
        <div className="field">
          <label htmlFor={ids.key}>Background colour</label>
          <select
            id={ids.key}
            value={brief.key ?? 'auto'}
            onChange={(e) => patch({ key: isKeyName(e.target.value) ? e.target.value : null })}
          >
            <option value="auto">Auto{prompts ? ` (${prompts.key})` : ''}</option>
            {KEY_COLOUR_NAMES.map((name) => (
              <option key={name} value={name}>
                {name[0]?.toUpperCase()}
                {name.slice(1)} ({KEY_COLOURS[name].hex})
              </option>
            ))}
          </select>
        </div>
      </div>

      {prompts ? (
        <div className="prompts">
          <PromptCard
            id="prompt-1"
            title="Message 1"
            hint={brief.usePhoto ? 'Attach your photo, then paste this.' : 'Paste this into a new chat.'}
            text={prompts.first}
          />
          <PromptCard
            id="prompt-2"
            title="Message 2"
            hint="Send this in the same chat, with the first image attached again."
            text={prompts.second}
          />
        </div>
      ) : (
        <p className="muted sticker-note">Describe your character above and your two messages will appear here.</p>
      )}

      <ChatHowTo />

      <div className="actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => dispatch({ type: 'nav/goto', step: 'upload' })}
        >
          I have both images
        </button>
      </div>
    </div>
  )
}
