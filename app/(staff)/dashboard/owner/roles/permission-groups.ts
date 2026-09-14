// Purely a display grouping for the permission checklist - which bucket a
// key's checkbox appears under. Nothing here changes what a permission
// does; that's entirely defined by has_permission() in the database. Any
// permission_keys row not listed below still renders, under "Other", so a
// future key never silently disappears from this screen.
export const PERMISSION_GROUPS: { title: string; keys: string[] }[] = [
  {
    title: 'Clients & Cases',
    keys: ['clients_manage', 'cases_manage', 'case_notes_access', 'documents_access'],
  },
  {
    title: 'Scheduling',
    keys: ['appointments_view_all', 'court_dates_manage'],
  },
  {
    title: 'Billing',
    keys: ['fees_view', 'payments_record', 'expenses_manage'],
  },
  {
    title: 'Front Office',
    keys: ['enquiries_manage', 'public_content_manage'],
  },
  {
    title: 'Reporting',
    keys: ['reports_view'],
  },
]
