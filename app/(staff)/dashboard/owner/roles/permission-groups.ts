// Purely a display grouping for the permission checklist - which bucket a
// key's checkbox appears under. Nothing here changes what a permission
// does; that's entirely defined by has_permission() in the database. Any
// permission_keys row not listed below still renders, under "Other", so a
// future key never silently disappears from this screen.
//
// titleKey looks up dashboard.admin.roles.permissionGroups.<titleKey> -
// group titles are UI chrome, not database content, so they're translated
// like any other fixed set rather than read from a column.
export const PERMISSION_GROUPS: { titleKey: string; keys: string[] }[] = [
  {
    titleKey: 'clientsCases',
    keys: [
      'clients_manage',
      'cases_manage',
      'cases_view_all',
      'case_notes_access',
      'case_notes_view_all',
      'documents_access',
      'documents_view_all',
    ],
  },
  {
    titleKey: 'scheduling',
    keys: ['appointments_view_all', 'court_dates_manage'],
  },
  {
    titleKey: 'billing',
    keys: ['fees_view', 'payments_record', 'expenses_manage'],
  },
  {
    titleKey: 'frontOffice',
    keys: ['enquiries_manage'],
  },
  {
    titleKey: 'reporting',
    keys: ['reports_view'],
  },
]
