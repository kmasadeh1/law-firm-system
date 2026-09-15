import { BackLink } from '../../back-link'
import { CaseForm } from './case-form'

export default function NewCasePage() {
  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 dark:bg-black sm:px-8">
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <div>
          <BackLink />
          <h1 className="mt-1 text-2xl font-semibold text-black dark:text-zinc-50">New case</h1>
        </div>

        <CaseForm />
      </div>
    </div>
  )
}
