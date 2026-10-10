import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { ClientForm } from '../client-form'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { BalanceSection } from './balance-section'
import { PowerOfAttorneySection, type Poa } from './power-of-attorney-section'
import { ClientFundsSection, type FundBalance, type FundEntry } from './client-funds-section'
import { ContactLogSection } from '../contact-log-section'
import { ACTIVE_REFERRAL_SOURCES_SELECT, referralSourceOptions } from '../referral-source-options'
import { CONTACT_LOG_SELECT, toContactRow, type ContactQueryRow } from '../contact-log-query'
import { dashboardTitle } from '@/lib/page-title'

export default async function EditClientPage({ params }: PageProps<'/dashboard/clients/[id]'>) {
  const { id } = await params
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.clients.detail.page' })
  const tCommon = await getTranslations({ locale, namespace: 'dashboard.common' })

  const [
    { data: client },
    { data: balance },
    { data: canManage },
    { data: canViewClient },
    { data: canManagePoa },
    { data: poaRows },
    { data: cases },
    { data: activeStaff },
    { data: allStaff },
    { data: canAccessFunds },
    { data: contactRows },
    { data: claimsData },
    { data: activeSources },
  ] = await Promise.all([
    // The client's own source is embedded whatever its is_active, so a
    // client pointing at a since-deactivated source still shows it.
    supabase
      .from('clients')
      .select(
        'id, full_name, national_id, phone, email, notes, referral_source_id, referral_notes, referral_sources(id, name_en, name_ar, is_active)'
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('client_balances')
      .select(
        'agreed_fixed_fee_total, percentage_engagement_count, scheduled_total, paid_total, scheduled_outstanding, written_off_total'
      )
      .eq('client_id', id)
      .maybeSingle(),
    // Read is broader than write - a Lawyer can reach this page for a
    // client on their own case without clients_manage. Asked once here,
    // never OR'd with is_owner() (has_permission already covers the owner).
    supabase.rpc('has_permission', { p_key: 'clients_manage' }),
    // Both STABLE, both already true for the owner internally - resolved
    // once here, never OR'd with isOwner, same reasoning as
    // can_manage_case_details on the case detail page.
    supabase.rpc('can_view_client', { p_client_id: id }),
    supabase.rpc('can_manage_power_of_attorney', { p_client_id: id }),
    supabase
      .from('powers_of_attorney')
      .select(
        'id, case_id, poa_number, issued_at, expires_at, scope, registered_at_office, notes, is_revoked, revoked_at, cases(case_number, title), power_of_attorney_lawyers(staff_id)'
      )
      .eq('client_id', id)
      .order('issued_at', { ascending: false, nullsFirst: false }),
    supabase.from('cases').select('id, case_number, title').eq('client_id', id).order('case_number'),
    supabase.from('staff_directory').select('id, full_name').eq('is_active', true).order('full_name'),
    // Unfiltered - a lawyer named on a وكالة should still show their name
    // after they've left the firm, same reasoning as the case timeline's
    // allStaffDirectory.
    supabase.from('staff_directory').select('id, full_name'),
    // Owner, or a role holding client_funds_access - already covers the
    // owner internally, never OR'd with isOwner.
    supabase.rpc('can_access_client_funds'),
    // Soft-deleted entries are still readable under RLS (deliberately, as
    // with case_notes), so the deleted_at filter belongs here in the query.
    supabase
      .from('client_contacts')
      .select(CONTACT_LOG_SELECT)
      .eq('client_id', id)
      .is('deleted_at', null)
      .order('occurred_at', { ascending: false })
      .order('created_at', { ascending: false })
      .returns<ContactQueryRow[]>(),
    supabase.auth.getClaims(),
    supabase
      .from('referral_sources')
      .select(ACTIVE_REFERRAL_SOURCES_SELECT)
      .eq('is_active', true)
      .order('sort_order', { nullsFirst: false })
      .order('name_en', { nullsFirst: false })
      .order('name_ar'),
  ])

  // Not fetched at all unless the gate passes - someone without access
  // should not be able to tell from this page's own requests that the firm
  // holds money for this client, not just see it hidden in the markup.
  const [{ data: fundBalanceRow }, { data: fundEntryRows }] =
    canAccessFunds === true
      ? await Promise.all([
          supabase
            .from('client_fund_balances')
            .select('balance_held, total_in, total_out, last_movement_on, entry_count')
            .eq('client_id', id)
            .maybeSingle(),
          supabase
            .from('client_fund_entries')
            .select(
              'id, entry_type, direction, amount, occurred_on, method, reference, description, case_id, reverses_entry_id, cases(case_number, title)'
            )
            .eq('client_id', id)
            .order('occurred_on', { ascending: false }),
        ])
      : [{ data: null }, { data: null }]

  const allNameById = new Map(
    (allStaff ?? [])
      .filter((s): s is { id: string; full_name: string } => s.id !== null && s.full_name !== null)
      .map((s) => [s.id, s.full_name])
  )
  const activeStaffOptions = (activeStaff ?? []).filter(
    (s): s is { id: string; full_name: string } => s.id !== null && s.full_name !== null
  )

  const poas: Poa[] = (poaRows ?? []).map((p) => ({
    id: p.id,
    case_id: p.case_id,
    case_number: p.cases?.case_number ?? null,
    case_title: p.cases?.title ?? null,
    poa_number: p.poa_number,
    issued_at: p.issued_at,
    expires_at: p.expires_at,
    scope: p.scope,
    registered_at_office: p.registered_at_office,
    notes: p.notes,
    is_revoked: p.is_revoked,
    revoked_at: p.revoked_at,
    lawyers: (p.power_of_attorney_lawyers ?? []).map((l) => ({
      staff_id: l.staff_id,
      full_name: allNameById.get(l.staff_id) ?? tCommon('unknownStaff'),
    })),
  }))

  const entryById = new Map((fundEntryRows ?? []).map((e) => [e.id, e]))
  const reversedByEntryId = new Map(
    (fundEntryRows ?? [])
      .filter((e) => e.reverses_entry_id !== null)
      .map((e) => [e.reverses_entry_id as string, e])
  )
  const fundEntries: FundEntry[] = (fundEntryRows ?? []).map((e) => {
    const reverses = e.reverses_entry_id ? entryById.get(e.reverses_entry_id) ?? null : null
    const reversedBy = reversedByEntryId.get(e.id) ?? null
    return {
      id: e.id,
      entry_type: e.entry_type,
      direction: e.direction,
      amount: e.amount,
      occurred_on: e.occurred_on,
      method: e.method,
      reference: e.reference,
      description: e.description,
      case_id: e.case_id,
      case_number: e.cases?.case_number ?? null,
      case_title: e.cases?.title ?? null,
      reverses_entry_id: e.reverses_entry_id,
      reverses: reverses ? { id: reverses.id, occurred_on: reverses.occurred_on, amount: reverses.amount } : null,
      reversed_by: reversedBy ? { id: reversedBy.id, occurred_on: reversedBy.occurred_on, amount: reversedBy.amount } : null,
    }
  })

  const fundBalance: FundBalance | null = fundBalanceRow ?? null

  const contacts = (contactRows ?? []).map((c) => toContactRow(c, allNameById, tCommon('unknownStaff')))

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <BackLink href="/dashboard/clients" label={t('backToClients')} />
        <PageHeader title={client ? client.full_name : t('clientNotFound')} />
      </div>

      {client ? (
        <>
          <ClientForm
            mode="edit"
            client={client}
            canManage={canManage === true}
            referralSources={referralSourceOptions(activeSources ?? [], client.referral_sources, locale)}
          />
          <BalanceSection balance={balance} />
          {canAccessFunds === true && (
            <ClientFundsSection clientId={client.id} balance={fundBalance} entries={fundEntries} cases={cases ?? []} />
          )}
          <PowerOfAttorneySection
            clientId={client.id}
            poas={poas}
            cases={cases ?? []}
            staffOptions={activeStaffOptions}
            canView={canViewClient === true}
            canManage={canManagePoa === true}
          />
          {/* canAdd is can_view_client() - the insert policy's own test.
              Pre-fills "handled by" with whoever is logging the contact. */}
          <ContactLogSection
            clientId={client.id}
            contacts={contacts}
            cases={cases ?? []}
            staffOptions={activeStaffOptions}
            canAdd={canViewClient === true}
            defaultCaseId={null}
            defaultHandledBy={(claimsData?.claims?.sub as string | undefined) ?? null}
            showCase
            testId="client-contacts-section"
          />
        </>
      ) : (
        <p className="text-sm text-fg-muted">{t('clientNotFoundDescription')}</p>
      )}
    </div>
  )
}

export const generateMetadata = () => dashboardTitle('client')
