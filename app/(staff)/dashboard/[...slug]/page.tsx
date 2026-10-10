import { notFound } from 'next/navigation'

// Catch-all so a /dashboard/<anything> URL with no route of its own reaches
// the dashboard's not-found.tsx - rendered inside the dashboard layout, with
// navigation - instead of the framework's bare 404.
export default function DashboardUnknownRoute() {
  notFound()
}
