'use client'

import { FormEvent, useState } from 'react'
import Image from 'next/image'
import {
  Activity,
  ArrowRight,
  Eye,
  EyeOff,
  Fingerprint,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  ShieldEllipsis,
} from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return

    setError('')
    setBusy(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          typeof data.error === 'string' ? data.error : 'Sign-in failed. Please check your details and try again.',
        )
      }

      const requestedPath = new URLSearchParams(window.location.search).get('next') || '/'
      const safePath = requestedPath.startsWith('/') && !requestedPath.startsWith('//') && !requestedPath.includes('\\')
        ? requestedPath
        : '/'

      // Full page load so the new session cookie is used from the first request.
      window.location.replace(safePath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07090d] text-white selection:bg-teal-300/30">
      {/* Ambient background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-teal-500/[0.09] blur-[130px]" />
        <div className="absolute -bottom-52 -right-32 h-[38rem] w-[38rem] rounded-full bg-orange-500/[0.08] blur-[150px]" />
        <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:54px_54px] [mask-image:linear-gradient(to_bottom,black,transparent_88%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1440px] items-center justify-center px-5 py-8 sm:px-8 lg:px-12">
        <div className="grid w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/10 bg-[#0c1017]/90 shadow-[0_32px_120px_rgba(0,0,0,0.55)] backdrop-blur-xl lg:min-h-[690px] lg:grid-cols-[1.05fr_0.95fr]">
          {/* Brand / information panel */}
          <section className="relative hidden flex-col justify-between overflow-hidden border-r border-white/[0.07] bg-gradient-to-br from-[#111b22] via-[#0d141b] to-[#101014] p-10 lg:flex xl:p-14">
            <div aria-hidden="true" className="absolute -right-28 top-24 h-80 w-80 rounded-full border border-teal-300/10" />
            <div aria-hidden="true" className="absolute -right-12 top-40 h-48 w-48 rounded-full border border-teal-300/10" />
            <div aria-hidden="true" className="absolute bottom-20 right-16 h-52 w-52 rounded-full bg-teal-400/[0.06] blur-3xl" />

            <div className="relative z-10 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-teal-300/20 bg-teal-300/10 shadow-lg shadow-teal-950/30">
                <Image src="/logo.svg" alt="TruthShield" width={31} height={31} priority />
              </div>
              <div>
                <p className="text-lg font-semibold tracking-[0.12em]">TRUTH<span className="text-teal-300">SHIELD</span></p>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.28em] text-slate-500">by CyArt Security</p>
              </div>
            </div>

            <div className="relative z-10 max-w-lg py-12">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/[0.07] px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-200">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-300 opacity-50" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-300" />
                </span>
                Information integrity platform
              </div>
              <h1 className="text-4xl font-semibold leading-[1.13] tracking-tight xl:text-5xl">
                See beyond the signal.
                <span className="mt-2 block bg-gradient-to-r from-teal-200 via-cyan-200 to-slate-100 bg-clip-text text-transparent">Protect what is true.</span>
              </h1>
              <p className="mt-6 max-w-md text-sm leading-7 text-slate-400">
                Your secure workspace for digital evidence review, media verification and information integrity analysis.
              </p>

              <div className="mt-12 grid max-w-md grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
                  <ShieldCheck className="h-5 w-5 text-teal-300" />
                  <p className="mt-4 text-sm font-medium text-slate-100">Secure access</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Protected administrator sign-in</p>
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
                  <Activity className="h-5 w-5 text-orange-300" />
                  <p className="mt-4 text-sm font-medium text-slate-100">Analysis workspace</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Tools gathered in one console</p>
                </div>
              </div>
            </div>

            <div className="relative z-10 flex items-center justify-between border-t border-white/[0.08] pt-5 text-[10px] uppercase tracking-[0.18em] text-slate-600">
              <span>Digital trust. Defended.</span>
              <span>TruthShield Console</span>
            </div>
          </section>

          {/* Login form */}
          <section className="flex items-center justify-center px-6 py-12 sm:px-12 lg:px-10 xl:px-16">
            <div className="w-full max-w-[410px]">
              <div className="mb-10 flex items-center gap-3 lg:hidden">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-teal-300/20 bg-teal-300/10">
                  <Image src="/logo.svg" alt="TruthShield" width={29} height={29} priority />
                </div>
                <div>
                  <p className="text-base font-semibold tracking-[0.12em]">TRUTH<span className="text-teal-300">SHIELD</span></p>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">by CyArt Security</p>
                </div>
              </div>

              <div className="mb-8">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] text-teal-200">
                  <Fingerprint className="h-6 w-6" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-300">Welcome back</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">Sign in to TruthShield</h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">Enter your administrator credentials to continue to the secure console.</p>
              </div>

              <form onSubmit={submit} className="space-y-5" noValidate={false}>
                <div>
                  <label htmlFor="email" className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Email address</label>
                  <div className="group flex items-center rounded-xl border border-white/10 bg-[#080c12] transition focus-within:border-teal-300/60 focus-within:ring-4 focus-within:ring-teal-300/10">
                    <span className="pl-4 text-slate-500"><ShieldEllipsis className="h-[18px] w-[18px]" /></span>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      required
                      maxLength={254}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="name@company.com"
                      className="h-[52px] min-w-0 w-full bg-transparent px-3 py-4 text-sm text-white outline-none placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Password</label>
                    <span className="text-[10px] uppercase tracking-[0.12em] text-slate-600">Admin access</span>
                  </div>
                  <div className="flex items-center rounded-xl border border-white/10 bg-[#080c12] transition focus-within:border-teal-300/60 focus-within:ring-4 focus-within:ring-teal-300/10">
                    <span className="pl-4 text-slate-500"><LockKeyhole className="h-[18px] w-[18px]" /></span>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      maxLength={256}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter your password"
                      className="h-[52px] min-w-0 w-full bg-transparent px-3 py-4 text-sm text-white outline-none placeholder:text-slate-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      className="mr-2 rounded-lg p-2 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
                    >
                      {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div role="alert" aria-live="polite" className="rounded-xl border border-red-400/25 bg-red-500/[0.08] px-4 py-3 text-sm leading-6 text-red-200">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy || !email.trim() || !password}
                  className="group flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-300 to-cyan-300 px-5 text-sm font-bold text-[#061116] shadow-lg shadow-teal-950/30 transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-300/30 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {busy ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Signing in securely…</> : <>Sign in securely <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></>}
                </button>
              </form>

              <div className="mt-8 flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-teal-300/80" />
                <p className="text-xs leading-5 text-slate-500">This console is restricted to authorised administrators. Your session is protected by a secure, HTTP-only sign-in cookie.</p>
              </div>

              <p className="mt-8 text-center text-[11px] tracking-wide text-slate-600">© {new Date().getFullYear()} CyArt Security · TruthShield</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
