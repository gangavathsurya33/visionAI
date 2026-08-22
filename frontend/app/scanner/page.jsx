'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  Plus,
  Send,
  FileText,
  X,
  Globe,
  Sparkles,
  Paperclip,
  Loader2,
  Search,
  Trash2,
  MessageSquare,
  Menu,
  ChevronLeft,
  MoreVertical,
  Pencil,
  ExternalLink,
  Download,
  AlertTriangle,
} from 'lucide-react'

const API_URL =
  process.env.NEXT_PUBLIC_MAIN_BACKEND_URL ||
  'http://localhost:8000'

const INITIAL_MESSAGE = {
  id: 'initial',
  role: 'assistant',
  content:
    'Hello. I’m your MedNexus AI Document Assistant. Upload a prescription, medical report, lab report, medicine image, PDF, or ask a medical-information question.',
  file: null,
}

const MAX_FILE_SIZE = 20 * 1024 * 1024

const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.txt',
  '.csv',
]

function formatFileSize(bytes) {
  if (!bytes) {
    return '0 KB'
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function isImageFile(file) {
  return (
    file?.type?.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp)$/i.test(file?.name || '')
  )
}

export default function DocumentAssistantPage() {
  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)

  // ==========================================================
  // CHAT STATE
  // ==========================================================

  const [messages, setMessages] = useState([
    INITIAL_MESSAGE,
  ])

  const [input, setInput] = useState('')

  const [selectedFile, setSelectedFile] = useState(null)

  const [mode, setMode] = useState('AI Analysis')

  const [loading, setLoading] = useState(false)

  // ==========================================================
  // SESSION
  // ==========================================================

  const [currentSessionId, setCurrentSessionId] =
    useState(null)

  const [currentSessionName, setCurrentSessionName] =
    useState('New Chat')

  // ==========================================================
  // HISTORY
  // ==========================================================

  const [history, setHistory] = useState([])

  const [historyLoading, setHistoryLoading] =
    useState(true)

  const [searchQuery, setSearchQuery] =
    useState('')

  // ==========================================================
  // SIDEBAR
  // ==========================================================

  const [sidebarOpen, setSidebarOpen] =
    useState(true)

  const [openMenuId, setOpenMenuId] =
    useState(null)

  // ==========================================================
  // MODALS
  // ==========================================================

  const [deleteTarget, setDeleteTarget] =
    useState(null)

  const [showClearConfirm, setShowClearConfirm] =
    useState(false)

  const [renameTarget, setRenameTarget] =
    useState(null)

  const [renameValue, setRenameValue] =
    useState('')

  // ==========================================================
  // LOAD HISTORY
  // ==========================================================

  async function loadHistory() {
    try {
      setHistoryLoading(true)

      const response = await fetch(
        `${API_URL}/api/document/history`,
        {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        }
      )

      if (!response.ok) {
        throw new Error(
          `History request failed: ${response.status}`
        )
      }

      const data = await response.json()

      setHistory(
        Array.isArray(data.sessions)
          ? data.sessions
          : []
      )
    } catch (error) {
      console.error(
        'Failed to load document history:',
        error
      )

      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    loadHistory()
  }, [])

  // ==========================================================
  // AUTO SCROLL
  // ==========================================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    })
  }, [messages, loading])

  // ==========================================================
  // FILTER HISTORY
  // ==========================================================

  const filteredHistory = useMemo(() => {
    const query = searchQuery
      .trim()
      .toLowerCase()

    if (!query) {
      return history
    }

    return history.filter((chat) =>
      String(chat.session_name || '')
        .toLowerCase()
        .includes(query)
    )
  }, [history, searchQuery])

  // ==========================================================
  // NEW CHAT
  // ==========================================================

  function handleNewChat() {
    if (loading) {
      return
    }

    setCurrentSessionId(null)

    setCurrentSessionName('New Chat')

    setMessages([INITIAL_MESSAGE])

    setInput('')

    setSelectedFile(null)

    setMode('AI Analysis')

    setOpenMenuId(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // ==========================================================
  // OPEN EXISTING CHAT
  // ==========================================================

  async function handleSelectChat(sessionId) {
    if (!sessionId || loading) {
      return
    }

    try {
      setLoading(true)

      setOpenMenuId(null)

      const response = await fetch(
        `${API_URL}/api/document/history/${sessionId}`,
        {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.detail ||
            'Unable to load this chat.'
        )
      }

      setCurrentSessionId(
        data.session?.id || sessionId
      )

      setCurrentSessionName(
        data.session?.session_name ||
          'New Chat'
      )

      const loadedMessages =
        Array.isArray(data.messages)
          ? data.messages
          : []

      setMessages(
        loadedMessages.map((item) => ({
          id:
            item.id ||
            crypto.randomUUID(),

          role:
            item.sender === 'ai'
              ? 'assistant'
              : 'user',

          content:
            item.message || '',

          file: item.file_name
            ? {
                name: item.file_name,
                size: null,
                type: '',
                url: null,
              }
            : null,
        }))
      )
    } catch (error) {
      console.error(
        'Load chat error:',
        error
      )

      window.alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  // ==========================================================
  // FILE SELECT
  // ==========================================================

  function handleFileSelect(event) {
    const file =
      event.target.files?.[0]

    if (!file) {
      return
    }

    const extension =
      `.${file.name
        .split('.')
        .pop()
        .toLowerCase()}`

    if (
      !ALLOWED_EXTENSIONS.includes(
        extension
      )
    ) {
      window.alert(
        'Please upload PDF, JPG, JPEG, PNG, WEBP, TXT, or CSV.'
      )

      event.target.value = ''

      return
    }

    if (
      file.size > MAX_FILE_SIZE
    ) {
      window.alert(
        'File size must be 20 MB or smaller.'
      )

      event.target.value = ''

      return
    }

    setSelectedFile(file)
  }

  // ==========================================================
  // REMOVE FILE
  // ==========================================================

  function removeSelectedFile() {
    setSelectedFile(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // ==========================================================
  // SEND MESSAGE
  // ==========================================================

  async function sendMessage() {
    const text = input.trim()

    if (!text && !selectedFile) {
      return
    }

    if (loading) {
      return
    }

    const fileForRequest = selectedFile

    const displayContent =
      text ||
      `Analyze ${fileForRequest.name}`

    const localFileUrl =
      fileForRequest
        ? URL.createObjectURL(
            fileForRequest
          )
        : null

    const userMessage = {
      id: crypto.randomUUID(),

      role: 'user',

      content: displayContent,

      file: fileForRequest
        ? {
            name: fileForRequest.name,
            size: fileForRequest.size,
            type: fileForRequest.type,
            url: localFileUrl,
          }
        : null,
    }

    // Show immediately
    setMessages((previous) => [
      ...previous,
      userMessage,
    ])

    setInput('')

    setSelectedFile(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    setLoading(true)

    try {
      const formData = new FormData()

      formData.append(
        'message',
        text
      )

      formData.append(
        'mode',
        mode
      )

      // IMPORTANT:
      // Existing session ID means continue
      // the same conversation.
      if (currentSessionId) {
        formData.append(
          'session_id',
          currentSessionId
        )
      }

      // Send recent frontend history too.
      const historyForAI =
        messages
          .filter(
            (message) =>
              message.id !== 'initial'
          )
          .slice(-20)
          .map((message) => ({
            role:
              message.role ===
              'assistant'
                ? 'assistant'
                : 'user',

            content:
              message.content,
          }))

      formData.append(
        'history',
        JSON.stringify(
          historyForAI
        )
      )

      if (fileForRequest) {
        formData.append(
          'file',
          fileForRequest
        )
      }

      const response =
        await fetch(
          `${API_URL}/api/document-assistant`,
          {
            method: 'POST',
            credentials: 'include',
            body: formData,
          }
        )

      let data = {}

      try {
        data =
          await response.json()
      } catch {
        data = {}
      }

      if (!response.ok) {
        throw new Error(
          data.detail ||
            `Request failed with status ${response.status}.`
        )
      }

      if (!data.reply) {
        throw new Error(
          'The AI returned an empty response.'
        )
      }

      // ======================================================
      // SAVE SESSION
      // ======================================================

      if (data.session_id) {
        setCurrentSessionId(
          data.session_id
        )
      }

      // ======================================================
      // SAVE GENERATED TITLE
      // ======================================================

      if (data.session_name) {
        setCurrentSessionName(
          data.session_name
        )
      }

      // ======================================================
      // AI RESPONSE
      // ======================================================

      setMessages((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),

          role: 'assistant',

          content: data.reply,

          file: null,
        },
      ])

      // ======================================================
      // REFRESH REAL DATABASE HISTORY
      // ======================================================

      await loadHistory()
    } catch (error) {
      console.error(
        'Document assistant error:',
        error
      )

      setMessages((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),

          role: 'assistant',

          content:
            `I couldn't complete that request.\n\n**Reason:** ${error.message}`,

          file: null,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  // ==========================================================
  // ENTER KEY
  // ==========================================================

  function handleKeyDown(event) {
    if (
      event.key === 'Enter' &&
      !event.shiftKey
    ) {
      event.preventDefault()

      sendMessage()
    }
  }

  // ==========================================================
  // DELETE CHAT
  // ==========================================================

  async function confirmDeleteChat() {
    if (!deleteTarget) {
      return
    }

    try {
      const response =
        await fetch(
          `${API_URL}/api/document/history/${deleteTarget.id}`,
          {
            method: 'DELETE',
            credentials: 'include',
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.detail ||
            'Unable to delete chat.'
        )
      }

      if (
        currentSessionId ===
        deleteTarget.id
      ) {
        handleNewChat()
      }

      setDeleteTarget(null)

      await loadHistory()
    } catch (error) {
      console.error(
        'Delete chat error:',
        error
      )

      window.alert(error.message)
    }
  }

  // ==========================================================
  // CLEAR HISTORY
  // ==========================================================

  async function confirmClearHistory() {
    try {
      const response =
        await fetch(
          `${API_URL}/api/document/history`,
          {
            method: 'DELETE',
            credentials: 'include',
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.detail ||
            'Unable to clear history.'
        )
      }

      setHistory([])

      handleNewChat()

      setShowClearConfirm(false)
    } catch (error) {
      console.error(
        'Clear history error:',
        error
      )

      window.alert(error.message)
    }
  }

  // ==========================================================
  // RENAME
  // ==========================================================

  function openRename(chat) {
    setRenameTarget(chat)

    setRenameValue(
      chat.session_name ||
        'New Chat'
    )

    setOpenMenuId(null)
  }

  async function confirmRename() {
    if (
      !renameTarget ||
      !renameValue.trim()
    ) {
      return
    }

    try {
      const response =
        await fetch(
          `${API_URL}/api/document/history/${renameTarget.id}`,
          {
            method: 'PATCH',

            credentials: 'include',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              session_name:
                renameValue.trim(),
            }),
          }
        )

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data.detail ||
            'Unable to rename chat.'
        )
      }

      if (
        currentSessionId ===
        renameTarget.id
      ) {
        setCurrentSessionName(
          renameValue.trim()
        )
      }

      setRenameTarget(null)

      setRenameValue('')

      await loadHistory()
    } catch (error) {
      console.error(
        'Rename error:',
        error
      )

      window.alert(error.message)
    }
  }

  // ==========================================================
  // FILE CARD
  // ==========================================================

  function FileCard({
    file,
    selectable = false,
  }) {
    if (!file) {
      return null
    }

    return (
      <div className="mt-3 overflow-hidden rounded-xl border border-white/15 bg-black/20">
        <div className="flex items-center gap-3 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-400">
            <FileText size={18} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {file.name}
            </p>

            {file.size && (
              <p className="mt-0.5 text-xs opacity-50">
                {formatFileSize(
                  file.size
                )}
              </p>
            )}
          </div>
        </div>

        {selectable &&
          file.url &&
          isImageFile(file) && (
            <div className="border-t border-white/10 p-3">
              <img
                src={file.url}
                alt={file.name}
                className="max-h-72 w-full rounded-lg object-contain"
              />
            </div>
          )}

        {selectable &&
          file.url && (
            <div className="flex border-t border-white/10">
              <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="flex flex-1 items-center justify-center gap-2 px-3 py-2.5 text-xs opacity-60 hover:bg-white/5 hover:opacity-100"
              >
                <ExternalLink size={13} />
                Open
              </a>

              <a
                href={file.url}
                download={file.name}
                className="flex flex-1 items-center justify-center gap-2 border-l border-white/10 px-3 py-2.5 text-xs opacity-60 hover:bg-white/5 hover:opacity-100"
              >
                <Download size={13} />
                Download
              </a>
            </div>
          )}
      </div>
    )
  }

  // ==========================================================
  // SIDEBAR
  // ==========================================================

  function Sidebar() {
    return (
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[300px] flex-col border-r border-white/10 bg-[#101827] transition-transform duration-300 ${
          sidebarOpen
            ? 'translate-x-0'
            : '-translate-x-full'
        }`}
      >
        <div className="p-4">
          <button
            onClick={handleNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-4 text-base font-semibold shadow-lg shadow-purple-900/20 transition hover:from-violet-500 hover:to-purple-500"
          >
            <Plus size={21} />
            New Chat
          </button>

          <div className="relative mt-4">
            <Search
              size={19}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50"
            />

            <input
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(
                  event.target.value
                )
              }
              placeholder="Search chats..."
              className="w-full rounded-2xl border border-white/5 bg-[#202c3c] py-4 pl-12 pr-4 text-sm text-white outline-none placeholder:text-white/40 focus:border-purple-400/40"
            />
          </div>

          <button
            onClick={() =>
              setShowClearConfirm(
                true
              )
            }
            disabled={
              history.length === 0
            }
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-4 font-semibold transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={18} />
            Clear Chat History
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <h2 className="px-2 py-5 text-xl font-semibold text-white/70">
            Recent Chats
          </h2>

          {historyLoading ? (
            <div className="flex items-center justify-center py-8 text-white/40">
              <Loader2
                size={18}
                className="mr-2 animate-spin"
              />
              Loading chats...
            </div>
          ) : filteredHistory.length ===
            0 ? (
            <div className="px-3 py-8 text-center">
              <MessageSquare
                size={28}
                className="mx-auto mb-3 text-white/20"
              />

              <p className="text-sm text-white/40">
                {searchQuery
                  ? 'No chats found.'
                  : 'No previous chats yet.'}
              </p>

              <p className="mt-1 text-xs text-white/20">
                Start a conversation to create history.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredHistory.map(
                (chat) => {
                  const active =
                    currentSessionId ===
                    chat.id

                  return (
                    <div
                      key={chat.id}
                      className={`group relative rounded-xl transition ${
                        active
                          ? 'bg-[#293649]'
                          : 'bg-[#202c3c] hover:bg-[#293649]'
                      }`}
                    >
                      <button
                        onClick={() =>
                          handleSelectChat(
                            chat.id
                          )
                        }
                        className="flex w-full items-center gap-3 px-4 py-4 pr-11 text-left"
                      >
                        <MessageSquare
                          size={18}
                          className="shrink-0 text-white/80"
                        />

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white/90">
                            {chat.session_name ||
                              'New Chat'}
                          </p>

                          <p className="mt-1 text-[10px] text-white/30">
                            {chat.updated_at
                              ? new Date(
                                  chat.updated_at
                                ).toLocaleDateString(
                                  undefined,
                                  {
                                    month:
                                      'short',
                                    day:
                                      'numeric',
                                  }
                                )
                              : ''}
                          </p>
                        </div>
                      </button>

                      <button
                        onClick={() =>
                          setOpenMenuId(
                            openMenuId ===
                              chat.id
                              ? null
                              : chat.id
                          )
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-white/30 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100"
                      >
                        <MoreVertical
                          size={17}
                        />
                      </button>

                      {openMenuId ===
                        chat.id && (
                        <div className="absolute right-2 top-12 z-50 w-36 overflow-hidden rounded-xl border border-white/10 bg-[#172131] shadow-2xl">
                          <button
                            onClick={() =>
                              openRename(
                                chat
                              )
                            }
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-white/70 hover:bg-white/5 hover:text-white"
                          >
                            <Pencil
                              size={14}
                            />
                            Rename
                          </button>

                          <button
                            onClick={() => {
                              setDeleteTarget(
                                chat
                              )
                              setOpenMenuId(
                                null
                              )
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2
                              size={14}
                            />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )
                }
              )}
            </div>
          )}
        </div>
      </aside>
    )
  }

  // ==========================================================
  // MAIN UI
  // ==========================================================

  return (
    <main className="min-h-screen bg-[#07111c] text-white">
      <Sidebar />

      <div
        className={`min-h-screen transition-all duration-300 ${
          sidebarOpen
            ? 'ml-[300px]'
            : 'ml-0'
        }`}
      >
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#08131f]/95 px-5 py-4 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <button
              onClick={() =>
                setSidebarOpen(
                  !sidebarOpen
                )
              }
              className="rounded-xl border border-white/10 p-2 text-white/60 hover:bg-white/5 hover:text-white"
            >
              {sidebarOpen ? (
                <ChevronLeft size={20} />
              ) : (
                <Menu size={20} />
              )}
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-semibold">
                {currentSessionName}
              </h1>

              <p className="text-xs text-white/35">
                AI Document Assistant
              </p>
            </div>
          </div>
        </header>

        <section className="h-[calc(100vh-77px-96px)] overflow-y-auto">
          <div className="mx-auto max-w-4xl px-5 py-8">
            {messages.map(
              (message) => (
                <div
                  key={message.id}
                  className={`mb-6 flex ${
                    message.role ===
                    'user'
                      ? 'justify-end'
                      : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-5 py-4 ${
                      message.role ===
                      'user'
                        ? 'bg-emerald-400 text-slate-950'
                        : 'border border-white/10 bg-[#10202d] text-white/85'
                    }`}
                  >
                    <ReactMarkdown
                      components={{
                        h1: ({
                          children,
                        }) => (
                          <h1 className="mb-3 text-xl font-semibold">
                            {children}
                          </h1>
                        ),

                        h2: ({
                          children,
                        }) => (
                          <h2 className="mb-3 mt-5 text-lg font-semibold">
                            {children}
                          </h2>
                        ),

                        h3: ({
                          children,
                        }) => (
                          <h3 className="mb-2 mt-4 font-semibold">
                            {children}
                          </h3>
                        ),

                        strong: ({
                          children,
                        }) => (
                          <strong className="font-semibold">
                            {children}
                          </strong>
                        ),

                        ul: ({
                          children,
                        }) => (
                          <ul className="my-3 list-disc space-y-1 pl-5">
                            {children}
                          </ul>
                        ),

                        ol: ({
                          children,
                        }) => (
                          <ol className="my-3 list-decimal space-y-1 pl-5">
                            {children}
                          </ol>
                        ),

                        p: ({
                          children,
                        }) => (
                          <p className="mb-3 leading-7 last:mb-0">
                            {children}
                          </p>
                        ),
                      }}
                    >
                      {String(
                        message.content ||
                          ''
                      )}
                    </ReactMarkdown>

                    <FileCard
                      file={
                        message.file
                      }
                      selectable
                    />
                  </div>
                </div>
              )
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#10202d] px-5 py-4 text-sm text-white/50">
                  <Loader2
                    size={17}
                    className="animate-spin text-emerald-400"
                  />

                  {mode ===
                  'Web Search'
                    ? 'Analyzing and researching...'
                    : 'Analyzing your request...'}
                </div>
              </div>
            )}

            <div
              ref={
                messagesEndRef
              }
            />
          </div>
        </section>

        <div
          className="fixed bottom-0 right-0 border-t border-white/10 bg-[#08131f]/95 px-4 py-4 backdrop-blur-xl"
          style={{
            left: sidebarOpen
              ? '300px'
              : '0px',
          }}
        >
          <div className="mx-auto max-w-4xl">
            {selectedFile && (
              <div className="mb-3 flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3">
                <Paperclip
                  size={16}
                  className="shrink-0 text-emerald-400"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {selectedFile.name}
                  </p>

                  <p className="text-xs text-white/40">
                    {formatFileSize(
                      selectedFile.size
                    )}
                  </p>
                </div>

                <button
                  onClick={
                    removeSelectedFile
                  }
                  className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="mb-3 flex gap-2">
              <button
                onClick={() =>
                  setMode(
                    'AI Analysis'
                  )
                }
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ${
                  mode ===
                  'AI Analysis'
                    ? 'bg-emerald-400 text-slate-950'
                    : 'border border-white/10 text-white/50'
                }`}
              >
                <Sparkles size={13} />
                AI Analysis
              </button>

              <button
                onClick={() =>
                  setMode(
                    'Web Search'
                  )
                }
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ${
                  mode ===
                  'Web Search'
                    ? 'bg-emerald-400 text-slate-950'
                    : 'border border-white/10 text-white/50'
                }`}
              >
                <Globe size={13} />
                Web Search
              </button>
            </div>

            <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-[#101d29] p-2">
              <button
                type="button"
                onClick={() =>
                  fileInputRef.current?.click()
                }
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white/50 hover:bg-white/5 hover:text-emerald-400"
                title="Upload medical document"
              >
                <Plus size={21} />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.csv"
                onChange={
                  handleFileSelect
                }
                className="hidden"
              />

              <textarea
                value={input}
                onChange={(event) =>
                  setInput(
                    event.target.value
                  )
                }
                onKeyDown={
                  handleKeyDown
                }
                placeholder={
                  selectedFile
                    ? 'Ask something about this document...'
                    : 'Ask about your prescription, report, medicines, or health...'
                }
                rows={1}
                className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-3 text-sm text-white outline-none placeholder:text-white/30"
              />

              <button
                type="button"
                onClick={
                  sendMessage
                }
                disabled={
                  loading ||
                  (!input.trim() &&
                    !selectedFile)
                }
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-400 text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {loading ? (
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>

            <p className="mt-2 text-center text-[10px] text-white/25">
              MedNexus provides medical information and document explanations, not a diagnosis or prescription.
            </p>
          </div>
        </div>
      </div>

      {/* DELETE MODAL */}

      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121d2b] p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
                <Trash2 size={19} />
              </div>

              <div>
                <h2 className="font-semibold">
                  Delete chat?
                </h2>

                <p className="text-xs text-white/40">
                  This cannot be undone.
                </p>
              </div>
            </div>

            <p className="mb-6 text-sm text-white/60">
              Delete "
              {deleteTarget.session_name ||
                'New Chat'}
              " and all its messages?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() =>
                  setDeleteTarget(null)
                }
                className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm text-white/60 hover:bg-white/5"
              >
                Cancel
              </button>

              <button
                onClick={
                  confirmDeleteChat
                }
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLEAR MODAL */}

      {showClearConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121d2b] p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
                <AlertTriangle size={19} />
              </div>

              <h2 className="font-semibold">
                Clear all chat history?
              </h2>
            </div>

            <p className="mb-6 text-sm text-white/60">
              This permanently removes all your document assistant conversations.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() =>
                  setShowClearConfirm(
                    false
                  )
                }
                className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm text-white/60 hover:bg-white/5"
              >
                Cancel
              </button>

              <button
                onClick={
                  confirmClearHistory
                }
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold hover:bg-red-500"
              >
                Clear Everything
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENAME MODAL */}

      {renameTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121d2b] p-6 shadow-2xl">
            <h2 className="mb-4 font-semibold">
              Rename chat
            </h2>

            <input
              autoFocus
              value={renameValue}
              onChange={(event) =>
                setRenameValue(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter'
                ) {
                  confirmRename()
                }
              }}
              className="mb-5 w-full rounded-xl border border-white/10 bg-[#202c3c] px-4 py-3 text-sm text-white outline-none focus:border-purple-400/50"
            />

            <div className="flex gap-3">
              <button
                onClick={() =>
                  setRenameTarget(null)
                }
                className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm text-white/60 hover:bg-white/5"
              >
                Cancel
              </button>

              <button
                onClick={
                  confirmRename
                }
                className="flex-1 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold hover:bg-purple-500"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}