'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import en from '../../messages/en.json'
import hi from '../../messages/hi.json'
import gu from '../../messages/gu.json'

/**
 * UI localisation without locale-prefixed routes.
 *
 * The console is a single-page app with no per-locale URLs, so next-intl's
 * routing/middleware layer would add a URL scheme the product does not have.
 * Instead the locale is client state, persisted per device — which is also the
 * right model for a shared field terminal where the operator, not the link,
 * decides the language.
 *
 * Catalogues are statically imported so a locale switch needs no network round
 * trip: the console must stay fully usable offline, in any supported language.
 */

export const LOCALES = ['en', 'hi', 'gu'] as const
export type Locale = (typeof LOCALES)[number]

export const LOCALE_LABELS: Record<Locale, { native: string; english: string }> = {
  en: { native: 'English', english: 'English' },
  hi: { native: 'हिन्दी', english: 'Hindi' },
  gu: { native: 'ગુજરાતી', english: 'Gujarati' },
}

const CATALOGUES: Record<Locale, Record<string, unknown>> = { en, hi, gu }
const STORAGE_KEY = 'truthshield-locale'

interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
}

const LocaleContext = createContext<LocaleContextValue>({ locale: 'en', setLocale: () => {} })

export function useLocaleSwitcher() {
  return useContext(LocaleContext)
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // Always start at the server-rendered default; the stored preference is
  // applied after mount so the markup matches on hydration.
  const [locale, setLocaleState] = useState<Locale>('en')

  // The stored preference can only be read after hydration: localStorage does
  // not exist on the server, and seeding it into initial state would make the
  // first client render disagree with the server markup. An effect is therefore
  // the correct place, despite the lint rule's general advice.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    const browser = navigator.language.split('-')[0]
    const resolved = (LOCALES as readonly string[]).includes(stored ?? '')
      ? (stored as Locale)
      : (LOCALES as readonly string[]).includes(browser)
        ? (browser as Locale)
        : 'en'
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see note above
    setLocaleState(resolved)
    // Keep the document language in step so screen readers and the browser's own
    // text handling match what is actually rendered.
    document.documentElement.lang = resolved
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
    document.documentElement.lang = next
  }, [])

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale])

  return (
    <LocaleContext.Provider value={value}>
      <NextIntlClientProvider
        locale={locale}
        messages={CATALOGUES[locale]}
        timeZone="Asia/Kolkata"
        // A missing key must not blank the UI on a field terminal: fall back to
        // the English string, and surface the gap in the console instead.
        onError={(error) => {
          if (process.env.NODE_ENV !== 'production') console.warn('[i18n]', error.message)
        }}
        getMessageFallback={({ key, namespace }) => {
          const path = [namespace, key].filter(Boolean).join('.')
          const fromEnglish = path.split('.').reduce<unknown>(
            (acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined),
            en as unknown
          )
          return typeof fromEnglish === 'string' ? fromEnglish : path
        }}
      >
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  )
}
