'use client'

import { Languages, Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LOCALES, LOCALE_LABELS, useLocaleSwitcher, type Locale } from '@/components/locale-provider'

/**
 * UI language switcher. Distinct from the per-analysis language selector: this
 * changes the console chrome, not the language a submitted item is analysed in.
 */
export function LanguageSwitcher() {
  const { locale, setLocale } = useLocaleSwitcher()
  const t = useTranslations('app')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 gap-1.5 px-2" aria-label={t('language')}>
          <Languages className="h-4 w-4" />
          <span className="hidden text-xs font-medium sm:inline">
            {LOCALE_LABELS[locale].native}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs">{t('language')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LOCALES.map((l: Locale) => (
          <DropdownMenuItem key={l} onClick={() => setLocale(l)} className="gap-2">
            <span className="flex-1">{LOCALE_LABELS[l].native}</span>
            <span className="text-[10px] text-muted-foreground">{LOCALE_LABELS[l].english}</span>
            {locale === l && <Check className="h-3.5 w-3.5 text-emerald-500" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-[10px] leading-snug text-muted-foreground">
          {t('languageHint')}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
