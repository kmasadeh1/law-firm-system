import { ClientForm } from '../client-form'
import { BackLink } from '../back-link'

export default function NewClientPage() {
  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 dark:bg-black sm:px-8">
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <div>
          <BackLink />
          <h1 className="mt-1 text-2xl font-semibold text-black dark:text-zinc-50">
            Add client
          </h1>
        </div>

        <ClientForm mode="create" />
      </div>
    </div>
  )
}
