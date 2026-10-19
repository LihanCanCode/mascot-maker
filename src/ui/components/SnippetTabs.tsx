import { CopyButton } from './CopyButton'
import { Tabs } from './Tabs'

interface Props {
  react: string
  html: string
}

function Snippet({ code, label }: { code: string; label: string }) {
  return (
    <div className="snippet">
      <pre role="region" tabIndex={0} aria-label={label} className="code">
        <code>{code}</code>
      </pre>
      <CopyButton text={code} label="Copy snippet" />
    </div>
  )
}

export function SnippetTabs({ react, html }: Props) {
  return (
    <Tabs
      label="Embed snippet"
      tabs={[
        { id: 'react', label: 'React', content: <Snippet code={react} label="React snippet" /> },
        { id: 'html', label: 'HTML', content: <Snippet code={html} label="HTML snippet" /> },
      ]}
    />
  )
}
