import { LOCALES } from './strings.ts'
import { useLocale } from './LocaleProvider.tsx'

/**
 * EN / FR switch, fixed to the top-right of every player screen.
 *
 * Fixed rather than placed inside each screen so it is genuinely on every
 * page without threading it through six components — `.screen` reserves the
 * top padding it sits in. Labelled in the *target* language on each half, so
 * a French speaker who has landed in English can find it without reading
 * English.
 */
export function LocaleToggle() {
  const { locale, setLocale } = useLocale()

  return (
    <div className="locale-toggle" role="group" aria-label="Language / Langue">
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          className={`locale-toggle__option ${code === locale ? 'is-current' : ''}`}
          aria-pressed={code === locale}
          onClick={() => setLocale(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
