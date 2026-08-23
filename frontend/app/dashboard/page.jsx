'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  ArrowUpRight,
  Clock3,
  FileSearch,
  History,
  LogOut,
  Menu,
  MessageCircleMore,
  ScanEye,
  Stethoscope,
  X,
} from 'lucide-react'

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://visionai-production-5ed5.up.railway.app'

const DOCTOR_APP_URL =
  process.env.NEXT_PUBLIC_DOCTOR_APP_URL ||
  'https://mednexus-doctor-9a233gqcf-gangavathsurya33s-projects.vercel.app/'

const features = [
  {
    title: 'Meet AI Doctor',
    description:
      'A calm, intelligent first step for your health questions, available whenever you need it.',
    icon: Stethoscope,
    tag: 'Live now',
    meta: '24/7 guidance',
    accent: 'emerald',
    action: 'doctor',
  },
  {
    title: 'Consultation Vault',
    description:
      'Your complete care story, organized into one private timeline that stays in your hands.',
    icon: History,
    tag: 'Your records',
    meta: 'Consultation history',
    accent: 'cyan',
    action: 'doctor',
  },
  {
    title: 'AI Document Assistant',
    description:
      'Turn dense medical documents into clear, useful next steps in a matter of seconds.',
    icon: ScanEye,
    tag: 'Ready to scan',
    meta: 'PDFs, labs, imaging',
    accent: 'teal',
    route: '/scanner',
  },
]

