'use client'

// ============================================================
// MAIN FRONTEND URL
// ============================================================

const MAIN_APP_URL =
  process.env.NEXT_PUBLIC_MAIN_APP_URL ||
  'http://localhost:3000'

const DOCTOR_API_URL =
  process.env.NEXT_PUBLIC_DOCTOR_API_URL ||
  'http://localhost:3001'

import ReactMarkdown from 'react-markdown'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowRight,
  Check,
  ChevronLeft,
  Download,
  FileText,
  HeartPulse,
  Mic,
  Pause,
  RotateCcw,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Volume2,
  X,
  Zap,
} from 'lucide-react'

// ============================================================
// INITIAL MESSAGE
// ============================================================

const initialMessages = [
  {
    id: 1,
    role: 'doctor',
    text: 'Hello, I’m your MedNexus AI Doctor. I’ll help you understand what may be going on and recommend the right next step. How are you feeling today?',
    time: '09:41 AM',
  },
]

// ============================================================
// LOGO
// ============================================================

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400 text-slate-950 shadow-[0_0_24px_rgba(52,211,153,.3)]">
        <HeartPulse size={20} strokeWidth={2.5} />
      </div>

      <div>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[.24em] text-emerald-300">
          MEDNEXUS
        </p>

        <p className="text-[10px] text-slate-500">
          Care, intelligently connected
        </p>
      </div>
    </div>
  )
}

// ============================================================
// SHELL
// ============================================================

function Shell({ children, stage, onBack }) {
  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-slate-100 selection:bg-emerald-400/30">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(16,185,129,.12),transparent_44%)]" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 lg:px-10">
        <Logo />

        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="hidden items-center gap-2 text-xs text-slate-500 transition hover:text-slate-200 sm:flex"
            >
              <ChevronLeft size={14} />
              Back
            </button>
          )}

          <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
            Stage 0{stage}
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-12 lg:px-10">
        {children}
      </div>
    </main>
  )
}

// ============================================================
// HISTORY CARD
// ============================================================

