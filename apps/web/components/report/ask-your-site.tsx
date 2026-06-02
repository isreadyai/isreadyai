'use client'

import type {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react'
import { Children, isValidElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { UIMessage } from 'ai'
import { DefaultChatTransport, validateUIMessages } from 'ai'
import { useChat } from '@ai-sdk/react'
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Streamdown } from 'streamdown'
import { useCopyToClipboard } from '@/lib/use-copy-to-clipboard'
import { useLocalStorage } from '@/lib/use-local-storage'
import type { IByoConfig } from './byo-key-settings'
import { ByoKeySettings, readByoConfig } from './byo-key-settings'

const DESKTOP_DEFAULT_WIDTH = 560
const DESKTOP_MIN_WIDTH = 320
const DESKTOP_MAX_WIDTH = 820

// Outline-squared header control, shared by the history / close buttons.
const ICON_BUTTON =
  'border-site-border hover:border-site-secondary text-site-muted hover:text-site-text flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors'

// Dispatched on window by the report's Solution section to open this chat and
// auto-submit the resolution-plan prompt, without coupling through the parent.
export const ASK_PLAN_EVENT = 'ask-your-site:ask-resolution-plan'

// Streamdown renders its table copy/download popovers with bg-background /
// border-border / bg-muted tokens this theme never defines (and Tailwind doesn't
// scan node_modules), so those menus paint transparent. Repaint the .bg-background
// panels with site tokens — within an assistant message that class only ever lands
// on streamdown's popovers (our CodeBlock override replaces its code surfaces).
const ASSISTANT_PROSE =
  'text-site-text text-sm leading-relaxed [&_a]:text-site-secondary [&_a]:underline [&_code]:font-mono [&_li]:ml-4 [&_li]:list-disc [&_p+p]:mt-3 [&_.bg-background]:z-30 [&_.bg-background]:bg-site-raised [&_.bg-background]:border-site-border [&_.bg-background]:shadow-lg [&_.bg-background_button:hover]:bg-site-border'

// Concatenated text of a chat message, for copy + re-run.
function messageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is Extract<typeof part, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('')
}

interface IAskYourSiteProps {
  /** The scan currently in view; always sent as the grounding fallback. */
  scanId: string
  /**
   * When set, the chat is website-scoped: one continuous thread per tracked
   * website, grounded in the website's latest completed scan. Absent → the chat
   * is report-scoped to `scanId` (a one-off scan that isn't a tracked website).
   */
  websiteId?: string
  isReady: boolean
  /** Signed-in user: auth is automatic, so the manual API-key field is hidden. */
  authenticated?: boolean
  /** Whether the account has premium access to the chat. */
  premium?: boolean
  /** Smart agent readability score; a perfect 100 drops its "what's wrong" prompt. */
  smartScore?: number | null
  /** Combined AI-readiness score; a perfect 100 drops its "fix the issues" prompt. */
  readinessScore?: number | null
}

/** A row in the in-panel history list, from /api/smart-agent-chat/threads. */
interface IChatThreadItem {
  kind: 'website' | 'report'
  websiteId: string | null
  scanId: string | null
  host: string
  title: string
  preview: string
  messageCount: number
  lastMessageAt: string
}

interface IToolPart {
  type: string
  toolCallId: string
  toolName?: string
  state: string
  input?: Record<string, unknown>
  output?: unknown
  errorText?: string
}

// A persisted assistant message can come back with an empty id (it was saved
// without one), so React collides on duplicate "" keys. Give every loaded
// message a stable, non-empty id before seeding useChat.
function withStableIds<T extends { id?: unknown }>(messages: T[]): T[] {
  return messages.map((message, index) =>
    typeof message.id === 'string' && message.id.length > 0
      ? message
      : { ...message, id: `loaded-${index}` },
  )
}

