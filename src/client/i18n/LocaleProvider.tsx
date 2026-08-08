import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { LOCALES, STRINGS, type Locale, type Strings } from './strings.ts'

/**
 * Language is per-device, not per-room.
 *
 * Each player picks their own and it sticks on their phone — a French speaker
 * and an English speaker can sit at the same table without either of them
 * changing anything for anyone else. That is only possible because the pieces
 * that must be *identical* across the room (the mat, the answer, the quip) are
 * chosen server-side and sent as ids or numbers, never as pre-rendered English.
 *
 * The board deliberately does not use this: it is the shared surface, so it
 * stays in one language rather than flickering to whoever last touched it.
 */

const STORAGE_KEY = 'wnw.locale'

interface LocaleContext {
  locale: Locale
  setLocale: (next: Locale) => void
  t: Strings
}

const Context = createContext<LocaleContext | null>(null)

function initialLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && (LOCALES as string[]).includes(saved)) return saved as Locale
  // Fall back to the phone's own language before defaulting to English.
  return navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem(STORAGE_KEY, next)
    setLocaleState(next)
  }, [])

  return (
    <Context.Provider value={{ locale, setLocale, t: STRINGS[locale] }}>
      {children}
    </Context.Provider>
  )
}

export function useLocale(): LocaleContext {
  const ctx = useContext(Context)
  if (!ctx) throw new Error('useLocale used outside LocaleProvider')
  return ctx
}

/** Shorthand for the common case of only needing the strings. */
export const useT = (): Strings => useLocale().t
