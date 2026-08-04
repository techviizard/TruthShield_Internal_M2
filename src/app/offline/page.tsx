import Link from 'next/link'

/**
 * Served by the service worker when a navigation is attempted with no network
 * and no cached copy of the target. Static by design - it must render from the
 * cache with no data fetching of its own.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold">You are offline</h1>
      <p className="text-sm text-muted-foreground">
        TruthShield could not reach the server and has no cached copy of this page.
      </p>
      <div className="w-full rounded-lg border bg-muted/30 p-4 text-left text-sm">
        <p className="font-medium">What still works without a connection</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Text analysis scored on-device by the pattern detector</li>
          <li>The recurring-hoax registry cached on this device</li>
          <li>Previously loaded dashboards and case data, marked as stale</li>
          <li>Queued submissions, which sync automatically once you reconnect</li>
        </ul>
        <p className="mt-3 text-xs">
          Language-model reasoning, web corroboration and evidence ingest need a connection and resume
          on reconnect.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-lg bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
      >
        Back to the console
      </Link>
    </main>
  )
}
