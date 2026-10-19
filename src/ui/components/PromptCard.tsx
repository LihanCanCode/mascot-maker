import { CopyButton } from './CopyButton'

interface Props {
  id: string
  title: string
  hint: string
  text: string
}

export function PromptCard({ id, title, hint, text }: Props) {
  const headingId = `${id}-heading`
  return (
    <section id={id} tabIndex={-1} aria-labelledby={headingId} className="sticker prompt-card">
      <div className="prompt-head">
        <h3 id={headingId}>{title}</h3>
        <CopyButton text={text} label="Copy message" />
      </div>
      <p className="muted">{hint}</p>
      <pre className="prompt-text" role="region" tabIndex={0} aria-label={`${title} text`}>
        {text}
      </pre>
    </section>
  )
}
