import type { VideoMetadata } from '@rip/contracts'
import { fetchServerSentEvents, useChat } from '@tanstack/ai-react'
import { Bot, SendHorizontal } from 'lucide-react'
import { useState } from 'react'
import { Streamdown } from 'streamdown'

export function FormatAdvisor({ metadata }: { metadata: VideoMetadata }) {
  const [input, setInput] = useState(
    'Recommend the best format for high quality offline playback.'
  )
  const { messages, sendMessage, isLoading, error, clear } = useChat({
    connection: fetchServerSentEvents('/api/ai/format-advisor'),
    body: {
      metadata,
    },
  })

  return (
    <section className="panel panel-compact">
      <div className="panel-head">
        <div>
          <p className="eyebrow">TanStack AI</p>
          <h3>Format advisor</h3>
        </div>
        <button
          className="ghost-button"
          type="button"
          onClick={() => clear()}
          disabled={!messages.length}
        >
          Reset
        </button>
      </div>
      <p className="panel-note">
        Ask for the smallest export, the safest Apple playback target, or the
        cleanest audio-only choice. This feature activates when the OpenAI env
        vars are configured.
      </p>

      <div className="advisor-thread">
        {!messages.length ? (
          <div className="advisor-empty">
            <Bot size={18} />
            <span>
              Start with a goal and the advisor will map it to the available
              formats.
            </span>
          </div>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className={`message-bubble ${
                message.role === 'assistant'
                  ? 'message-assistant'
                  : 'message-user'
              }`}
            >
              {message.parts.map((part) => {
                if (part.type !== 'text' || !part.content) {
                  return null
                }

                return (
                  <div
                    key={`${message.id}-${part.content}`}
                    className="message-markdown"
                  >
                    <Streamdown>{part.content}</Streamdown>
                  </div>
                )
              })}
            </article>
          ))
        )}
      </div>

      {error ? <p className="error-text">{error.message}</p> : null}

      <form
        className="advisor-form"
        onSubmit={(event) => {
          event.preventDefault()

          if (!input.trim()) {
            return
          }

          void sendMessage(input.trim())
          setInput('')
        }}
      >
        <textarea
          className="text-area"
          rows={3}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Find me the smallest file that still looks good on a 4K TV."
        />
        <button className="primary-button" type="submit" disabled={isLoading}>
          {isLoading ? 'Thinking...' : 'Ask advisor'}
          <SendHorizontal size={16} />
        </button>
      </form>
    </section>
  )
}