export function AskYourSite({
  scanId,
  websiteId,
  isReady,
  authenticated = false,
  premium = false,
  smartScore = null,
  readinessScore = null,
}: IAskYourSiteProps) {
  const t = useTranslations('report.askSite')
  const router = useRouter()
  // The thread key: website-scoped (one thread per tracked website) or report-
  // scoped (this one-off scan). Everything that identifies the thread — the
  // useChat id, the sessionStorage key, the persistence/history calls — derives
  // from this so the two scopes never share state.
  const scopeKey = websiteId !== undefined ? `website:${websiteId}` : `report:${scanId}`
  // Signed-in but without a paid plan: the chat is locked behind a subscription.
  const locked = authenticated && !premium
  // Persisted so the chat stays open across scan navigations (toggled by ⌘I).
  const [open, setOpen] = useLocalStorage('isready:ask-your-site-open', false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [threads, setThreads] = useState<IChatThreadItem[] | null>(null)
  const [input, setInput] = useState('')
  const [accessKey, setAccessKey] = useState('')
  // The user's own provider key, session-only. When set, chat requests go
  // straight to that provider (no metering on our side).
  const [byo, setByo] = useState<IByoConfig | null>(null)
  // `useChat.error` is sticky — Clear must dismiss it too, or the error box and the
  // Clear button linger after the conversation is wiped. Reset on the next send.
  const [errorDismissed, setErrorDismissed] = useState(false)
  // Stashed when ASK_PLAN_EVENT fires; the gated effect below submits it.
  const [pendingPlan, setPendingPlan] = useState(false)
  // Flips true once the server-thread preload settles, so the auto-submit can't
  // race the preload's setMessages and get clobbered.
  const [preloadDone, setPreloadDone] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [desktopWidth, setDesktopWidth] = useState(DESKTOP_DEFAULT_WIDTH)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const restoredRef = useRef(false)
  const serverPreloadedRef = useRef(false)
  const isDraggingRef = useRef(false)
  const storageKey = `ask-your-site:${scopeKey}`

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/smart-agent-chat',
        prepareSendMessagesRequest: ({ messages }) => {
          const headers: Record<string, string> = {}
          // BYO takes precedence: send the provider header + the user's provider
          // key as the Bearer, so the route streams straight to that provider.
          if (byo !== null) {
            headers['x-byo-provider'] = byo.provider
            headers.Authorization = `Bearer ${byo.key}`
          } else if (accessKey.trim().length > 0) {
            headers.Authorization = `Bearer ${accessKey.trim()}`
          }
          // scanId always rides along as the grounding fallback; websiteId (when
          // set) makes the route ground in the website's latest completed scan
          // and persist to the website thread.
          const body =
            websiteId !== undefined ? { scanId, websiteId, messages } : { scanId, messages }
          return { body, headers }
        },
      }),
    [accessKey, byo, scanId, websiteId],
  )
  const { messages, sendMessage, status, setMessages, error } = useChat({
    id: `ask-your-site-${scopeKey}`,
    transport,
  })
  const isLoading = status === 'streaming' || status === 'submitted'
  const showError = error !== undefined && !errorDismissed
  const hasConversation = messages.length > 0 || showError || isLoading
  const suggestions = useMemo(() => {
    const list = [t('suggestion6'), t('suggestion5')]
    if (smartScore !== 100) {
      list.push(t('suggestion1'))
    }
    if (!(smartScore === 100 && readinessScore === 100)) {
      list.push(t('suggestion2'))
    }
    if (readinessScore !== 100) {
      list.push(t('suggestion4'))
    }
    list.push(t('suggestionPlan'))
    list.push(t('suggestion3'))
    return list
  }, [t, smartScore, readinessScore])

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const update = (): void => setIsDesktop(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (restoredRef.current) {
      return
    }
    restoredRef.current = true
    try {
      const storedMessages = sessionStorage.getItem(storageKey)
      if (storedMessages !== null) {
        const parsed: unknown = JSON.parse(storedMessages)
        if (Array.isArray(parsed)) {
          setMessages(withStableIds(parsed))
        }
      }
      setAccessKey(sessionStorage.getItem('isready:premium-api-key') ?? '')
      setByo(readByoConfig())
    } catch {
      sessionStorage.removeItem(storageKey)
    }
  }, [setMessages, storageKey])

  // Signed-in users have a server-persisted thread: on first open it becomes the
  // source of truth, overriding the sessionStorage restore above. sessionStorage
  // stays as the offline fallback when the fetch fails or returns nothing.
  useEffect(() => {
    if (!authenticated || !open || serverPreloadedRef.current) {
      return
    }
    // Set synchronously so production fetches exactly once. No cancel flag: under
    // Strict Mode the cleanup would otherwise abort the only fetch while the ref
    // already blocks the re-run, leaving the thread unloaded. setMessages after an
    // unmount is a safe no-op in React 18.
    serverPreloadedRef.current = true
    void (async () => {
      try {
        const query = websiteId !== undefined ? `websiteId=${websiteId}` : `scanId=${scanId}`
        const response = await fetch(`/api/smart-agent-chat/history?${query}`)
        if (!response.ok) {
          return
        }
        const data: unknown = await response.json()
        const raw = (data as { messages?: unknown }).messages
        if (!Array.isArray(raw) || raw.length === 0) {
          return
        }
        const validated = await validateUIMessages({ messages: raw })
        setMessages(withStableIds(validated))
      } catch {
        // Offline or invalid thread: the sessionStorage fallback already applied.
      } finally {
        setPreloadDone(true)
      }
    })()
  }, [authenticated, open, scanId, websiteId, setMessages])

  // Load the user's other chats when the history list is first revealed. Lazy so
  // the list never costs a request until the user asks for it; refetched each
  // time it opens so a freshly-sent message surfaces without a reload.
  useEffect(() => {
    if (!authenticated || !historyOpen) {
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch('/api/smart-agent-chat/threads')
        if (!response.ok) {
          return
        }
        const data: unknown = await response.json()
        const raw = (data as { threads?: unknown }).threads
        if (!cancelled && Array.isArray(raw)) {
          setThreads(raw as IChatThreadItem[])
        }
      } catch {
        // Offline: leave whatever was last loaded (or the empty state).
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authenticated, historyOpen])

  useEffect(() => {
    if (!restoredRef.current || isLoading) {
      return
    }
    try {
      if (messages.length === 0) {
        sessionStorage.removeItem(storageKey)
      } else {
        sessionStorage.setItem(storageKey, JSON.stringify(messages))
      }
    } catch {
      sessionStorage.removeItem(storageKey)
    }
  }, [isLoading, messages, storageKey])

  useEffect(() => {
    try {
      if (accessKey.trim().length === 0) {
        sessionStorage.removeItem('isready:premium-api-key')
      } else {
        sessionStorage.setItem('isready:premium-api-key', accessKey.trim())
      }
    } catch {
      return
    }
  }, [accessKey])

  useEffect(() => {
    if (!isDesktop) {
      document.body.style.paddingRight = ''
      document.body.style.removeProperty('--ays-inset')
      document.body.style.removeProperty('--ays-transition')
      return
    }
    document.body.style.paddingRight = open ? `${desktopWidth}px` : ''
    document.body.style.transition = isDraggingRef.current ? '' : 'padding-right 150ms ease'
    document.body.style.setProperty('--ays-inset', open ? `${desktopWidth}px` : '0px')
    document.body.style.setProperty(
      '--ays-transition',
      isDraggingRef.current ? 'none' : 'padding-right 150ms ease',
    )
    return () => {
      document.body.style.paddingRight = ''
      document.body.style.transition = ''
      document.body.style.removeProperty('--ays-inset')
      document.body.style.removeProperty('--ays-transition')
    }
  }, [desktopWidth, isDesktop, open])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key.toLowerCase() === 'i' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((current) => !current)
      }
      if (event.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, setOpen])

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 180)
      return () => clearTimeout(timer)
    }
  }, [open])

  const resize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      event.preventDefault()
      isDraggingRef.current = true
      const startX = event.clientX
      const startWidth = desktopWidth

      const move = (pointerEvent: PointerEvent): void => {
        const next = startWidth + startX - pointerEvent.clientX
        setDesktopWidth(Math.min(DESKTOP_MAX_WIDTH, Math.max(DESKTOP_MIN_WIDTH, next)))
      }
      const end = (): void => {
        isDraggingRef.current = false
        document.removeEventListener('pointermove', move)
        document.removeEventListener('pointerup', end)
      }
      document.addEventListener('pointermove', move)
      document.addEventListener('pointerup', end)
    },
    [desktopWidth],
  )

  const submit = useCallback(
    (event: FormEvent): void => {
      event.preventDefault()
      const question = input.trim()
      if (question.length === 0 || isLoading || !isReady) {
        return
      }
      setErrorDismissed(false)
      void sendMessage({ text: question })
      setInput('')
    },
    [input, isLoading, isReady, sendMessage],
  )

  const askSuggestion = useCallback(
    (question: string): void => {
      if (!isReady || isLoading) {
        return
      }
      setErrorDismissed(false)
      void sendMessage({ text: question })
    },
    [isLoading, isReady, sendMessage],
  )

  useEffect(() => {
    const onAskPlan = (): void => {
      setOpen(true)
      setPendingPlan(true)
    }
    window.addEventListener(ASK_PLAN_EVENT, onAskPlan)
    return () => window.removeEventListener(ASK_PLAN_EVENT, onAskPlan)
  }, [setOpen, setPendingPlan])

  // Submit the stashed resolution-plan prompt only once the chat is open, ready,
  // and (for signed-in users) the server thread has finished preloading — else
  // the preload's setMessages would clobber the message we just sent.
  useEffect(() => {
    if (!pendingPlan || !open || !isReady || locked || isLoading) {
      return
    }
    if (authenticated && !preloadDone) {
      return
    }
    setPendingPlan(false)
    askSuggestion(t('suggestionPlan'))
  }, [pendingPlan, open, isReady, locked, isLoading, authenticated, preloadDone, askSuggestion, t])

  function clearConversation(): void {
    setMessages([])
    sessionStorage.removeItem(storageKey)
    setErrorDismissed(true)
  }

  // Re-run an assistant answer by re-submitting the user question that preceded
  // it (the existing send path), regenerating the response as a new turn.
  const rerun = useCallback(
    (index: number): void => {
      if (!isReady || isLoading) {
        return
      }
      for (let i = index - 1; i >= 0; i -= 1) {
        const candidate = messages[i]
        if (candidate !== undefined && candidate.role === 'user') {
          const text = messageText(candidate)
          if (text.length > 0) {
            setErrorDismissed(false)
            void sendMessage({ text })
          }
          return
        }
      }
    },
    [isLoading, isReady, messages, sendMessage],
  )

  // The chat in view, so the history list opens with it highlighted.
  const isCurrentThread = useCallback(
    (thread: IChatThreadItem): boolean =>
      thread.kind === 'website'
        ? thread.websiteId === websiteId
        : websiteId === undefined && thread.scanId === scanId,
    [scanId, websiteId],
  )

  // Open another thread by navigating to the page that owns it, so its grounding
  // (and the right scope) loads server-side. The current thread just closes the
  // list — it's already on screen.
  const openThread = useCallback(
    (thread: IChatThreadItem): void => {
      if (isCurrentThread(thread)) {
        setHistoryOpen(false)
        return
      }
      const href =
        thread.kind === 'website' && thread.websiteId !== null
          ? `/dashboard/websites/${thread.websiteId}`
          : thread.scanId !== null
            ? `/report/${thread.scanId}`
            : null
      if (href !== null) {
        router.push(href)
      }
    },
    [isCurrentThread, router],
  )

  const panel = (
    <div className="bg-site-background relative flex h-full min-h-0 flex-col">
      <header className="border-site-border flex h-16 shrink-0 items-center justify-between border-b px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {authenticated ? (
            <button
              type="button"
              onClick={() => setHistoryOpen((value) => !value)}
              className={`${ICON_BUTTON} ${historyOpen ? 'border-site-secondary text-site-text' : ''}`}
              aria-label={historyOpen ? t('history.close') : t('history.open')}
              aria-expanded={historyOpen}
            >
              <HistoryIcon />
            </button>
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {historyOpen ? t('history.title') : t('title')}
            </p>
            {!historyOpen ? <p className="text-site-faint text-xs">{t('subtitle')}</p> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasConversation && !historyOpen ? (
            <button
              type="button"
              onClick={clearConversation}
              className="text-site-muted hover:text-site-text flex items-center gap-1.5 text-xs transition-colors"
            >
              <PlusIcon />
              {t('newChat')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={ICON_BUTTON}
            aria-label={t('close')}
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      {authenticated && historyOpen ? (
        <ChatHistoryList
          threads={threads}
          isCurrent={isCurrentThread}
          onPick={openThread}
          onNewChat={() => {
            clearConversation()
            setHistoryOpen(false)
          }}
        />
      ) : null}

      {locked ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <SubscribePromo />
        </div>
      ) : !isReady ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-4 text-center">
          <p className="text-sm font-medium">{t('waiting')}</p>
          <p className="text-site-muted mt-2 max-w-xs text-xs leading-relaxed">
            {t('waitingHint')}
          </p>
        </div>
      ) : hasConversation ? (
        <StickToBottom
          className="relative flex min-h-0 flex-1 flex-col overflow-y-auto"
          resize="smooth"
          initial="smooth"
        >
          <StickToBottom.Content className="space-y-5 p-4">
            {messages.map((message, messageIndex) => {
              const text = messageText(message)
              const isLast = messageIndex === messages.length - 1
              return (
                <div key={message.id}>
                  {message.role === 'user' ? (
                    <div className="flex flex-col items-end gap-1">
                      <div className="bg-site-surface border-site-border text-site-text max-w-[85%] rounded-2xl rounded-br-md border px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap">
                        {text}
                      </div>
                      <CopyButton text={text} label={t('messageCopy')} />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {message.parts.map((part, index) => {
                        if (part.type === 'text' && part.text.length > 0) {
                          return (
                            // eslint-disable-next-line react/no-array-index-key -- text parts have no stable id; parts are server-ordered and never reordered
                            <div key={`${message.id}-${index}`} className={ASSISTANT_PROSE}>
                              <Streamdown components={MARKDOWN_COMPONENTS}>{part.text}</Streamdown>
                            </div>
                          )
                        }
                        if (isToolPart(part)) {
                          const view = smartViewOf(part)
                          return view !== null ? (
                            <SmartAgentViewCard
                              key={part.toolCallId}
                              title={view.title}
                              snapshot={view.snapshot}
                            />
                          ) : (
                            <ToolCall key={part.toolCallId} part={part} />
                          )
                        }
                        return null
                      })}
                      {text.length > 0 && !(isLast && isLoading) ? (
                        <div className="flex items-center gap-1 pt-0.5">
                          <CopyButton text={text} label={t('messageCopy')} />
                          <button
                            type="button"
                            onClick={() => rerun(messageIndex)}
                            disabled={!isReady || isLoading}
                            aria-label={t('messageRerun')}
                            title={t('messageRerun')}
                            className="text-site-faint hover:text-site-text flex items-center transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <RerunIcon />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
            {isLoading ? (
              <p className="text-site-faint animate-pulse font-mono text-xs">{t('thinking')}</p>
            ) : null}
            {showError ? <ChatError message={error.message} /> : null}
          </StickToBottom.Content>
          <ScrollToBottomButton />
        </StickToBottom>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col justify-center p-4">
          <p className="text-sm font-medium">{t('emptyTitle')}</p>
          <p className="text-site-muted mt-2 text-xs leading-relaxed">{t('emptyHint')}</p>
          <div className="mt-5 space-y-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => askSuggestion(suggestion)}
                className="border-site-border hover:border-site-secondary text-site-muted hover:text-site-text w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {locked ? null : (
        <form onSubmit={submit} className="border-site-border shrink-0 border-t p-3">
          {!authenticated ? (
            <>
              <label className="text-site-faint mb-2 block text-[11px]" htmlFor="ask-site-key">
                {t('keyLabel')}
              </label>
              <input
                id="ask-site-key"
                type="password"
                value={accessKey}
                onChange={(event) => setAccessKey(event.target.value)}
                placeholder={t('keyPlaceholder')}
                autoComplete="off"
                className="border-site-border bg-site-surface text-site-text placeholder:text-site-faint mb-2 min-h-9 w-full rounded-lg border px-3 font-mono text-xs"
              />
            </>
          ) : null}
          <div className="border-site-border bg-site-surface focus-within:border-site-secondary focus-within:ring-site-secondary/30 flex items-end gap-2 rounded-xl border p-2 transition-colors focus-within:ring-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
              rows={2}
              maxLength={2000}
              placeholder={t('placeholder')}
              aria-label={t('placeholder')}
              disabled={!isReady || isLoading}
              className="text-site-text placeholder:text-site-faint min-h-12 flex-1 resize-none bg-transparent px-1 py-1 text-sm outline-none focus-visible:!border-transparent focus-visible:!shadow-none focus-visible:!outline-none"
            />
            <button
              type="submit"
              disabled={!isReady || isLoading || input.trim().length === 0}
              className="bg-site-secondary text-site-secondary-foreground hover:bg-site-text hover:text-site-background flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={t('send')}
            >
              <SendIcon />
            </button>
          </div>
          {!authenticated ? (
            <p className="text-site-faint mt-2 text-[10px]">{t('keyHint')}</p>
          ) : null}
          <div className="mt-2">
            <ByoKeySettings onChange={setByo} />
          </div>
        </form>
      )}
    </div>
  )

  return (
    <>
      {!open ? (
        <button
          id="ask-your-site-fab"
          type="button"
          onClick={() => setOpen(true)}
          className="border-site-border bg-site-surface text-site-text hover:border-site-secondary fixed right-4 bottom-4 z-40 flex min-h-11 items-center gap-3 rounded-xl border px-4 text-sm font-medium shadow-2xl transition-colors sm:right-6 sm:bottom-6"
          aria-label={t('open')}
        >
          <span>{t('trigger')}</span>
          <kbd className="border-site-border text-site-faint rounded border px-1.5 py-0.5 font-mono text-[10px]">
            ⌘I
          </kbd>
        </button>
      ) : null}
      {open ? (
        isDesktop ? (
          <aside
            // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- <aside role="dialog"> combines landmark + dialog semantics; native <dialog> UA styles would need a full reset
            role="dialog"
            aria-modal="false"
            aria-label={t('title')}
            className="border-site-border fixed inset-y-0 right-0 z-60 border-l shadow-2xl"
            style={{ width: desktopWidth }}
          >
            <div
              // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- resize handle has pointer handler and children; <hr> is self-closing
              role="separator"
              aria-orientation="vertical"
              aria-label={t('resize')}
              onPointerDown={resize}
              className="hover:bg-site-secondary absolute inset-y-0 left-0 z-10 w-1 cursor-col-resize"
            />
            {panel}
          </aside>
        ) : (
          <div
            // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- native <dialog> UA styles would need a full reset; JS-controlled visibility via conditional render
            role="dialog"
            aria-modal="true"
            aria-label={t('title')}
            className="fixed inset-0 z-60"
          >
            {panel}
          </div>
        )
      ) : null}
    </>
  )
}

// The history affordance: an overlay anchored under the existing panel header
// (it does not restructure the panel — the chat stays mounted beneath it). The
// panel header already shows the "Chat history" title, so this is just the list:
// a "New chat" card first (the list is created_at-desc, newest on top), then the
// current chat highlighted, then the rest newest-first.
function ChatHistoryList({
  threads,
  isCurrent,
  onPick,
  onNewChat,
}: {
  threads: IChatThreadItem[] | null
  isCurrent: (thread: IChatThreadItem) => boolean
  onPick: (thread: IChatThreadItem) => void
  onNewChat: () => void
}) {
  const t = useTranslations('report.askSite')
  // Current chat first, then the rest newest-first (the API already sorts by
  // recency, so a stable partition preserves that order within each group).
  const ordered =
    threads === null
      ? null
      : [...threads.filter(isCurrent), ...threads.filter((thread) => !isCurrent(thread))]
  return (
    <div className="bg-site-background absolute inset-x-0 top-16 bottom-0 z-20 flex flex-col">
      <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
        <li>
          <button
            type="button"
            onClick={onNewChat}
            className="border-site-border hover:border-site-secondary text-site-muted hover:text-site-text flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-left transition-colors"
          >
            <PlusIcon />
            <span className="text-site-text text-xs font-medium">{t('history.newChat')}</span>
          </button>
        </li>
        {ordered === null ? (
          <li className="text-site-faint animate-pulse p-1 font-mono text-xs">{t('thinking')}</li>
        ) : ordered.length === 0 ? null : (
          ordered.map((thread) => {
            const current = isCurrent(thread)
            return (
              <li key={`${thread.kind}-${thread.websiteId ?? thread.scanId}`}>
                <button
                  type="button"
                  onClick={() => onPick(thread)}
                  aria-current={current ? 'true' : undefined}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    current
                      ? 'border-site-secondary bg-site-secondary/10'
                      : 'border-site-border hover:border-site-secondary'
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-site-text truncate text-xs font-medium">
                      {thread.title}
                    </span>
                    {current ? (
                      <span className="text-site-secondary shrink-0 text-[10px] font-medium">
                        {t('history.current')}
                      </span>
                    ) : null}
                  </span>
                  {thread.preview.length > 0 ? (
                    <span className="text-site-muted mt-1 block truncate text-xs">
                      {thread.preview}
                    </span>
                  ) : null}
                  <span className="text-site-faint mt-1 block font-mono text-[10px]">
                    {t('history.count', { count: thread.messageCount })}
                  </span>
                </button>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}

function handleInputKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    event.currentTarget.form?.requestSubmit()
  }
}

function ScrollToBottomButton() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext()
  if (isAtBottom) {
    return null
  }
  return (
    <button
      type="button"
      onClick={() => void scrollToBottom()}
      aria-label="Scroll to latest"
      className="border-site-border bg-site-surface text-site-muted hover:text-site-text absolute bottom-3 left-1/2 z-10 flex size-8 -translate-x-1/2 items-center justify-center rounded-full border shadow-lg transition-colors"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  )
}

// Streamdown is react-markdown under the hood; override the code-block wrapper to
// add a copy button + expand/collapse without losing its syntax highlighting.
const MARKDOWN_COMPONENTS = { pre: CodeBlock }

function CodeBlock({ children }: { children?: ReactNode }) {
  const t = useTranslations('report.askSite')
  const { copied, copy } = useCopyToClipboard(1500)
  const [expanded, setExpanded] = useState(false)
  const lang = langOf(children)
  return (
    <div className="border-site-border bg-site-background/70 my-2 overflow-hidden rounded-lg border">
      <div className="border-site-border/60 text-site-faint flex items-center justify-between gap-2 border-b px-2.5 py-1.5 font-mono text-[10px] tracking-wide">
        <span className="uppercase">{lang ?? t('codeLabel')}</span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? t('codeCollapse') : t('codeExpand')}
            className="hover:text-site-text transition-colors"
          >
            {expanded ? <CollapseIcon /> : <ExpandIcon />}
          </button>
          <button
            type="button"
            onClick={() => void copy(nodeText(children))}
            aria-label={t('codeCopy')}
            className="hover:text-site-text flex items-center transition-colors"
          >
            {copied !== null ? <CheckIcon /> : <CopyIcon />}
          </button>
        </span>
      </div>
      <pre
        className={`overflow-x-auto p-3 font-mono text-[11px] leading-relaxed ${expanded ? '' : 'max-h-44 overflow-y-auto'}`}
      >
        {children}
      </pre>
    </div>
  )
}

// Smart Agent View tool output → a preview card echoing the home showcase: the
// rendered accessibility snapshot, collapsed by default, click to see it all.
function SmartAgentViewCard({ title, snapshot }: { title: string; snapshot: string }) {
  const t = useTranslations('report.askSite')
  const [expanded, setExpanded] = useState(false)
  const lines = snapshot.split('\n')
  const truncated = lines.length > 9
  const shown = expanded || !truncated ? snapshot : lines.slice(0, 9).join('\n')
  return (
    <div className="border-site-secondary/40 bg-site-background/60 overflow-hidden rounded-xl border">
      <div className="border-site-border/60 flex items-center justify-between gap-2 border-b px-3 py-2">
        <span className="text-site-secondary font-mono text-[10px] tracking-wide uppercase">
          {title.length > 0 ? `${t('viewCardTitle')} · ${title}` : t('viewCardTitle')}
        </span>
        {truncated ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="text-site-muted hover:text-site-text flex shrink-0 items-center gap-1 text-[10px] transition-colors"
          >
            {expanded ? <CollapseIcon /> : <ExpandIcon />}
            {expanded ? t('viewCardCollapse') : t('viewCardExpand')}
          </button>
        ) : null}
      </div>
      <pre
        className={`text-site-muted overflow-x-auto p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap ${expanded ? 'max-h-80 overflow-y-auto' : ''}`}
      >
        {shown}
        {!expanded && truncated ? '\n…' : ''}
      </pre>
    </div>
  )
}

function smartViewOf(part: IToolPart): { title: string; snapshot: string } | null {
  const name = part.type === 'dynamic-tool' ? part.toolName : part.type.replace(/^tool-/, '')
  if (name !== 'readSmartAgentView' || part.state !== 'output-available') {
    return null
  }
  const out = part.output
  if (typeof out !== 'object' || out === null) {
    return null
  }
  const record = out as Record<string, unknown>
  if (typeof record.snapshot !== 'string') {
    return null
  }
  return { title: typeof record.title === 'string' ? record.title : '', snapshot: record.snapshot }
}

function nodeText(node: ReactNode): string {
  if (typeof node === 'string') {
    return node
  }
  if (typeof node === 'number') {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map(nodeText).join('')
  }
  if (isValidElement(node)) {
    return nodeText((node.props as { children?: ReactNode }).children)
  }
  return ''
}

function langOf(node: ReactNode): string | null {
  let lang: string | null = null
  Children.forEach(node, (child) => {
    if (isValidElement(child)) {
      const match = /language-(\w+)/.exec((child.props as { className?: string }).className ?? '')
      if (match?.[1] !== undefined) {
        lang = match[1]
      }
    }
  })
  return lang
}

function isToolPart(part: { type: string }): part is IToolPart {
  return part.type.startsWith('tool-') || part.type === 'dynamic-tool'
}

function ToolCall({ part }: { part: IToolPart }) {
  const t = useTranslations('report.askSite')
  const name =
    part.type === 'dynamic-tool' ? (part.toolName ?? 'tool') : part.type.replace(/^tool-/, '')
  const done = part.state === 'output-available'
  const failed = part.state === 'output-error'
  const label =
    name === 'readSmartAgentView'
      ? done
        ? t('toolViewDone')
        : t('toolView')
      : done
        ? t('toolFindingsDone')
        : t('toolFindings')
  return (
    <p
      className={`font-mono text-xs ${done ? 'text-site-faint' : failed ? 'text-score-poor' : 'text-site-muted animate-pulse'}`}
    >
      {label}
      {failed ? ` · ${t('toolFailed')}` : ''}
    </p>
  )
}

function ChatError({ message }: { message: string }) {
  const t = useTranslations('report.askSite')
  let display = message
  try {
    const parsed: unknown = JSON.parse(message)
    if (typeof parsed === 'object' && parsed !== null && 'message' in parsed) {
      const candidate = parsed.message
      if (typeof candidate === 'string') {
        display = candidate
      }
    }
  } catch {
    display = message || t('error')
  }
  return (
    <p className="border-danger/30 bg-danger/10 text-danger rounded-lg border px-3 py-2 text-xs">
      {display}
    </p>
  )
}

function SubscribePromo() {
  const t = useTranslations('report.askSite')
  return (
    <div className="flex h-full flex-col items-center justify-center px-2 text-center">
      <div className="border-site-secondary/40 bg-site-secondary/10 w-full rounded-2xl border p-6">
        <div className="bg-site-secondary/15 text-site-secondary mx-auto flex size-11 items-center justify-center rounded-xl">
          <LockIcon />
        </div>
        <p className="mt-4 text-sm font-semibold">{t('subscribeTitle')}</p>
        <p className="text-site-muted mt-2 text-xs leading-relaxed">{t('subscribeBody')}</p>
        <Link
          href="/dashboard/billing"
          className="bg-site-secondary text-site-secondary-foreground hover:bg-site-text hover:text-site-background mt-5 inline-flex min-h-10 items-center justify-center rounded-xl px-5 text-sm font-semibold transition-colors"
        >
          {t('subscribeCta')}
        </Link>
      </div>
    </div>
  )
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function HistoryIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3v5h5" />
      <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
      <path d="M12 7v5l4 2" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 7-7 7 7M12 19V5" />
    </svg>
  )
}

const ICON_PROPS = {
  'aria-hidden': true,
  width: 12,
  height: 12,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

function CopyIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg {...ICON_PROPS} strokeWidth={2.4}>
      <path d="m5 12 5 5L20 7" />
    </svg>
  )
}

function RerunIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

// Subtle icon button for copying a single chat message's text.
function CopyButton({ text, label }: { text: string; label: string }) {
  const { copied, copy } = useCopyToClipboard(1500)
  return (
    <button
      type="button"
      onClick={() => void copy(text)}
      aria-label={label}
      title={label}
      className="text-site-faint hover:text-site-text flex items-center transition-colors"
    >
      {copied !== null ? <CheckIcon /> : <CopyIcon />}
    </button>
  )
}

function ExpandIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" />
    </svg>
  )
}

function CollapseIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3m13-5h-3a2 2 0 0 0-2 2v3" />
    </svg>
  )
}
