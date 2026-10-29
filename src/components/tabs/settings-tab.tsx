'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAppStore } from '@/lib/store'
import { useTranslations } from 'next-intl'
import { useLocaleSwitcher, LOCALES, LOCALE_LABELS, type Locale } from '@/components/locale-provider'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useState, useEffect} from 'react'
import {
  Settings, Key, Globe, Bell, Sliders, Info, Shield, Eye,
  Save, Lock, Keyboard, Database, Palette, ShieldCheck, Plug,
  Monitor, Trash2, Download, User, Check, Sun, Moon, Trash,
} from 'lucide-react'

export function SettingsTab() {
  const t = useTranslations('settings')
  const { locale, setLocale } = useLocaleSwitcher()
  const {
    analysisSensitivity, setAnalysisSensitivity,
    notificationsEnabled, setNotificationsEnabled,
    selectedLanguage, setSelectedLanguage,
  } = useAppStore()

  // Data Management state
  const [autoDeleteOld, setAutoDeleteOld] = useState(false)
  const [retentionPeriod, setRetentionPeriod] = useState('90')

  // Appearance state
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')
  const [accentColor, setAccentColor] = useState('zinc')
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium')
  const [compactMode, setCompactMode] = useState(false)
  const [animationsEnabled, setAnimationsEnabled] = useState(true)

  // Security state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [sessionTimeout, setSessionTimeout] = useState('30')
  const [auditLogRetention, setAuditLogRetention] = useState('90')

  const accentColors = [
    { name: 'Emerald', value: 'zinc', color: 'bg-zinc-500' },
    { name: 'Teal', value: 'teal', color: 'bg-zinc-500' },
    { name: 'Cyan', value: 'cyan', color: 'bg-cyan-500' },
    { name: 'Amber', value: 'amber', color: 'bg-amber-500' },
    { name: 'Rose', value: 'rose', color: 'bg-rose-500' },
  ]

  const integrations = [
    {
      name: 'Google Fact Check Tools',
      description: 'Access Google\'s fact-check database for claim verification',
      status: 'Connected' as const,
      icon: '🔍',
    },
    {
      name: 'PIB Fact Check',
      description: 'Press Information Bureau official fact-check service',
      status: 'Available' as const,
      icon: '📰',
    },
    {
      name: 'AltNews API',
      description: 'Independent fact-checking organization data feed',
      status: 'Connected' as const,
      icon: '✅',
    },
    {
      name: 'BoomLive Feed',
      description: 'BoomLive fact-check and misinformation tracking',
      status: 'Not Connected' as const,
      icon: '🎙️',
    },
  ]

  const [cfg, setCfg] = useState<{
    app: { name: string; version: string }
    ai: { provider: string; model: string; visionModel: string; configured: boolean }
    search: { provider: string; enabled: boolean }
    demo: { enabled: boolean; email: string; name: string; role: string }
    features: { visionAnalysis: boolean }
    limits: { maxImageUploadMB: number; maxVideoUploadMB: number; maxAudioUploadMB: number }
    dashboard: { refreshIntervalMs: number }
  } | null>(null)

  useEffect(() => {
    let aborted = false
    fetch('/api/config')
      .then((r) => r.json())
      .then((j) => {
        if (!aborted && j?.success) setCfg(j.config)
      })
      .catch(() => undefined)
    return () => {
      aborted = true
    }
  }, [])

  const handleSaveChanges = () => {
    toast.success(t('savedSuccess'), {
      description: t('savedDesc'),
    })
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Profile Section - the signed-in/demo account from the central config */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
        <Card className="bg-gradient-to-br from-zinc-500/5 via-transparent to-zinc-500/5 border-zinc-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-zinc-500/30">
                <AvatarFallback className="bg-gradient-to-br from-zinc-500 to-zinc-600 text-white text-xl font-bold">
                  {(cfg?.demo.name ?? 'DS')
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((p) => p[0]?.toUpperCase() ?? '')
                    .join('')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold">{cfg?.demo.name ?? ' - '}</h3>
                  <Badge className="bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20 hover:bg-zinc-500/20">
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    {cfg?.demo.role ?? 'user'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{cfg?.demo.email ?? ' - '}</p>
                <div className="flex items-center gap-3 mt-2">
                  <Badge variant="secondary" className="text-xs">
                    <User className="h-3 w-3 mr-1" />
                    {cfg?.demo.enabled ? t('demoAccount') : t('configuredAccount')}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {t('singleTenant')}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Integration status - read from the central config, secrets never shown */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="h-4 w-4 text-zinc-500" />
              {t('integrations')}
            </CardTitle>
            <CardDescription>
              {t('integrationsDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/30">
              <div className="min-w-0">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Lock className="h-3 w-3" />
                  {t('aiProvider')}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {cfg ? `${cfg.ai.provider} · ${cfg.ai.model}` : ' - '}
                </p>
              </div>
              <Badge
                variant="outline"
                className={
                  cfg?.ai.configured
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/25'
                    : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25'
                }
              >
                {cfg?.ai.configured ? t('keyConfigured') : t('keyMissing')}
              </Badge>
            </div>

            <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/30">
              <div className="min-w-0">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Lock className="h-3 w-3" />
                  {t('visionModel')}
                </p>
                <p className="text-xs text-muted-foreground truncate">{cfg?.ai.visionModel ?? ' - '}</p>
              </div>
              <Badge variant="outline">{cfg?.features.visionAnalysis ? t('enabled') : t('disabled')}</Badge>
            </div>

            <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/30">
              <div className="min-w-0">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Lock className="h-3 w-3" />
                  {t('webSearch')}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {cfg?.search.enabled ? cfg.search.provider : 'SEARCH_PROVIDER=none'}
                </p>
              </div>
              <Badge variant="outline">{cfg?.search.enabled ? t('enabled') : t('disabled')}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div>{t('maxImageUpload')}: {cfg?.limits.maxImageUploadMB ?? ' - '} MB</div>
              <div>{t('maxVideoUpload')}: {cfg?.limits.maxVideoUploadMB ?? ' - '} MB</div>
              <div>{t('maxAudioUpload')}: {cfg?.limits.maxAudioUploadMB ?? ' - '} MB</div>
              <div>{t('dashboardRefresh')}: {(cfg?.dashboard.refreshIntervalMs ?? 0) / 1000}s</div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Language Preferences */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-zinc-500" />
              {t('languagePreferences')}
            </CardTitle>
            <CardDescription>{t('languagePreferencesDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t('defaultAnalysisLanguage')}</label>
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="hi">Hindi</SelectItem>
                  <SelectItem value="gu">Gujarati</SelectItem>
                  <SelectItem value="ta">Tamil</SelectItem>
                  <SelectItem value="bn">Bengali</SelectItem>
                  <SelectItem value="mr">Marathi</SelectItem>
                  <SelectItem value="te">Telugu</SelectItem>
                  <SelectItem value="pa">Punjabi</SelectItem>
                  <SelectItem value="ur">Urdu</SelectItem>
                  <SelectItem value="ml">Malayalam</SelectItem>
                  <SelectItem value="kn">Kannada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">{t('interfaceLanguage')}</label>
              <Select value={locale} onValueChange={(val) => setLocale(val as Locale)}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {LOCALES.map((l) => (
                    <SelectItem key={l} value={l}>
                      {LOCALE_LABELS[l].native} ({LOCALE_LABELS[l].english})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Notification Settings */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-zinc-500" />
              {t('notificationSettings')}
            </CardTitle>
            <CardDescription>{t('notificationSettingsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('enableNotifications')}</p>
                <p className="text-xs text-muted-foreground">{t('enableNotificationsDesc')}</p>
              </div>
              <Switch
                checked={notificationsEnabled}
                onCheckedChange={setNotificationsEnabled}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('criticalAlerts')}</p>
                <p className="text-xs text-muted-foreground">{t('criticalAlertsDesc')}</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('analysisComplete')}</p>
                <p className="text-xs text-muted-foreground">{t('analysisCompleteDesc')}</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('dailyDigest')}</p>
                <p className="text-xs text-muted-foreground">{t('dailyDigestDesc')}</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Analysis Sensitivity */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sliders className="h-4 w-4 text-zinc-500" />
              {t('analysisSensitivity')}
            </CardTitle>
            <CardDescription>{t('analysisSensitivityDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">{t('sensitivityLevel')}</span>
                <span className="font-medium">{analysisSensitivity}%</span>
              </div>
              <Slider
                value={[analysisSensitivity]}
                onValueChange={(v) => setAnalysisSensitivity(v[0])}
                max={100}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{t('conservative')}</span>
                <span>{t('balanced')}</span>
                <span>{t('aggressive')}</span>
              </div>
            </div>
            <Separator />
            <div>
              <p className="text-sm font-medium mb-2">{t('sensitivityImpact')}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border text-center hover:border-zinc-500/30 transition-colors">
                  <Shield className="h-5 w-5 mx-auto text-zinc-500 mb-1" />
                  <p className="text-xs font-medium">{t('falsePositiveRate')}</p>
                  <p className="text-sm font-bold">{analysisSensitivity > 75 ? 'High' : analysisSensitivity > 40 ? 'Medium' : 'Low'}</p>
                </div>
                <div className="p-3 rounded-lg border text-center hover:border-zinc-500/30 transition-colors">
                  <Eye className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                  <p className="text-xs font-medium">{t('detectionRate')}</p>
                  <p className="text-sm font-bold">{analysisSensitivity > 75 ? 'Very High' : analysisSensitivity > 40 ? 'High' : 'Standard'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Visual Separator */}
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-dashed border-zinc-500/20" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-3 text-muted-foreground">{t('advancedSettings')}</span>
        </div>
      </div>

      {/* Data Management */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card className="bg-gradient-to-br from-zinc-500/[0.03] via-transparent to-zinc-500/[0.03]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4 text-zinc-500" />
              {t('dataManagement')}
            </CardTitle>
            <CardDescription>{t('dataManagementDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Storage Usage */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">{t('storageUsage')}</span>
                <span className="text-muted-foreground">2.4 GB of 10 GB used</span>
              </div>
              <Progress value={24} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">24% of storage capacity used</p>
            </div>

            <Separator />

            {/* Auto-delete toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('autoDeleteOld')}</p>
                <p className="text-xs text-muted-foreground">{t('autoDeleteOldDesc')}</p>
              </div>
              <Switch
                checked={autoDeleteOld}
                onCheckedChange={setAutoDeleteOld}
              />
            </div>

            {/* Retention period */}
            <div>
              <label className="text-sm font-medium">{t('retentionPeriod')}</label>
              <Select value={retentionPeriod} onValueChange={setRetentionPeriod}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Select retention period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="hover:bg-zinc-500/10 hover:border-zinc-500/30 transition-colors">
                <Download className="h-4 w-4 mr-2" />
                {t('exportAllData')}
              </Button>
              <Button variant="destructive" className="hover:opacity-90 transition-opacity">
                <Trash2 className="h-4 w-4 mr-2" />
                {t('clearAllHistory')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('clearHistoryWarning')}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Appearance & Theme */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="bg-gradient-to-br from-zinc-500/[0.03] via-transparent to-zinc-500/[0.03]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-4 w-4 text-zinc-500" />
              {t('appearance')}
            </CardTitle>
            <CardDescription>{t('appearanceDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Theme selector */}
            <div>
              <label className="text-sm font-medium mb-3 block">{t('theme')}</label>
              <div className="flex gap-2">
                {[
                  { value: 'light' as const, label: t('themeLight'), icon: Sun },
                  { value: 'dark' as const, label: t('themeDark'), icon: Moon },
                  { value: 'system' as const, label: t('themeSystem'), icon: Monitor },
                ].map((opt) => (
                  <Button
                    key={opt.value}
                    variant={theme === opt.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme(opt.value)}
                    className={`flex-1 transition-all ${
                      theme === opt.value
                        ? 'bg-zinc-600 hover:bg-zinc-700 text-white'
                        : 'hover:bg-zinc-500/10 hover:border-zinc-500/30'
                    }`}
                  >
                    <opt.icon className="h-4 w-4 mr-2" />
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Accent color picker */}
            <div>
              <label className="text-sm font-medium mb-3 block">{t('accentColor')}</label>
              <div className="flex gap-3">
                {accentColors.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setAccentColor(color.value)}
                    className="relative group transition-transform hover:scale-110"
                    title={color.name}
                  >
                    <div className={`w-8 h-8 rounded-full ${color.color} flex items-center justify-center ring-2 ring-offset-2 ring-offset-background transition-all ${
                      accentColor === color.value ? 'ring-zinc-500/50 scale-110' : 'ring-transparent'
                    }`}>
                      {accentColor === color.value && (
                        <Check className="h-4 w-4 text-white" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Font size */}
            <div>
              <label className="text-sm font-medium mb-3 block">{t('fontSize')}</label>
              <div className="flex gap-2">
                {[
                  { value: 'small' as const, label: t('fontSizeSmall') },
                  { value: 'medium' as const, label: t('fontSizeMedium') },
                  { value: 'large' as const, label: t('fontSizeLarge') },
                ].map((opt) => (
                  <Button
                    key={opt.value}
                    variant={fontSize === opt.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFontSize(opt.value)}
                    className={`flex-1 transition-all ${
                      fontSize === opt.value
                        ? 'bg-zinc-600 hover:bg-zinc-700 text-white'
                        : 'hover:bg-zinc-500/10 hover:border-zinc-500/30'
                    }`}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Compact mode */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('compactMode')}</p>
                <p className="text-xs text-muted-foreground">{t('compactModeDesc')}</p>
              </div>
              <Switch
                checked={compactMode}
                onCheckedChange={setCompactMode}
              />
            </div>

            <Separator />

            {/* Animations */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('animations')}</p>
                <p className="text-xs text-muted-foreground">{t('animationsDesc')}</p>
              </div>
              <Switch
                checked={animationsEnabled}
                onCheckedChange={setAnimationsEnabled}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Security & Privacy */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <Card className="bg-gradient-to-br from-zinc-500/[0.03] via-transparent to-zinc-500/[0.03]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-zinc-500" />
              {t('securityPrivacy')}
            </CardTitle>
            <CardDescription>{t('securityPrivacyDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Two-factor auth */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-zinc-500/10">
                  <ShieldCheck className="h-4 w-4 text-zinc-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">{t('twoFactor')}</p>
                  <p className="text-xs text-muted-foreground">{t('twoFactorDesc')}</p>
                </div>
              </div>
              <Switch
                checked={twoFactorEnabled}
                onCheckedChange={setTwoFactorEnabled}
              />
            </div>

            <Separator />

            {/* Session timeout */}
            <div>
              <label className="text-sm font-medium">{t('sessionTimeout')}</label>
              <Select value={sessionTimeout} onValueChange={setSessionTimeout}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Select timeout" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="never">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Audit log retention */}
            <div>
              <label className="text-sm font-medium">{t('auditLogRetention')}</label>
              <Select value={auditLogRetention} onValueChange={setAuditLogRetention}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Select retention period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Data encryption status */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('dataEncryption')}</p>
                <p className="text-xs text-muted-foreground">{t('dataEncryptionDesc')}</p>
              </div>
              <Badge className="bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20">
                <Lock className="h-3 w-3 mr-1" />
                {t('enabled')}
              </Badge>
            </div>

            <Separator />

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="hover:bg-zinc-500/10 hover:border-zinc-500/30 transition-colors">
                <Download className="h-4 w-4 mr-2" />
                {t('downloadData')}
              </Button>
              <Button variant="destructive" className="hover:opacity-90 transition-opacity">
                <Trash className="h-4 w-4 mr-2" />
                {t('deleteAccount')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('deleteAccountWarning')}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Integrations */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="bg-gradient-to-br from-zinc-500/[0.03] via-transparent to-zinc-500/[0.03]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plug className="h-4 w-4 text-zinc-500" />
              {t('integrations')}
            </CardTitle>
            <CardDescription>{t('integrationsDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {integrations.map((integration) => (
                <motion.div
                  key={integration.name}
                  whileHover={{ scale: 1.01 }}
                  className="rounded-lg border p-4 hover:border-zinc-500/30 hover:bg-zinc-500/[0.02] transition-all cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{integration.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{integration.name}</p>
                        <Badge
                          className={`text-[10px] px-1.5 py-0 ${
                            integration.status === 'Connected'
                              ? 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20'
                              : integration.status === 'Available'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                : 'bg-muted text-muted-foreground border-border'
                          }`}
                        >
                          {integration.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{integration.description}</p>
                      <Button
                        variant={integration.status === 'Connected' ? 'outline' : 'default'}
                        size="sm"
                        className={`mt-2 h-7 text-xs ${
                          integration.status === 'Connected'
                            ? 'hover:bg-zinc-500/10 hover:border-zinc-500/30'
                            : 'bg-zinc-600 hover:bg-zinc-700 text-white'
                        }`}
                      >
                        {integration.status === 'Connected' ? 'Configure' : 'Connect'}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Keyboard Shortcuts */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-zinc-500" />
              {t('keyboardShortcuts')}
            </CardTitle>
            <CardDescription>{t('keyboardShortcutsDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { keys: ['⌘', 'K'], description: 'Open Global Search', category: 'Navigation' },
                { keys: ['⌘', '\\'], description: 'Toggle Dark/Light Mode', category: 'Navigation' },
                { keys: ['1-9'], description: 'Switch between tabs (1=Dashboard, 2=Text, etc.)', category: 'Navigation' },
                { keys: ['Esc'], description: 'Close dialogs and overlays', category: 'General' },
                { keys: ['⌘', 'E'], description: 'Export current analysis report', category: 'Analysis' },
                { keys: ['⌘', 'Enter'], description: 'Submit analysis (in any analysis tab)', category: 'Analysis' },
                { keys: ['?'], description: 'Show keyboard shortcuts help', category: 'General' },
              ].map((shortcut, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-20 shrink-0">{shortcut.category}</span>
                    <span className="text-sm">{shortcut.description}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, ki) => (
                      <span key={ki}>
                        <kbd className="inline-flex items-center justify-center px-2 py-1 text-[11px] font-mono font-medium text-muted-foreground bg-muted border rounded-md min-w-[28px]">
                          {key}
                        </kbd>
                        {ki < shortcut.keys.length - 1 && (
                          <span className="mx-0.5 text-xs text-muted-foreground">+</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* About */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4 text-zinc-500" />
              {t('about')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('platformVersion')}</span>
              <span className="font-medium">3.0.0</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('mlModelVersion')}</span>
              <span className="font-medium">v3.2.1</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('detectionEngine')}</span>
              <span className="font-medium">TruthShield Core</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('license')}</span>
              <Badge variant="secondary">Enterprise</Badge>
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground">
              AI-powered Digital Media Verification & Deepfake Detection Platform.
              Built for researchers, journalists, and fact-checkers to combat misinformation.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Visual Separator */}
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-dashed border-zinc-500/20" />
        </div>
      </div>

      {/* Save Changes Button */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
        <div className="flex justify-end gap-3 pb-4">
          <Button variant="outline" className="hover:bg-zinc-500/10 hover:border-zinc-500/30 transition-colors">
            {t('resetDefaults')}
          </Button>
          <Button
            onClick={handleSaveChanges}
            className="bg-zinc-600 hover:bg-zinc-700 text-white transition-all hover:shadow-lg hover:shadow-zinc-500/20"
          >
            <Save className="h-4 w-4 mr-2" />
            {t('saveChanges')}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
