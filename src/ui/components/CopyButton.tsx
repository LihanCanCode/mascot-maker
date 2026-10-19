import { useClipboard } from '../hooks/useClipboard'

interface Props {
  text: string
  label?: string
}

export function CopyButton({ text, label = 'Copy' }: Props) {
  const { copied, failed, copy } = useClipboard()
  const visible = copied ? 'Copied' : failed ? 'Copy failed' : label
  return (
    <>
      <button type="button" className="btn btn-small" onClick={() => void copy(text)}>
        {visible}
      </button>
      <span role="status" className="sr-only">
        {copied ? 'Copied to clipboard' : failed ? 'Could not copy. Select the text and copy it by hand.' : ''}
      </span>
    </>
  )
}
