import { Children, cloneElement, forwardRef, isValidElement, type ReactNode, type ReactElement, useId } from 'react'
import { Box, Typography, type TextFieldProps, type MenuItemProps } from '@mui/material'
import MuiSelect, { type SelectProps, type BaseSelectProps } from '@mui/material/Select'
import { BrandedTextField } from '@ubuntu-fund/ui'
import TuneRounded from '@mui/icons-material/TuneRounded'
import ScheduleRounded from '@mui/icons-material/ScheduleRounded'
import FactCheckRounded from '@mui/icons-material/FactCheckRounded'
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded'
import CancelRounded from '@mui/icons-material/CancelRounded'
import EditNoteRounded from '@mui/icons-material/EditNoteRounded'
import PeopleRounded from '@mui/icons-material/PeopleRounded'
import BusinessRounded from '@mui/icons-material/BusinessRounded'
import ShieldRounded from '@mui/icons-material/ShieldRounded'
import PersonRounded from '@mui/icons-material/PersonRounded'
import BadgeRounded from '@mui/icons-material/BadgeRounded'
import HomeRounded from '@mui/icons-material/HomeRounded'
import CampaignRounded from '@mui/icons-material/CampaignRounded'
import ArticleRounded from '@mui/icons-material/ArticleRounded'
import VolunteerActivismRounded from '@mui/icons-material/VolunteerActivismRounded'
import SchoolRounded from '@mui/icons-material/SchoolRounded'
import LocalHospitalRounded from '@mui/icons-material/LocalHospitalRounded'
import WarningRounded from '@mui/icons-material/WarningRounded'
import PaletteRounded from '@mui/icons-material/PaletteRounded'
import HandshakeRounded from '@mui/icons-material/HandshakeRounded'
import BugReportRounded from '@mui/icons-material/BugReportRounded'
import WorkspacePremiumRounded from '@mui/icons-material/WorkspacePremiumRounded'
import PaymentsRounded from '@mui/icons-material/PaymentsRounded'
import ArchiveRounded from '@mui/icons-material/ArchiveRounded'
import LanguageRounded from '@mui/icons-material/LanguageRounded'
import VisibilityOffRounded from '@mui/icons-material/VisibilityOffRounded'
import ForumRounded from '@mui/icons-material/ForumRounded'
import CheckRounded from '@mui/icons-material/CheckRounded'
import { raisedSurface } from '@/lib/surfaces'

