// Purely a display grouping for the permission checklist - which bucket a
// key's checkbox appears under. Nothing here changes what a permission
// does; that's entirely defined by has_permission() in the database. Any
// permission_keys row not listed below still renders, under "Other", so a
// future key never silently disappears from this screen.
//
// titleKey looks up dashboard.admin.roles.permissionGroups.<titleKey> -
// group titles are UI chrome, not database content, so they're translated
// like any other fixed set rather than read from a column.
//
// 'administration' is also where the roles screen lists the owner_only keys
// (as locked rows), so grantable and owner-only administration sit under one
// heading.
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
      // Next to cases_manage on purpose: can_assign_tasks() is also true
      // for cases_manage, so a role with that already assigns tasks.
      'tasks_assign',
    ],
  },
  {
    titleKey: 'scheduling',
    keys: ['appointments_view_all', 'court_dates_manage'],
  },
  {
    titleKey: 'billing',
    keys: ['fees_view', 'payments_record', 'expenses_manage', 'client_funds_access'],
  },
  {
    titleKey: 'frontOffice',
    keys: ['enquiries_manage'],
  },
  {
    titleKey: 'reporting',
    keys: ['reports_view'],
  },
  {
    titleKey: 'administration',
    keys: ['reference_data_manage'],
  },
]
