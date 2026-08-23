'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  Activity,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  GitBranch,
  Globe2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://visionai-production-5ed5.up.railway.app'

async function fetchWithRetry(url, options, maxWaitMs = 20000) {
  const start = Date.now()

  while (true) {
    try {
      return await fetch(url, options)
    } catch (error) {
      const elapsed = Date.now() - start

      if (elapsed >= maxWaitMs) {
        throw error
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 1000)
      )
    }
  }
}
  

export default function Page() {
  const router = useRouter()

  const [isRegistering, setIsRegistering] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()

    if (isLoading) {
      return
    }

    setIsLoading(true)

    try {
      const endpoint = isRegistering
        ? `${API_URL}/api/auth/register`
        : `${API_URL}/api/auth/login`

      const requestBody = isRegistering
        ? {
            name: fullName.trim(),
            email: email.trim().toLowerCase(),
            password,
          }
        : {
            email: email.trim().toLowerCase(),
            password,
          }

      const response = await fetchWithRetry(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include',
  body: JSON.stringify(requestBody),
})

      const text = await response.text()

      let data

      try {
        data = JSON.parse(text)
      } catch {
        console.error(
          'Backend returned non-JSON response:',
          text
        )

        alert(
          `Server error (${response.status}). Check the backend terminal.`
        )

        return
      }

      if (!response.ok) {
        alert(
          data?.detail ||
            `Authentication failed (${response.status}).`
        )

        return
      }

      // -----------------------------
      // REGISTRATION SUCCESS
      // -----------------------------

      if (isRegistering) {
        if (data.success) {
          alert(
            'Account created successfully. Please sign in.'
          )

          setIsRegistering(false)
          setPassword('')
          setFullName('')

          return
        }

        alert('Account creation failed.')
        return
      }

      // -----------------------------
      // LOGIN SUCCESS
      // -----------------------------

      if (data.success && data.user) {
        router.push('/dashboard')
        return
      }

      alert('Login failed.')
    } catch (error) {
      console.error(
        'Authentication error:',
        error
      )

      alert(
        'Cannot connect to the backend. Make sure the FastAPI server is running on port 8000.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="flex min-h-screen flex-col lg:flex-row">

        {/* =====================================================
            LEFT SIDE
        ===================================================== */}

        <section className="relative flex min-h-[460px] flex-1 flex-col justify-between overflow-hidden border-b border-white/10 bg-panel px-6 py-7 sm:px-10 lg:min-h-screen lg:border-b-0 lg:border-r lg:px-14 lg:py-10">

          <div
            className="medical-grid absolute inset-0 opacity-50"
            aria-hidden="true"
          />

          <div
            className="scan-line absolute left-0 top-0 h-px w-full bg-emerald/60"
            aria-hidden="true"
          />

          {/* LOGO */}

          <div className="relative z-10 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald text-emerald-foreground shadow-[0_0_26px_var(--emerald-glow)]">
              <Activity
                className="size-5"
                strokeWidth={2.5}
              />
            </div>

            <span className="font-mono text-sm font-semibold tracking-[0.22em] text-white">
              MEDNEXUS
            </span>
          </div>

          {/* HERO */}

          <div className="relative z-10 flex flex-1 items-center py-14 lg:py-0">
            <div className="max-w-xl">

              <p className="mb-6 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-emerald">
                <span className="inline-block size-2 animate-pulse rounded-full bg-emerald" />
                Care, connected
              </p>

              <h1 className="max-w-lg text-balance font-sans text-4xl font-semibold leading-[1.05] tracking-[-0.05em] text-white sm:text-6xl lg:text-7xl">
                The next pulse of{' '}
                <span className="text-emerald">
                  healthcare.
                </span>
              </h1>

              <p className="mt-7 max-w-md text-pretty text-base leading-7 text-white/55 sm:text-lg">
                One secure space for your care team,
                health insights, and the decisions that
                matter most.
              </p>

              <div className="relative mt-12 flex max-w-md items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur-sm">

                <div className="relative flex size-12 shrink-0 items-center justify-center rounded-full border border-emerald/30 bg-emerald/10 text-emerald">
                  <ShieldCheck className="size-5" />

                  <span className="absolute -right-1 -top-1 size-2 rounded-full bg-emerald shadow-[0_0_10px_var(--emerald)]" />
                </div>

                <div>
                  <p className="text-sm font-medium text-white">
                    Your health, held safely
                  </p>

                  <p className="mt-1 text-xs leading-5 text-white/45">
                    Encrypted by design. Private by default.
                  </p>
                </div>

                <div className="ml-auto hidden size-9 items-center justify-center rounded-full border border-white/10 text-white/40 sm:flex">
                  <ArrowRight className="size-4" />
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER */}

          <div className="relative z-10 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-white/30">

            <span>
              © 2026 MedNexus
            </span>

            <span className="flex items-center gap-2">
              <Globe2 className="size-3" />
              Global care network
            </span>

          </div>

          <div
            className="orbit orbit-one"
            aria-hidden="true"
          >
            <div className="orbit-dot" />
          </div>

          <div
            className="orbit orbit-two"
            aria-hidden="true"
          >
            <div className="orbit-dot" />
          </div>

          <div
            className="crosshair crosshair-one"
            aria-hidden="true"
          >
            <span />
            <span />
          </div>

          <div
            className="crosshair crosshair-two"
            aria-hidden="true"
          >
            <span />
            <span />
          </div>

        </section>

        {/* =====================================================
            RIGHT SIDE
        ===================================================== */}

        <section className="flex flex-1 items-center justify-center bg-background px-6 py-12 sm:px-10 lg:px-16">

          <div className="w-full max-w-md">

            {/* HEADER */}

            <div className="mb-10 flex items-center justify-between">

              <div>

                <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-emerald">
                  Welcome back
                </p>

                <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                  {isRegistering
                    ? 'Create your account'
                    : 'Sign in to MedNexus'}
                </h2>

              </div>

              <div className="hidden size-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-emerald sm:flex">
                <Sparkles className="size-5" />
              </div>

            </div>

            {/* =================================================
                FORM
            ================================================= */}

            <form
              className="space-y-5"
              onSubmit={handleSubmit}
            >

              {/* FULL NAME */}

              {isRegistering && (
                <label className="block">

                  <span className="mb-2 block text-sm font-medium text-white/70">
                    Full name
                  </span>

                  <input
                    type="text"
                    placeholder="Dr. Alex Morgan"
                    className="auth-input w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-white focus:border-emerald focus:outline-none"
                    value={fullName}
                    onChange={(event) =>
                      setFullName(event.target.value)
                    }
                    required
                  />

                </label>
              )}

              {/* EMAIL */}

              <label className="block">

                <span className="mb-2 block text-sm font-medium text-white/70">
                  Email address
                </span>

                <span className="relative flex items-center">

                  <Mail className="absolute left-4 size-5 text-white/40" />

                  <input
                    type="email"
                    placeholder="you@example.com"
                    className="auth-input w-full rounded-xl border border-white/10 bg-slate-900 p-3 pl-12 text-white focus:border-emerald focus:outline-none"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    required
                  />

                </span>

              </label>

              {/* PASSWORD */}

              <label className="block">

                <span className="mb-2 block text-sm font-medium text-white/70">
                  Password
                </span>

                <span className="relative flex items-center">

                  <LockKeyhole className="absolute left-4 size-5 text-white/40" />

                  <input
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    placeholder="Enter your password"
                    className="auth-input w-full rounded-xl border border-white/10 bg-slate-900 p-3 pl-12 pr-12 text-white focus:border-emerald focus:outline-none"
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    required
                  />

                  <button
                    type="button"
                    aria-label={
                      showPassword
                        ? 'Hide password'
                        : 'Show password'
                    }
                    onClick={() =>
                      setShowPassword(
                        !showPassword
                      )
                    }
                    className="absolute right-4 text-white/40 hover:text-white"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>

                </span>

              </label>

              {/* OPTIONS */}

              <div className="flex items-center justify-between pt-1 text-xs">

                <label className="flex items-center gap-2 text-white/45">

                  <input
                    type="checkbox"
                    className="size-3.5 accent-emerald"
                  />

                  Remember me

                </label>

                <button
                  type="button"
                  className="text-emerald transition-colors hover:text-white"
                >
                  Forgot password?
                </button>

              </div>

              {/* SUBMIT */}

              <button
                type="submit"
                disabled={isLoading}
                className="group flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-emerald font-semibold text-emerald-foreground shadow-[0_10px_35px_var(--emerald-shadow)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_40px_var(--emerald-shadow)] disabled:cursor-not-allowed disabled:opacity-60"
              >

                {isLoading
                  ? 'Please wait...'
                  : isRegistering
                    ? 'Create account'
                    : 'Continue'}

                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />

              </button>

            </form>

            {/* DIVIDER */}

            <div className="my-8 flex items-center gap-4">

              <div className="h-px flex-1 bg-white/10" />

              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/30">
                or continue with
              </span>

              <div className="h-px flex-1 bg-white/10" />

            </div>

            {/* SOCIAL */}

            <div className="grid grid-cols-2 gap-3">

              <button
  type="button"
  className="social-button"
  onClick={() => {
    window.location.href =
      `${API_URL}/api/auth/google/login`
  }}
>
  <span className="social-icon google-icon">
    G
  </span>

  Google
</button>

              <button
  type="button"
  className="social-button"
  onClick={() => {
    window.location.href =
      `${API_URL}/api/auth/github/login`
  }}
>
  <GitBranch className="size-4" />

  GitHub
</button>

            </div>

            {/* SWITCH LOGIN / REGISTER */}

            <p className="mt-8 text-center text-sm text-white/40">

              {isRegistering
                ? 'Already have an account?'
                : 'New to MedNexus?'}

              {' '}

              <button
                type="button"
                className="font-medium text-emerald hover:text-white"
                onClick={() =>
                  setIsRegistering(
                    !isRegistering
                  )
                }
              >
                {isRegistering
                  ? 'Sign in'
                  : 'Create an account'}
              </button>

            </p>

            {/* FOOTER */}

            <div className="mt-12 flex items-center justify-center gap-2 text-[11px] text-white/25">

              <Check className="size-3 text-emerald" />

              HIPAA-conscious infrastructure

            </div>

          </div>

        </section>

      </div>
    </main>
  )
}