function HistoryCard({
  items,
  query,
  setQuery,
  onOpen,
  onDelete,
  loading,
}) {
  const filtered = items.filter((item) =>
  `${getConversationTitle(item)}
   ${item.condition_or_symptoms || ''}
   ${item.assessment_mode || ''}
   ${item.severity || ''}`
    .toLowerCase()
    .includes(query.toLowerCase())
)

  return (
    <div className="animate-fade-up rounded-[2rem] border border-slate-800/80 bg-slate-900/65 p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[.25em] text-emerald-400">
            Archive
          </p>

          <h2 className="mt-2 text-2xl font-medium">
            Conversation history
          </h2>
        </div>

        <button
          onClick={onDelete}
          className="text-xs text-red-300 hover:text-red-200"
        >
          Delete history
        </button>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search previous conversations..."
        className="mt-6 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-200 outline-none focus:border-emerald-400/60"
      />

      <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
        {loading ? (
          <p className="py-8 text-center text-xs text-slate-500">
            Loading archive...
          </p>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500">
            No previous conversations yet.
          </p>
        ) : (
          filtered.map((item) => (
            <button
              key={item.id}
              onClick={() => onOpen(item)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/30 p-4 text-left hover:border-emerald-400/50"
            >
              <div className="flex justify-between gap-3">
                <span className="text-sm font-medium text-slate-200">
  {getConversationTitle(item)}
</span>

                <span className="font-mono text-[10px] text-slate-500">
                  {new Date(item.ended_at).toLocaleString()}
                </span>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                {item.assessment_mode} ·{' '}
                {item.messages?.length || 0} messages
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ============================================================
// CONVERSATION TITLE
// ============================================================

function getConversationTitle(item) {
  if (!item) {
    return '🩺 Medical Consultation'
  }

  const value =
    item.condition_or_symptoms ||
    'Medical Consultation'

  const clean = String(value)
    .replace(/\s+/g, ' ')
    .trim()

  if (!clean) {
    return '🩺 Medical Consultation'
  }

  const words = clean.split(' ')

  const shortTitle =
    words.length > 7
      ? `${words.slice(0, 7).join(' ')}…`
      : clean

  return `🩺 ${shortTitle}`
}



// ============================================================
// STAGE ZERO
// ============================================================

function StageZero({
  onLaunch,
  history,
  query,
  setQuery,
  onOpenHistory,
  onDeleteHistory,
  loading,
  onDashboard,
}) {
  return (
    <Shell stage="0">
      <section className="relative grid min-h-[calc(100vh-112px)] items-center gap-6 py-10 lg:grid-cols-[1fr_1fr]">
        <button
          onClick={onDashboard}
          className="absolute right-0 top-0 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-4 py-2 text-xs text-slate-300 transition hover:border-emerald-400/50 hover:text-emerald-300"
        >
          <Activity size={14} />
          Go to Dashboard
        </button>

        <div className="animate-fade-up relative w-full overflow-hidden rounded-[2rem] border border-slate-800/80 bg-slate-900/65 p-8 text-center shadow-2xl shadow-emerald-950/20 backdrop-blur-xl sm:p-14">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent" />

          <div className="mx-auto mb-9 flex h-24 w-24 items-center justify-center rounded-[1.75rem] border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 shadow-[0_0_50px_rgba(52,211,153,.14)]">
            <Stethoscope size={45} strokeWidth={1.25} />
          </div>

          <p className="mb-4 font-mono text-xs uppercase tracking-[.28em] text-emerald-400">
            Autonomous voice triage
          </p>

          <h1 className="text-balance text-4xl font-medium tracking-tight text-slate-50 sm:text-6xl">
            Meet AI Doctor
          </h1>

          <p className="mx-auto mt-5 max-w-md text-pretty text-sm leading-6 text-slate-400 sm:text-base">
            Launch an autonomous voice triage session.
          </p>

          <button
            onClick={onLaunch}
            className="group mt-10 inline-flex items-center gap-3 rounded-xl bg-emerald-400 px-6 py-3.5 text-sm font-semibold text-slate-950 shadow-[0_0_30px_rgba(52,211,153,.25)] transition hover:-translate-y-0.5 hover:bg-emerald-300"
          >
            Launch Consultation
            <ArrowRight size={17} />
          </button>

          <div className="mt-12 flex justify-center gap-6 text-[10px] uppercase tracking-widest text-slate-600">
            <span className="flex items-center gap-2">
              <ShieldCheck size={13} className="text-emerald-500" />
              Private by design
            </span>

            <span className="flex items-center gap-2">
              <Zap size={13} className="text-emerald-500" />
              Real-time guidance
            </span>
          </div>
        </div>

        <HistoryCard
          items={history}
          query={query}
          setQuery={setQuery}
          onOpen={onOpenHistory}
          onDelete={onDeleteHistory}
          loading={loading}
        />
      </section>
    </Shell>
  )
}

// ============================================================
// STAGE ONE
// ============================================================

function StageOne({ onInitialize, onBack }) {
  const [age, setAge] = useState('')
  const [weight, setWeight] = useState('')
  const [pathway, setPathway] = useState('known')
  const [condition, setCondition] = useState('')
  const [severity, setSeverity] = useState('Medium')
  const [symptoms, setSymptoms] = useState('')
  const [error, setError] = useState('')

  function submit(e) {
    e.preventDefault()

    if (
      !age ||
      !weight ||
      (pathway === 'known' ? !condition : !symptoms)
    ) {
      setError(
        'Complete every intake field to initialize your room.'
      )
      return
    }

    onInitialize({
      age,
      weight,
      pathway,
      condition,
      severity,
      symptoms,
    })
  }

  return (
    <Shell stage="1" onBack={onBack}>
      <section className="mx-auto max-w-3xl py-8 lg:py-14">
        <div className="mb-9">
          <p className="mb-3 font-mono text-xs uppercase tracking-[.25em] text-emerald-400">
            01 / Intake configuration
          </p>

          <h1 className="text-3xl font-medium sm:text-5xl">
            Let’s get the basics.
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            A few details help your AI Doctor calibrate its triage logic.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="field">
              <span>
                Patient Age <em>(Years)</em>
              </span>

              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g. 34"
              />
            </label>

            <label className="field">
              <span>
                Body Weight <em>(kg)</em>
              </span>

              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="e.g. 72"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5">
            <p className="mb-4 text-xs uppercase tracking-widest text-slate-400">
              Classification Pathway
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPathway('known')}
                className={`pathway ${
                  pathway === 'known'
                    ? 'pathway-active'
                    : ''
                }`}
              >
                Known Medical Condition

                {pathway === 'known' && (
                  <Check size={15} />
                )}
              </button>

              <button
                type="button"
                onClick={() => setPathway('unknown')}
                className={`pathway ${
                  pathway === 'unknown'
                    ? 'pathway-active'
                    : ''
                }`}
              >
                Unknown Active Symptoms

                {pathway === 'unknown' && (
                  <Check size={15} />
                )}
              </button>
            </div>

            <div className="mt-5 border-t border-slate-800 pt-5">
              {pathway === 'known' ? (
                <div className="space-y-5">
                  <label className="field">
                    <span>Condition Identity</span>

                    <input
                      value={condition}
                      onChange={(e) =>
                        setCondition(e.target.value)
                      }
                      placeholder="e.g. Type 2 diabetes"
                    />
                  </label>

                  <div>
                    <p className="mb-3 text-xs text-slate-400">
                      Severity Metric
                    </p>

                    <div className="grid grid-cols-3 gap-2">
                      {['Low', 'Medium', 'High'].map((x) => (
                        <button
                          type="button"
                          key={x}
                          onClick={() => setSeverity(x)}
                          className={`toggle ${
                            severity === x
                              ? 'toggle-active'
                              : ''
                          }`}
                        >
                          {x}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <label className="field">
                  <span>Symptom Registry</span>

                  <textarea
                    value={symptoms}
                    onChange={(e) =>
                      setSymptoms(e.target.value)
                    }
                    rows="4"
                    placeholder="Enter your symptoms separated with commas (e.g. fever, cough, fatigue) to optimize AI evaluation logic."
                  />
                </label>
              )}
            </div>
          </div>

          {error && (
            <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-xs text-red-300">
              {error}
            </p>
          )}

          <button className="flex w-full items-center justify-center gap-3 rounded-xl bg-emerald-400 py-4 text-sm font-semibold text-slate-950">
            Initialize Consultation Room
            <ArrowRight size={17} />
          </button>

          <p className="text-center text-[11px] text-slate-600">
            Guidance only, not a diagnosis or emergency service.
          </p>
        </form>
      </section>
    </Shell>
  )
}

// ============================================================
// AVATAR
// ============================================================

function Avatar({ doctor }) {
  return doctor ? (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
      <Stethoscope size={16} />
    </div>
  ) : (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300">
      <UserRound size={16} />
    </div>
  )
}

// ============================================================
// STAGE TWO
// ============================================================

function StageTwo({
  data,
  messages,
  setMessages,
  onEnd,
}) {
  const recognitionRef = useRef(null)

  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [captured, setCaptured] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const supported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window ||
      'webkitSpeechRecognition' in window)

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  function startListening() {
    setError('')
    setCaptured('')
    setInterim('')

    if (!supported) {
      setError(
        'Speech recognition is unavailable in this browser. Use Chrome or Edge.'
      )
      return
    }

    const Recognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition

    const recognition = new Recognition()

    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (e) => {
      let finalText = ''
      let interimText = ''

      for (
        let i = e.resultIndex;
        i < e.results.length;
        i++
      ) {
        const t =
          e.results[i][0].transcript

        if (e.results[i].isFinal) {
          finalText += `${t} `
        } else {
          interimText += t
        }
      }

      if (finalText) {
        setCaptured((v) =>
          `${v} ${finalText}`.trim()
        )
      }

      setInterim(interimText.trim())
    }

    recognition.onerror = (e) => {
      if (e.error !== 'aborted') {
        setError(
          `Microphone error: ${e.error}.`
        )
      }

      setListening(false)
    }

    recognition.onend = () => {
      setListening(false)
    }

    recognitionRef.current = recognition

    recognition.start()

    setListening(true)
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setListening(false)
    setInterim('')
  }

  async function submitCaptured() {
    const text = captured.trim()

    if (!text || busy) {
      return
    }

    stopListening()
    setCaptured('')
    setBusy(true)

    const id = Date.now()

    const user = {
      id,
      role: 'user',
      text,
      time: 'Now',
    }

    setMessages((m) => [...m, user])

    try {
      const res = await fetch(
    `${DOCTOR_API_URL}/consultation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            intake: data,
            history: [
              ...messages,
              {
                role: 'user',
                text,
              },
            ].map((message) => ({
              role: message.role,
              text: message.text,
            })),
            newMessage: text,
          }),
        }
      )

      const body = await res.json()

      const reply =
        body.reply ||
        'Apologies patient. My clinical communication array hit an interruption. Please verify backend terminals.'

      setMessages((m) => [
        ...m,
        {
          id: id + 1,
          role: 'doctor',
          text: reply,
          time: 'Now',
        },
      ])

      if (
        typeof window !== 'undefined' &&
        'speechSynthesis' in window
      ) {
        window.speechSynthesis.cancel()

        const utterance =
          new SpeechSynthesisUtterance(reply)

        utterance.rate = 1.0

        window.speechSynthesis.speak(
          utterance
        )
      }
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: id + 1,
          role: 'doctor',
          text: 'The consultation service is temporarily unavailable. Please try again.',
          time: 'Now',
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell stage="2">
      <section className="mx-auto flex min-h-[calc(100vh-120px)] max-w-4xl flex-col py-4">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.25em] text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Live room · MNX-2048
            </p>

            <h1 className="text-2xl font-medium sm:text-3xl">
              AI Doctor is listening
            </h1>

            <p className="mt-2 text-xs text-slate-500">
              {data.pathway === 'known'
                ? data.condition
                : 'Symptom-led assessment'}{' '}
              · {data.age} years · {data.weight} kg
            </p>
          </div>

          <button
            onClick={onEnd}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-xs font-semibold text-red-300"
          >
            <X size={14} />
            End Consultation
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/45">
          <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-7">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 ${
                  m.role === 'user'
                    ? 'flex-row-reverse'
                    : ''
                }`}
              >
                <Avatar doctor={m.role === 'doctor'} />

                <div
                  className={`max-w-[82%] ${
                    m.role === 'user'
                      ? 'text-right'
                      : ''
                  }`}
                >
                  <div
  className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
    m.role === 'doctor'
      ? 'rounded-tl-sm border border-slate-800 bg-slate-800/75 text-slate-200'
      : 'rounded-br-sm bg-emerald-400 text-slate-950'
  }`}
>
  {m.role === 'doctor' ? (
    <ReactMarkdown
      components={{
        h1: ({ children }) => (
          <h1 className="mb-3 mt-1 text-lg font-semibold text-emerald-300">
            {children}
          </h1>
        ),

        h2: ({ children }) => (
          <h2 className="mb-2 mt-4 flex items-center gap-2 text-base font-semibold text-emerald-300">
            <span>◆</span>
            {children}
          </h2>
        ),

        h3: ({ children }) => (
          <h3 className="mb-2 mt-3 text-sm font-semibold text-slate-100">
            {children}
          </h3>
        ),

        p: ({ children }) => (
          <p className="mb-3 last:mb-0 leading-6 text-slate-200">
            {children}
          </p>
        ),

        ul: ({ children }) => (
          <ul className="mb-3 space-y-2 pl-1">
            {children}
          </ul>
        ),

        ol: ({ children }) => (
          <ol className="mb-3 space-y-2 pl-5">
            {children}
          </ol>
        ),

        li: ({ children }) => (
          <li className="flex gap-2 leading-6">
            <span className="mt-1 text-emerald-400">•</span>
            <span>{children}</span>
          </li>
        ),

        strong: ({ children }) => (
          <strong className="font-semibold text-emerald-200">
            {children}
          </strong>
        ),

        blockquote: ({ children }) => (
          <blockquote className="my-3 border-l-2 border-emerald-400/50 pl-3 text-slate-300">
            {children}
          </blockquote>
        ),
      }}
    >
      {m.text}
    </ReactMarkdown>
  ) : (
    <p className="whitespace-pre-wrap">
      {m.text}
    </p>
  )}
</div>

                  <div className="mt-1 px-1 text-[10px] text-slate-600">
                    {m.role === 'doctor' && (
                      <Volume2
                        size={11}
                        className="mr-1 inline"
                      />
                    )}

                    {m.time}
                  </div>
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex gap-3">
                <Avatar doctor />

                <div className="rounded-2xl rounded-tl-sm border border-slate-800 bg-slate-800/75 px-4 py-3 text-xs text-emerald-300">
                  AI Doctor is composing a response…
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-800 bg-slate-950/50 p-4">
            <div className="voice-panel">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={
                    listening
                      ? stopListening
                      : startListening
                  }
                  className={`mic-button ${
                    listening
                      ? 'mic-active'
                      : ''
                  }`}
                  aria-label={
                    listening
                      ? 'Stop listening'
                      : 'Start listening'
                  }
                >
                  {listening ? (
                    <Pause size={18} />
                  ) : (
                    <Mic size={18} />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">
                    Voice transcript
                  </p>

                  <div className="mt-1 min-h-6 text-sm text-slate-200">
                    {captured || interim ? (
                      <>
                        {captured}{' '}

                        {interim && (
                          <span className="text-emerald-300">
                            {interim}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-500">
                        Listening… speak naturally and your words will appear here
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={submitCaptured}
                  disabled={
                    !captured.trim() || busy
                  }
                  className="capture-button"
                >
                  {busy
                    ? 'Working…'
                    : 'Capture words'}
                </button>
              </div>

              {error && (
                <p className="mt-3 text-xs text-amber-300">
                  {error}
                </p>
              )}

              <p className="mt-3 flex items-center gap-2 text-[10px] text-slate-600">
                <Activity
                  size={12}
                  className={
                    listening
                      ? 'animate-pulse text-emerald-400'
                      : ''
                  }
                />

                {listening
                  ? 'Microphone active · live words are being captured'
                  : 'Press the microphone to begin a new turn'}
              </p>
            </div>
          </div>
        </div>
      </section>
    </Shell>
  )
}

// ============================================================
// MEDICAL REPORT
// ============================================================

function downloadMedicalReport(
  format,
  data,
  messages
) {
  const lines = [
    'MEDNEXUS MEDICAL REPORT',
    'Session Terminated',
    '',
    `Patient Age: ${data.age} years`,
    `Body Weight: ${data.weight} kg`,
    `Assessment Mode: ${
      data.pathway === 'known'
        ? 'Known condition'
        : 'Active symptoms'
    }`,
    `Condition / Symptoms: ${
      data.pathway === 'known'
        ? data.condition
        : data.symptoms
    }`,
    `Severity Level: ${
      data.pathway === 'known'
        ? data.severity
        : 'Evaluating'
    }`,
    '',
    'TRANSCRIPT ARCHIVE',
    '',
    ...messages.map(
      (m) =>
        `${m.role === 'doctor' ? 'AI Doctor' : 'Patient'} · ${m.time}\n${m.text}`
    ),
  ]

  const text = lines.join('\n')

  const stamp = new Date()
    .toISOString()
    .slice(0, 10)

  const filename =
    `mednexus-medical-report-${stamp}`

  if (format === 'pdf') {
    const printWindow = window.open(
      '',
      '_blank',
      'width=800,height=900'
    )

    if (!printWindow) {
      window.alert(
        'Please allow pop-ups to create the PDF report.'
      )

      return
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${filename}</title>

          <style>
            @page {
              size: A4;
              margin: 0;
            }

            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              background: #07111c;
              color: #dce8ee;
              font-family: Arial, Helvetica, sans-serif;
              line-height: 1.5;
            }

            .sheet {
              min-height: 100vh;
              padding: 42px;
              background: #0b1623;
            }

            .topline {
              display: flex;
              justify-content: space-between;
              color: #56e0ad;
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 3px;
              margin-bottom: 24px;
            }

            .topline span:last-child {
              color: #f07b7b;
            }

            .hero {
              padding: 30px;
              border: 1px solid #274b54;
              border-radius: 24px;
              background: #102934;
              box-shadow: 0 16px 40px #061018;
            }

            .eyebrow {
              color: #56e0ad;
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 3px;
            }

            .hero h1 {
              margin: 18px 0 8px;
              color: #f1fbf7;
              font-size: 34px;
              font-weight: 500;
            }

            .hero p {
              margin: 0;
              color: #7fa5ae;
              font-size: 12px;
            }

            .meta-grid {
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 1px;
              margin: 18px 0;
              background: #27404a;
              border: 1px solid #27404a;
              border-radius: 18px;
              overflow: hidden;
            }

            .meta-grid div {
              min-height: 84px;
              padding: 15px;
              background: #0e222e;
            }

            .meta-grid small {
              display: block;
              margin-bottom: 10px;
              color: #607e88;
              font-size: 8px;
              letter-spacing: 1px;
            }

            .meta-grid strong {
              display: block;
              color: #e4f4ef;
              font-size: 12px;
              line-height: 1.35;
            }

            .archive {
              overflow: hidden;
              border: 1px solid #223d48;
              border-radius: 18px;
              background: #0b1c28;
              padding: 18px;
            }

            .archive-head {
              display: flex;
              justify-content: space-between;
              margin-bottom: 12px;
              color: #6f919b;
              font-size: 9px;
              font-weight: 700;
              letter-spacing: 2px;
            }

            .bubble {
              margin: 10px 0;
              padding: 15px 17px;
              border: 1px solid #263f4a;
              border-radius: 14px;
              background: #0f2532;
            }

            .bubble.patient {
              margin-left: 12%;
              border-color: #27765f;
              background: #10362f;
            }

            .message-label {
              color: #56e0ad;
              font-size: 9px;
              font-weight: 700;
              letter-spacing: 1px;
            }

            .message-label time {
              float: right;
              color: #6f919b;
              font-weight: 400;
              letter-spacing: 0;
            }

            .bubble p {
              margin: 9px 0 0;
              color: #dce8ee;
              font-size: 12px;
              line-height: 1.55;
            }

            footer {
              margin-top: 20px;
              color: #62838c;
              font-size: 9px;
              letter-spacing: 1px;
            }

            @media print {
              body {
                background: #0b1623;
              }

              .sheet {
                page-break-after: always;
              }
            }
          </style>
        </head>

        <body>
          <main class="sheet">
            <div class="topline">
              <span>MEDNEXUS</span>
              <span>SESSION TERMINATED</span>
            </div>

            <section class="hero">
              <div class="eyebrow">
                CLINICAL ARCHIVE · AI DOCTOR
              </div>

              <h1>
                Your care record, reconciled.
              </h1>

              <p>
                Consultation archive · ${messages.length} messages logged
              </p>
            </section>

            <section class="meta-grid">
              <div>
                <small>PATIENT AGE</small>
                <strong>${data.age} yrs</strong>
              </div>

              <div>
                <small>BODY WEIGHT</small>
                <strong>${data.weight} kg</strong>
              </div>

              <div>
                <small>ASSESSMENT MODE</small>
                <strong>
                  ${
                    data.pathway === 'known'
                      ? 'Known condition'
                      : 'Active symptoms'
                  }
                </strong>
              </div>

              <div>
                <small>CONDITION / SYMPTOMS</small>
                <strong>
                  ${
                    data.pathway === 'known'
                      ? data.condition
                      : data.symptoms
                  }
                </strong>
              </div>

              <div>
                <small>SEVERITY LEVEL</small>
                <strong>
                  ${
                    data.pathway === 'known'
                      ? data.severity
                      : 'Evaluating'
                  }
                </strong>
              </div>
            </section>

            <section class="archive">
              <div class="archive-head">
                <span>TRANSCRIPT ARCHIVE</span>
                <span>${messages.length} LOGS</span>
              </div>

              ${messages
                .map(
                  (m) => `
                    <article class="bubble ${
                      m.role === 'doctor'
                        ? 'doctor'
                        : 'patient'
                    }">
                      <div class="message-label">
                        ${
                          m.role === 'doctor'
                            ? 'AI DOCTOR'
                            : 'PATIENT'
                        }

                        <time>
                          ${m.time}
                        </time>
                      </div>

                      <p>
                        ${m.text.replace(
                          /[&<>]/g,
                          (c) =>
                            ({
                              '&': '&amp;',
                              '<': '&lt;',
                              '>': '&gt;',
                            })[c]
                        )}
                      </p>
                    </article>
                  `
                )
                .join('')}
            </section>

            <footer>
              Generated by MedNexus · For care coordination only
            </footer>
          </main>

          <script>
            window.onload = () => {
              window.print()
            }
          </script>
        </body>
      </html>
    `)

    printWindow.document.close()

    return
  }

  const blob = new Blob(
    [text],
    {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }
  )

  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')

  link.href = url
  link.download = `${filename}.doc`

  document.body.appendChild(link)

  link.click()

  link.remove()

  URL.revokeObjectURL(url)
}

// ============================================================
// STAGE THREE
// ============================================================

function StageThree({
  data,
  messages,
  onReset,
  onDashboard,
}) {
  const transcript = useMemo(
    () => messages.length,
    [messages]
  )

  useEffect(() => {
    const button = [
      ...document.querySelectorAll('button'),
    ].find((item) =>
      item.textContent.includes(
        'Download Medical Report'
      )
    )

    if (!button) {
      return
    }

    const handleDownload = () => {
      const format = window.prompt(
        'Choose report format: type Word or PDF',
        'PDF'
      )

      if (!format) {
        return
      }

      const normalized =
        format.trim().toLowerCase()

      if (
        normalized === 'word' ||
        normalized === 'doc' ||
        normalized === 'docx'
      ) {
        downloadMedicalReport(
          'word',
          data,
          messages
        )
      } else if (
        normalized === 'pdf'
      ) {
        downloadMedicalReport(
          'pdf',
          data,
          messages
        )
      } else {
        window.alert(
          'Please choose Word or PDF.'
        )
      }
    }

    button.addEventListener(
      'click',
      handleDownload
    )

    return () => {
      button.removeEventListener(
        'click',
        handleDownload
      )
    }
  }, [data, messages])

  return (
    <Shell stage="3">
      <section className="mx-auto max-w-5xl py-5 lg:py-10">
        <div className="mb-7">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-400/25 bg-red-500/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-red-300">
            Session Terminated
          </div>

          <h1 className="text-3xl font-medium sm:text-5xl">
            Your care record, reconciled.
          </h1>

          <p className="mt-3 text-sm text-slate-400">
            Consultation archive · {transcript} messages
            logged
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-800 bg-slate-800 sm:grid-cols-5">
          {[
            [
              'Patient Age',
              `${data.age} yrs`,
            ],
            [
              'Body Weight',
              `${data.weight} kg`,
            ],
            [
              'Assessment Mode',
              data.pathway === 'known'
                ? 'Known condition'
                : 'Active symptoms',
            ],
            [
              'Condition / Symptoms',
              data.pathway === 'known'
                ? data.condition
                : data.symptoms,
            ],
            [
              'Severity Level',
              data.pathway === 'known'
                ? data.severity
                : 'Evaluating',
            ],
          ].map(([l, v]) => (
            <div
              key={l}
              className="bg-slate-900/80 p-4"
            >
              <p className="mb-2 text-[10px] uppercase tracking-wider text-slate-600">
                {l}
              </p>

              <p className="truncate text-sm text-slate-200">
                {v}
              </p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/45">
          <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4">
            <FileText
              size={17}
              className="text-emerald-400"
            />

            <div>
              <h2 className="text-sm font-medium">
                Transcript Archive
              </h2>

              <p className="text-[11px] text-slate-500">
                Full conversation breakdown
              </p>
            </div>
          </div>

          <div className="max-h-[420px] space-y-4 overflow-y-auto p-5">
            {messages.map((m) => (
              <div
                key={m.id}
                className="flex gap-3"
              >
                <Avatar
                  doctor={m.role === 'doctor'}
                />

                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-widest text-slate-600">
                    {m.role === 'doctor'
                      ? 'AI Doctor'
                      : 'Patient'}{' '}
                    · {m.time}
                  </p>

                  <div className="text-sm leading-6 text-slate-300">
  {m.role === 'doctor' ? (
    <ReactMarkdown
      components={{
        h1: ({ children }) => (
          <h1 className="mb-3 text-lg font-semibold text-emerald-300">
            {children}
          </h1>
        ),

        h2: ({ children }) => (
          <h2 className="mb-2 mt-4 text-base font-semibold text-emerald-300">
            ◆ {children}
          </h2>
        ),

        h3: ({ children }) => (
          <h3 className="mb-2 mt-3 font-semibold text-slate-100">
            {children}
          </h3>
        ),

        p: ({ children }) => (
          <p className="mb-2 last:mb-0">
            {children}
          </p>
        ),

        ul: ({ children }) => (
          <ul className="mb-3 space-y-1 pl-2">
            {children}
          </ul>
        ),

        li: ({ children }) => (
          <li className="flex gap-2">
            <span className="text-emerald-400">•</span>
            <span>{children}</span>
          </li>
        ),

        strong: ({ children }) => (
          <strong className="font-semibold text-emerald-200">
            {children}
          </strong>
        ),
      }}
    >
      {m.text}
    </ReactMarkdown>
  ) : (
    <p className="whitespace-pre-wrap">
      {m.text}
    </p>
  )}
</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <button className="action-button action-button-primary">
            <Download size={15} />
            Download Medical Report
          </button>

          <button
            onClick={onReset}
            className="action-button"
          >
            <RotateCcw size={15} />
            Reset Intake
          </button>

          <button
            onClick={onDashboard}
            className="action-button"
          >
            <ArrowRight size={15} />
            Go to Dashboard
          </button>
        </div>
      </section>
    </Shell>
  )
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function Page() {
  const [stage, setStage] = useState(0)
  const [data, setData] = useState(null)
  const [messages, setMessages] =
    useState(initialMessages)

  const [history, setHistory] = useState([])
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const [loadingHistory, setLoadingHistory] =
    useState(true)

    function goToMainDashboard() {
  window.location.href = `${MAIN_APP_URL}/dashboard`
}

  // ==========================================================
  // CLIENT ID
  // ==========================================================

  const clientId =
    typeof window !== 'undefined'
      ? localStorage.getItem(
          'mednexus-client-id'
        ) ||
        (() => {
          const id =
            crypto.randomUUID()

          localStorage.setItem(
            'mednexus-client-id',
            id
          )

          return id
        })()
      : 'preview-client'

  // ==========================================================
  // LOAD HISTORY
  // ==========================================================

  async function loadHistory() {
    setLoadingHistory(true)

    try {
      const res = await fetch(
        '/history',
        {
          headers: {
            'x-mednexus-client':
              clientId,
          },
        }
      )

      if (!res.ok) {
        console.error(
          'History request failed:',
          res.status
        )

        setHistory([])

        return
      }

      const data = await res.json()

      // ======================================================
      // NORMALIZE HISTORY
      //
      // MySQL JSON values may sometimes arrive as strings.
      // The frontend needs `messages` to ALWAYS be an array.
      // ======================================================

      const normalizedHistory =
        Array.isArray(data)
          ? data.map((item) => {
              let messages =
                item.messages

              if (
                typeof messages ===
                'string'
              ) {
                try {
                  messages =
                    JSON.parse(messages)
                } catch {
                  messages = []
                }
              }

              return {
                ...item,
                messages:
                  Array.isArray(
                    messages
                  )
                    ? messages
                    : [],
              }
            })
          : []

      setHistory(
        normalizedHistory
      )
    } catch (error) {
      console.error(
        'Failed to load history:',
        error
      )

      setHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  // ==========================================================
  // INITIAL HISTORY LOAD
  // ==========================================================

  useEffect(() => {
    loadHistory()
  }, [])

  // ==========================================================
  // FINISH CONSULTATION
  // ==========================================================

  async function finish() {
    const item = {
      id: crypto.randomUUID(),

      patientAge:
        data.age,

      bodyWeight:
        data.weight,

      assessmentMode:
        data.pathway === 'known'
          ? 'Known condition'
          : 'Active symptoms',

      conditionOrSymptoms:
        data.pathway === 'known'
          ? data.condition
          : data.symptoms,

      severity:
        data.pathway === 'known'
          ? data.severity
          : 'Evaluating',

      messages,
    }

    await fetch(
      '/history',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',

          'x-mednexus-client':
            clientId,
        },

        body: JSON.stringify(item),
      }
    )

    await loadHistory()

    setSelected(null)

    setStage(3)
  }

  // ==========================================================
  // STAGE 0
  // ==========================================================

  if (stage === 0) {
    return (
      <StageZero
        history={history}
        query={query}
        setQuery={setQuery}
        loading={loadingHistory}
        onOpenHistory={(item) => {
          setSelected(item)
          setStage(3)
        }}
        onDeleteHistory={async () => {
          if (
            window.confirm(
              'Delete all conversation history permanently?'
            )
          ) {
            await fetch(
              '/history',
              {
                method: 'DELETE',

                headers: {
                  'x-mednexus-client':
                    clientId,
                },
              }
            )

            setHistory([])
          }
        }}
        onDashboard={goToMainDashboard}
        onLaunch={() =>
          setStage(1)
        }
      />
    )
  }

  // ==========================================================
  // STAGE 1
  // ==========================================================

  if (stage === 1) {
    return (
      <StageOne
        onBack={() =>
          setStage(0)
        }
        onInitialize={(d) => {
          setData(d)
          setMessages(
            initialMessages
          )
          setStage(2)
        }}
      />
    )
  }

  // ==========================================================
  // STAGE 2
  // ==========================================================

  if (stage === 2) {
    return (
      <StageTwo
        data={data}
        messages={messages}
        setMessages={setMessages}
        onEnd={finish}
      />
    )
  }

  // ==========================================================
  // SELECTED HISTORY
  // ==========================================================

  if (selected) {
    return (
      <StageThree
        data={{
          age:
            selected.patient_age,

          weight:
            selected.body_weight,

          pathway:
            selected.assessment_mode ===
            'Known condition'
              ? 'known'
              : 'unknown',

          condition:
            selected.assessment_mode ===
            'Known condition'
              ? selected.condition_or_symptoms
              : '',

          symptoms:
            selected.assessment_mode ===
            'Active symptoms'
              ? selected.condition_or_symptoms
              : '',

          severity:
            selected.severity,
        }}

        messages={
          Array.isArray(
            selected.messages
          )
            ? selected.messages
            : []
        }

        onReset={() => {
          setSelected(null)
          setStage(1)
        }}

        onDashboard={() => {
          setSelected(null)
          setStage(0)
        }}
      />
    )
  }

  // ==========================================================
  // CURRENT SESSION REPORT
  // ==========================================================

  return (
    <StageThree
      data={data}
      messages={messages}
      onReset={() => {
        setData(null)
        setMessages(
          initialMessages
        )
        setStage(1)
      }}
      onDashboard={() => {
        setSelected(null)
        setStage(0)
      }}
    />
  )
}

export { }