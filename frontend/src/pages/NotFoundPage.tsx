import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="min-h-svh flex flex-col items-center justify-center gap-4 text-center p-6">
      <h1 className="text-3xl font-medium text-foreground">404 — Page not found</h1>
      <Link to="/" className="text-primary hover:underline">Go to dashboard</Link>
    </main>
  )
}
