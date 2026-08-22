'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000'

export default function OAuthSuccessPage() {
  const router = useRouter()

  useEffect(() => {
    async function verifyAuthentication() {
      try {
        const response = await fetch(
          `${API_URL}/api/auth/me`,
          {
            method: 'GET',
            credentials: 'include',
          }
        )

        if (response.ok) {
          router.replace('/dashboard')
          return
        }

        router.replace('/login')
      } catch (error) {
        console.error(
          'OAuth authentication check failed:',
          error
        )

        router.replace('/login')
      }
    }

    verifyAuthentication()
  }, [router])

  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-white">
      <div className="text-center">
        <p className="text-lg">
          Signing you in...
        </p>

        <p className="mt-2 text-sm text-white/50">
          Please wait.
        </p>
      </div>
    </main>
  )
}