type Detail = [typeof TuneRounded, string]
const details: Record<string, Detail> = {
  pending: [ScheduleRounded, 'Awaiting a review decision.'], in_review: [FactCheckRounded, 'A reviewer is assessing the submitted information.'], under_review: [FactCheckRounded, 'Evidence is being assessed before a decision.'],
  approved: [CheckCircleRounded, 'The submitted request has been approved.'], rejected: [CancelRounded, 'The request did not meet the review requirements.'], expired: [ScheduleRounded, 'The validity period has ended.'],
  draft: [EditNoteRounded, 'Saved for editing and not yet published.'], pending_review: [FactCheckRounded, 'Submitted for staff review before publication.'], active: [CheckCircleRounded, 'Currently enabled and available for use.'], funded: [VolunteerActivismRounded, 'The campaign has reached its funding goal.'], blocked: [ShieldRounded, 'Restricted from normal activity.'],
  open: [ForumRounded, 'Awaiting investigation or a response.'], resolved: [CheckCircleRounded, 'The issue has been addressed and closed.'], dismissed: [CancelRounded, 'Closed without further action.'],
  cancelled: [CancelRounded, 'The subscription has been cancelled.'], past_due: [WarningRounded, 'A subscription payment is overdue.'], trialing: [ScheduleRounded, 'The account is in its trial period.'],
  new: [ForumRounded, 'Received and waiting for an initial response.'], in_progress: [FactCheckRounded, 'The team is working on this submission.'], archived: [ArchiveRounded, 'Kept for reference outside the active workflow.'], inactive: [VisibilityOffRounded, 'Disabled and unavailable for new use.'], published: [ArticleRounded, 'Visible to visitors on the public site.'], suspended: [ShieldRounded, 'Activity has been temporarily restricted.'],
  starter: [WorkspacePremiumRounded, 'Members on the Plus subscription tier.'],
  free: [PeopleRounded, 'Members on the Community subscription tier.'], plus: [WorkspacePremiumRounded, 'Members on the Plus subscription tier.'], pro: [WorkspacePremiumRounded, 'Members on the Pro subscription tier.'], enterprise: [BusinessRounded, 'Accounts on the Enterprise subscription tier.'],
  admin: [ShieldRounded, 'Staff accounts with administrative responsibilities.'], organization: [BusinessRounded, 'Accounts representing an organization.'], user: [PersonRounded, 'Individual member accounts.'],
  identity: [BadgeRounded, 'Documents that establish who the applicant is.'], address: [HomeRounded, 'Evidence of the applicant’s residential address.'], business: [BusinessRounded, 'Business registration or organization evidence.'], political: [CampaignRounded, 'Political affiliation or public-office verification.'], media: [ArticleRounded, 'Media affiliation or professional credentials.'],
  medical: [LocalHospitalRounded, 'Healthcare, treatment and medical support.'], education: [SchoolRounded, 'Learning, school fees and educational projects.'], emergency: [WarningRounded, 'Urgent relief and unexpected hardship.'], community: [PeopleRounded, 'Projects that benefit a shared community.'], religious: [VolunteerActivismRounded, 'Faith-based causes and community service.'], creative: [PaletteRounded, 'Arts, creative work and cultural projects.'],
  general: [ForumRounded, 'Questions and enquiries about Ujimora.'], partnership: [HandshakeRounded, 'Proposals to collaborate with the team.'], campaign: [CampaignRounded, 'Questions or support concerning a campaign.'], bug: [BugReportRounded, 'Problems with the website or application.'],
  'publication-reviews': [ArticleRounded, 'Review proposed public profiles and campaign content.'], 'tip-content-reviews': [ForumRounded, 'Review names and messages attached to supporter tips.'], 'donation-content-reviews': [VolunteerActivismRounded, 'Review names and messages attached to campaign donations.'],
  named: [PersonRounded, 'Contributions that display a supporter’s name.'], anonymous: [VisibilityOffRounded, 'Contributions with the supporter’s name hidden publicly.'],
  account: [PersonRounded, 'Make the response available in the member’s account.'], verified_external: [FactCheckRounded, 'Record delivery already completed through a verified external channel.'], responded: [CheckCircleRounded, 'A response has been provided to the requester.'],
  subscription: [WorkspacePremiumRounded, 'Discount eligible subscription purchases.'], donation: [VolunteerActivismRounded, 'Reduce the platform fee on eligible campaign donations.'], payout_fee: [PaymentsRounded, 'Reduce the platform fee on eligible withdrawals.'],
  percent: [PaymentsRounded, 'Reduce the eligible price by a percentage.'], fixed: [PaymentsRounded, 'Deduct a fixed amount from the eligible price.'], post_coupon: [PaymentsRounded, 'Calculate commission on the discounted amount paid.'], list_price: [PaymentsRounded, 'Calculate commission on the price before discounts.'], monthly: [ScheduleRounded, 'Applies to monthly billing.'], annual: [ScheduleRounded, 'Applies to annual billing.'], yearly: [ScheduleRounded, 'Applies to yearly billing.'],
  en: [LanguageRounded, 'English language preference.'], fr: [LanguageRounded, 'French language preference.'], sw: [LanguageRounded, 'Swahili language preference.'], ha: [LanguageRounded, 'Hausa language preference.'], yo: [LanguageRounded, 'Yoruba language preference.'], zu: [LanguageRounded, 'Zulu language preference.'],
}
const scoped: Record<string, Record<string, string>> = {
  campaign: { active: 'Published campaigns currently accepting support.', business: 'Entrepreneurship, livelihoods and business projects.', expired: 'The campaign’s fundraising period has ended.' },
  subscription: { active: 'Subscriptions within their active billing period.', organization: 'Accounts on the Organization subscription tier.', expired: 'The subscription’s paid access period has ended.' },
  coupon: { active: 'Enabled coupons; date and redemption limits still apply.', inactive: 'Disabled coupons that cannot be redeemed.', organization: 'Include the Organization subscription tier.' },
  privacy: { active: 'Requests that are open or being reviewed.' },
  affiliate: { active: 'Affiliates currently enabled to participate.', pending: 'Affiliate applications waiting for review.' },
}
function nodeText(node: ReactNode): string {
  return Children.toArray(node).map(child => {
    if (typeof child === 'string' || typeof child === 'number') return String(child)
    if (!isValidElement(child)) return ''
    const props = child.props as { primary?: ReactNode; children?: ReactNode }
    return nodeText(props.primary ?? props.children)
  }).join(' ').trim()
}
function choice(node: ReactNode, context: string) {
  if (!isValidElement(node)) return null
  const item = node as ReactElement<MenuItemProps & { value?: unknown }>
  if (item.props.value === undefined) return null
  const value = String(item.props.value)
  const raw = nodeText(item.props.children) || value
  const title = raw.replaceAll('_', ' ').replace(/^\w/, c => c.toUpperCase())
  const nested = Children.toArray(item.props.children).filter(isValidElement) as ReactElement<{ checked?: boolean; secondary?: ReactNode }>[]
  const existingDescription = nested.map(child => nodeText(child.props.secondary)).find(Boolean)
  const [Icon, fallback] = details[value] ?? [TuneRounded, `Use ${title.toLowerCase()} for this setting.`]
  const description = existingDescription || (value === 'all' ? 'Include every option in this filter.' : scoped[context]?.[value] ?? (/^\d+$/.test(value) ? context === 'pagination' ? `Show ${value} records on each page.` : context === 'crypto' ? `Include deposits pending for at least ${value} minutes.` : context === 'campaign-rule' ? 'Applies to new campaigns up to GHS 250,000; higher-goal review rules still apply.' : `Apply the ${title.toLowerCase()} review rule.` : fallback))
  return { item, value, title, description, Icon, checkbox: nested.find(child => child.props.checked !== undefined) }
}
function decorated(children: ReactNode, context: string, id: string) {
  return Children.toArray(children).map((node, index) => {
    const option = choice(node, context)
    if (!option) return node
    const { item, title, description, Icon, checkbox } = option
    const descriptionId = `${id}-choice-${index}`
    return cloneElement(item, { 'aria-label': title, 'aria-describedby': descriptionId, sx: [ ...(Array.isArray(item.props.sx) ? item.props.sx : [item.props.sx ?? {}]), { p: 1.5, my: .5, gap: 1.5, borderRadius: 2, whiteSpace: 'normal', textTransform: 'none', '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 }, '& .option-check': { visibility: 'hidden' }, '&.Mui-selected .option-check': { visibility: 'visible' } }], children: <>
      {checkbox}<Box aria-hidden sx={{ width: 38, height: 38, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 2, bgcolor: 'action.selected', color: 'primary.main' }}><Icon fontSize="small" /></Box>
      <Box sx={{ flex: 1, minWidth: 0 }}><Typography component="span" sx={{ display: 'block', fontWeight: 600, fontSize: '.9rem', color: 'text.primary' }}>{title}</Typography><Typography component="span" id={descriptionId} sx={{ display: 'block', fontSize: '.76rem', lineHeight: 1.45, color: 'text.secondary', mt: .3 }}>{description}</Typography></Box>
      {!checkbox && <CheckRounded className="option-check" aria-hidden sx={{ fontSize: 18, color: 'primary.main', flexShrink: 0 }} />}
    </> })
  })
}
function selected(children: ReactNode, value: unknown, context: string): ReactNode {
  const options = Children.toArray(children).map(node => choice(node, context)).filter(option => option !== null)
  if (Array.isArray(value)) return options.filter(option => value.map(String).includes(option.value)).map(option => option.title).join(', ')
  return options.find(option => option.value === String(value))?.title ?? ''
}
const menuProps: BaseSelectProps['MenuProps'] = { slotProps: { paper: { sx: { ...raisedSurface, width: 360, maxWidth: 'calc(100vw - 32px)', maxHeight: 'min(560px, calc(100vh - 48px))', p: .5 } }, list: { sx: { p: .5 } } } }

/** Admin choices retain real MenuItem values/events and a compact selected title. */
const AdminTextField = forwardRef<HTMLDivElement, TextFieldProps & { optionContext?: string }>(function AdminTextField({ optionContext = '', ...props }, ref) {
  const id = useId()
  if (!props.select) return <BrandedTextField {...props} ref={ref} />
  return <BrandedTextField {...props} ref={ref} sx={[...(Array.isArray(props.sx) ? props.sx : [props.sx ?? {}]), { '& .MuiSelect-select': { whiteSpace: 'normal', textOverflow: 'clip', overflow: 'visible', minHeight: '1.4em !important' } }]} slotProps={{ ...props.slotProps, select: state => {
    const slot = props.slotProps?.select
    const existing: Partial<BaseSelectProps> = { ...props.SelectProps, ...(typeof slot === 'function' ? slot(state) : slot) }
    return { ...existing, MenuProps: { ...menuProps, ...existing.MenuProps }, renderValue: existing.renderValue ?? (value => selected(props.children, value, optionContext) || props.placeholder || 'Select an option') }
  } }}>{decorated(props.children, optionContext, id)}</BrandedTextField>
})
export default AdminTextField

export function AdminSelect<Value = unknown>({ optionContext = '', ...props }: SelectProps<Value> & { optionContext?: string }) {
  const id = useId()
  return <MuiSelect {...props} sx={[...(Array.isArray(props.sx) ? props.sx : [props.sx ?? {}]), { '& .MuiSelect-select': { whiteSpace: 'normal', textOverflow: 'clip' } }]} MenuProps={{ ...menuProps, ...props.MenuProps }} renderValue={props.renderValue ?? (value => selected(props.children, value, optionContext))}>{decorated(props.children, optionContext, id)}</MuiSelect>
}
