import Link from 'next/link'
import { logout } from '../actions'

export default function StaffDashboardPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 dark:bg-black">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        Staff dashboard
      </h1>
      <Link
        href="/dashboard/cases"
        className="text-sm font-medium text-black underline underline-offset-4 dark:text-zinc-50"
      >
        Cases
      </Link>
      <Link
        href="/dashboard/appointments"
        className="text-sm font-medium text-black underline underline-offset-4 dark:text-zinc-50"
      >
        Appointments
      </Link>
      <form action={logout}>
        <button
          type="submit"
          className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Log out
        </button>
      </form>
    </div>
  )
}
