'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Download, FileJson, FileText, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

interface ExportButtonProps {
  data: Record<string, unknown>
  filename?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

type ExportFormat = 'json' | 'pdf'

export function ExportButton({
  data,
  filename = 'truthshield-report',
  variant = 'outline',
  size = 'sm',
}: ExportButtonProps) {
  const [exporting, setExporting] = useState(false)
  const t = useTranslations('export')

  const handleExport = async (format: ExportFormat) => {
    setExporting(true)

    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportData: data,
          format,
          filename,
        }),
      })

      if (!res.ok) {
        throw new Error('Export failed')
      }

      // Use the server's content type; fall back to the expected type for the format
      const serverType = res.headers.get('Content-Type') ?? ''
      const isPlainText = serverType.includes('text/plain')

      const contentType = isPlainText
        ? 'text/plain'
        : format === 'pdf'
          ? 'application/pdf'
          : 'application/json'

      // Extension: PDF requests that the server returns as plain text are saved as .txt
      const extension = format === 'pdf' && isPlainText ? 'txt' : format

      const arrayBuffer = await res.arrayBuffer()
      const blob = new Blob([arrayBuffer], { type: contentType })
      const url = window.URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url

      // Strip any existing extension so we don't get "report.pdf.pdf"
      const safeFilename = filename.replace(/\.(pdf|json|txt)$/i, '')
      a.download = `${safeFilename}.${extension}`

      document.body.appendChild(a)
      a.click()
      a.remove()

      // Delay revoke so the browser has time to start the download
      window.setTimeout(() => {
        window.URL.revokeObjectURL(url)
      }, 1000)

      toast.success(t('success', { format: format.toUpperCase() }))
    } catch (error) {
      console.error('Export error:', error)
      toast.error(t('failed'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={exporting}>
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {size !== 'icon' && <span className="ml-2">{t('button')}</span>}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('json')}>
          <FileJson className="h-4 w-4 mr-2" />
          {t('exportJson')}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <FileText className="h-4 w-4 mr-2" />
          {t('exportPdf')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