export default function DashboardPage() {
  const router = useRouter()
  function openDoctorApp() {
  window.location.href = DOCTOR_APP_URL
}

  const [menuOpen, setMenuOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)

  // ============================================================
  // GET CURRENT LOGGED-IN USER
  // ============================================================

  useEffect(() => {
    checkAuthentication()
  }, [])

  async function checkAuthentication() {
    try {
      const response = await fetch(
        `${API_URL}/api/auth/me`,
        {
          method: 'GET',
          credentials: 'include',
        }
      )

      if (!response.ok) {
        router.replace('/')
        return
      }

      const data = await response.json()

      if (!data.success || !data.user) {
        router.replace('/')
        return
      }

      setUser(data.user)
    } catch (error) {
      console.error(
        'Authentication check failed:',
        error
      )

      router.replace('/')
    } finally {
      setLoading(false)
    }
  }

  // ============================================================
  // LOGOUT
  // ============================================================

  async function handleLogout() {
    if (loggingOut) {
      return
    }

    setLoggingOut(true)

    try {
      const response = await fetch(
        `${API_URL}/api/auth/logout`,
        {
          method: 'POST',
          credentials: 'include',
        }
      )

      if (!response.ok) {
        console.error(
          'Logout failed:',
          response.status
        )
      }
    } catch (error) {
      console.error(
        'Logout request failed:',
        error
      )
    } finally {
      router.replace('/')
      router.refresh()
    }
  }

  // ============================================================
  // LOADING SCREEN
  // ============================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 size-10 animate-spin rounded-full border-2 border-emerald border-t-transparent" />

          <p className="text-sm text-white/50">
            Verifying secure session...
          </p>
        </div>
      </main>
    )
  }

  // ============================================================
  // USER DISPLAY NAME
  // ============================================================

  const displayName =
    user?.name ||
    user?.email?.split('@')[0] ||
    'User'

  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .map((word) => word[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U'

  return (
    <main className="dashboard-shell min-h-screen overflow-hidden bg-background text-foreground">
      <div
        className="dashboard-grid pointer-events-none fixed inset-0 opacity-40"
        aria-hidden="true"
      />

      <div
        className="dashboard-glow dashboard-glow-one pointer-events-none fixed"
        aria-hidden="true"
      />

      <div
        className="dashboard-glow dashboard-glow-two pointer-events-none fixed"
        aria-hidden="true"
      />

      {/* ========================================================
          NAVIGATION
      ======================================================== */}

      <nav
        className="dashboard-nav sticky top-0 z-30 mx-auto flex w-full max-w-7xl items-center justify-between border-b border-white/[0.08] px-5 py-4 sm:px-8 lg:px-10"
        aria-label="Primary navigation"
      >
        {/* LOGO */}

        <button
          className="flex items-center gap-3"
          onClick={() => router.push('/dashboard')}
          aria-label="Go to MedNexus dashboard"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-emerald text-emerald-foreground shadow-[0_0_25px_var(--emerald-glow)]">
            <Activity
              className="size-4"
              strokeWidth={2.5}
            />
          </span>

          <span className="font-mono text-sm font-semibold tracking-[0.2em] text-white">
            MEDNEXUS
          </span>
        </button>

        {/* DESKTOP NAVIGATION */}

        <div className="hidden items-center gap-8 md:flex">
          {[
            'Profile',
            'About',
            'Services',
            'Contact',
          ].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-sm text-white/50 transition-colors hover:text-emerald"
            >
              {item}
            </a>
          ))}
        </div>

        {/* USER + SIGN OUT */}

        <div className="flex items-center gap-3">
          <button
            className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/60 transition-colors hover:border-emerald/40 hover:text-white sm:flex"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-emerald/15 text-emerald">
              {initials}
            </span>

            <span>
              {displayName}
            </span>

            <LogOut className="size-3.5" />
          </button>

          {/* MOBILE MENU */}

          <button
            className="flex size-10 items-center justify-center rounded-xl border border-white/10 text-white/70 md:hidden"
            onClick={() =>
              setMenuOpen(!menuOpen)
            }
            aria-label={
              menuOpen
                ? 'Close menu'
                : 'Open menu'
            }
          >
            {menuOpen ? (
              <X className="size-5" />
            ) : (
              <Menu className="size-5" />
            )}
          </button>
        </div>

        {/* MOBILE MENU */}

        {menuOpen && (
          <div className="absolute left-4 right-4 top-[calc(100%+0.5rem)] rounded-2xl border border-white/10 bg-panel/95 p-3 shadow-2xl backdrop-blur-xl md:hidden">
            {[
              'Profile',
              'About',
              'Services',
              'Contact',
            ].map((item) => (
              <a
                onClick={() =>
                  setMenuOpen(false)
                }
                key={item}
                href={`#${item.toLowerCase()}`}
                className="block rounded-xl px-4 py-3 text-sm text-white/60 hover:bg-white/5 hover:text-emerald"
              >
                {item}
              </a>
            ))}

            {/* MOBILE SIGN OUT */}

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-white/60 hover:bg-white/5 hover:text-emerald disabled:opacity-50"
            >
              <LogOut className="size-4" />

              {loggingOut
                ? 'Signing out...'
                : 'Sign out'}
            </button>
          </div>
        )}
      </nav>

      {/* ========================================================
          MAIN CONTENT
      ======================================================== */}

      <div className="relative z-10 mx-auto max-w-7xl px-5 pb-16 pt-14 sm:px-8 sm:pt-20 lg:px-10 lg:pb-24">
        {/* ======================================================
            WELCOME
        ====================================================== */}

        <section className="mb-14 flex flex-col justify-between gap-10 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <div className="mb-6 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-emerald">
              <span className="size-2 animate-pulse rounded-full bg-emerald shadow-[0_0_12px_var(--emerald)]" />

              Secure care space
            </div>

            <h1 className="text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.06em] text-white sm:text-7xl">
              Good morning,
              <br />

              <span className="text-emerald">
                {displayName}.
              </span>{' '}
              Your health is in motion.
            </h1>

            <p className="mt-7 max-w-xl text-pretty text-base leading-7 text-white/50 sm:text-lg">
              Your care team, health records, and intelligent support — all connected in one quiet place.
            </p>
          </div>

          {/* STATUS */}

          <div className="dashboard-status flex shrink-0 items-center gap-4 rounded-2xl border border-emerald/20 bg-emerald/[0.06] px-4 py-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-emerald/15 text-emerald">
              <MessageCircleMore className="size-5" />
            </span>

            <div>
              <p className="text-xs font-medium text-white/75">
                Care network online
              </p>

              <p className="mt-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-emerald">
                <span className="size-1.5 rounded-full bg-emerald" />

                All systems healthy
              </p>
            </div>
          </div>
        </section>

        {/* ======================================================
            SERVICES
        ====================================================== */}

        <section
          id="services"
          className="grid gap-5 lg:grid-cols-3"
          aria-label="MedNexus services"
        >
          {features.map(
            (
              {
  title,
  description,
  icon: Icon,
  tag,
  meta,
  accent,
  route,
  action,
},
              index
            ) => (
              <button
  key={title}
  onClick={() => {
    if (action === 'doctor') {
      openDoctorApp()
      return
    }

    router.push(route)
  }}
                className={`feature-card feature-${accent} group text-left`}
              >
                <div className="flex items-start justify-between">
                  <span className="feature-icon">
                    <Icon
                      className="size-7"
                      strokeWidth={1.5}
                    />
                  </span>

                  <span className="feature-index font-mono text-[11px] text-white/25">
                    0{index + 1}
                  </span>
                </div>

                <div className="mt-20 sm:mt-28">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="rounded-full border border-current/20 bg-current/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald">
                      {tag}
                    </span>

                    <ArrowUpRight className="size-4 text-white/25 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                  </div>

                  <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
                    {title}
                  </h2>

                  <p className="mt-3 max-w-sm text-sm leading-6 text-white/45">
                    {description}
                  </p>

                  <div className="mt-7 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-white/30">
                    {index === 0 ? (
                      <Clock3 className="size-3.5" />
                    ) : index === 1 ? (
                      <History className="size-3.5" />
                    ) : (
                      <FileSearch className="size-3.5" />
                    )}

                    {meta}
                  </div>
                </div>
              </button>
            )
          )}
        </section>
      </div>
    </main>
  )
}