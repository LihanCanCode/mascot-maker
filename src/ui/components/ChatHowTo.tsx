import { CHAT_GUIDES } from '../../prompts'
import { Tabs } from './Tabs'

export function ChatHowTo() {
  const tabs = CHAT_GUIDES.map((guide) => ({
    id: guide.id,
    label: guide.name,
    content: (
      <>
        <ol className="howto-steps">
          {guide.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <ul className="howto-tips">
          {guide.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </>
    ),
  }))
  if (tabs.length === 0) return null
  return (
    <section aria-labelledby="howto-heading" className="sticker">
      <h3 id="howto-heading">How to use the messages</h3>
      <Tabs label="Chat app" tabs={tabs} />
    </section>
  )
}
