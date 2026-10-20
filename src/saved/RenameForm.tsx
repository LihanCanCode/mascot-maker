import { useEffect, useId, useState } from 'react'

interface Props {
  /** Resets the field when a different mascot is shown. */
  id: string
  name: string
  maxLength: number
  onRename: (name: string) => void
}

export function RenameForm({ id, name, maxLength, onRename }: Props) {
  const fieldId = useId()
  const [draft, setDraft] = useState(name)
  useEffect(() => setDraft(name), [id, name])
  const trimmed = draft.trim()
  const unchanged = trimmed === name || trimmed === ''

  return (
    <form
      className="field"
      onSubmit={(event) => {
        event.preventDefault()
        if (!unchanged) onRename(trimmed)
      }}
    >
      <label htmlFor={fieldId}>Name</label>
      <input
        id={fieldId}
        type="text"
        value={draft}
        maxLength={maxLength}
        autoComplete="off"
        onChange={(event) => setDraft(event.target.value)}
      />
      <button type="submit" className="btn btn-small" disabled={unchanged}>
        Rename
      </button>
    </form>
  )
}
