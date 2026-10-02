import { memo } from 'react'
import { Alert, Box, Stack, Typography } from '@mui/material'
import { PublicationMediaPreview } from '@/components/PublicationMediaPreview'
import { formatMoney } from '@/lib/money'
import {
  ACTION_CAPTIONS,
  MEDIA_CAPTIONS,
  characterCount,
  formatValue,
  goalAboveLimit,
  mediaHeading,
  type ParsedFact,
  type ParsedSubmission,
  type ParsedText,
  type PublicationReviewItem,
  type RestEntry,
} from '@/lib/publicationReview'
import { formatDateTime, utcDayDiff } from '@/lib/reviewDates'
import { SLUG_CHANGED } from '@/lib/reviewGuidance'
import { EvidenceText, Fact, FactsGrid, FieldList, SectionHeading, ValueList, ValuesList, wellSurface } from './ReviewParts'

interface Props {
  item: PublicationReviewItem
  parsed: ParsedSubmission
  campaignReviewGoalGhs?: number
  /** When the page loaded: dates are described relative to it. */
  now: number
}

function endDateNote(iso: string | undefined, now: number): { text: string; color?: string } | null {
  const days = utcDayDiff(iso, now)
  if (days === null) return null
  if (days === 0) return { text: 'today · UTC date' }
  if (days > 0) return { text: `in ${days.toLocaleString('en-GH')} ${days === 1 ? 'day' : 'days'} · UTC date` }
  return { text: `passed ${(-days).toLocaleString('en-GH')} ${days === -1 ? 'day' : 'days'} ago · UTC date`, color: 'var(--text-warning)' }
}

function FactTile({ fact, now, campaignReviewGoalGhs }: { fact: ParsedFact; now: number; campaignReviewGoalGhs?: number }) {
  let note: { text: string; color?: string } | null = null
  if (fact.note === 'goalLimit' && fact.amount !== undefined && fact.currency && goalAboveLimit(fact.amount, fact.currency, campaignReviewGoalGhs)) {
    note = { text: `Above the ${formatMoney(campaignReviewGoalGhs ?? 0, 'GHS')} campaign-review limit`, color: 'var(--text-warning)' }
  } else if (fact.note === 'endDate') note = endDateNote(fact.iso, now)
  return <Fact label={fact.label} wide={fact.wide} muted={fact.muted} caption={fact.caption} note={note?.text} noteColor={note?.color}>
    {fact.values ? <ValueList values={fact.values} /> : fact.value}
  </Fact>
}

function TextSection({ text, level = 'h3' }: { text: ParsedText; level?: 'h3' | 'h4' }) {
  const detail = text.text ? `${characterCount(text.text)} characters` : undefined
  return <Box component="section" sx={{ minWidth: 0 }}>
    {level === 'h3' ? <SectionHeading detail={detail}>{text.label}</SectionHeading> : <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 1, mb: 1 }}>
      <Typography component="h4" variant="subtitle2" fontWeight={700}>{text.label}</Typography>
      {detail && <Typography variant="caption" color="text.secondary">{detail}</Typography>}
    </Box>}
    <EvidenceText text={text.text} expandNoun={text.expandNoun} empty={text.empty} />
  </Box>
}

/** Index-prefixed keys: an author can submit a key such as "onBehalf.reason" next to the nested one, and React must render both. */
function restEntries(entries: RestEntry[]) {
  return entries.map((entry, index) => ({ key: `${index}:${entry.key}`, label: entry.label, value: formatValue(entry.value, { key: entry.key.split('.').at(-1), siblings: entry.siblings }) }))
}

/** Facts that come from the review record rather than the submitted text. */
function recordFacts(item: PublicationReviewItem): ParsedFact[] {
  if (item.action === 'campaign.slug') {
    // The admin API always sends `author`; with it, a missing base version means the campaign had no custom address.
    const enriched = item.author !== undefined
    const facts: ParsedFact[] = []
    if (item.baseVersion) facts.push({ key: 'baseVersion', label: 'Address when proposed', value: `/c/${item.baseVersion}` })
    else if (enriched) facts.push({ key: 'baseVersion', label: 'Address when proposed', value: 'No custom address', muted: true })
    if (item.campaign) facts.push(item.campaign.slug ? { key: 'currentSlug', label: 'Current address', value: `/c/${item.campaign.slug}` } : { key: 'currentSlug', label: 'Current address', value: 'No custom address', muted: true })
    return facts
  }
  if (item.action === 'update.edit' && item.baseVersion) {
    return [{ key: 'baseVersion', label: 'Replaces the version saved', value: formatDateTime(item.baseVersion) ?? item.baseVersion }]
  }
  return []
}

/** campaign.slug: the campaign's address moved on since the proposal, so its approval cannot be used. */
function slugChanged(item: PublicationReviewItem): boolean {
  return item.action === 'campaign.slug' && item.author !== undefined && !!item.campaign && (item.baseVersion ?? '') !== (item.campaign.slug ?? '')
}

/**
 * Everything the author submitted, laid out for review. Author values render as
 * plain text only. No router links in here: the card adds those. Memoised: its
 * props do not change while the reviewer types notes.
 */
export const SubmissionView = memo(function SubmissionView({ item, parsed, campaignReviewGoalGhs, now }: Props) {
  const facts = [...parsed.facts, ...recordFacts(item)]
  const caption = ACTION_CAPTIONS[item.action]
  const mediaCaption = MEDIA_CAPTIONS[item.action]
  return <Stack spacing={2.5} sx={{ minWidth: 0 }}>
    {caption && <Typography variant="body2" color="text.secondary">{caption}</Typography>}

    {!!facts.length && <FactsGrid>{facts.map(fact => <FactTile key={fact.key} fact={fact} now={now} campaignReviewGoalGhs={campaignReviewGoalGhs} />)}</FactsGrid>}
    {slugChanged(item) && <Typography variant="body2" sx={{ color: 'var(--text-warning)', fontWeight: 600 }}>{SLUG_CHANGED}</Typography>}

    {parsed.kind === 'fields' && <Box component="section">
      <SectionHeading>Submitted fields</SectionHeading>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>This view has no layout for this content, so every field is listed as submitted.</Typography>
      <FieldList entries={restEntries(parsed.rest)} />
    </Box>}
    {parsed.kind === 'list' && <Box component="section">
      <SectionHeading>Submitted values</SectionHeading>
      <ValuesList values={(parsed.values ?? []).map((value, index) => formatValue(value, { key: index }))} />
    </Box>}
    {parsed.kind === 'plain' && <Box component="section">
      <SectionHeading detail={`${characterCount(item.text)} characters`}>Submitted text</SectionHeading>
      <EvidenceText text={item.text} />
    </Box>}

    {!!parsed.media.length && <Box component="section" sx={{ minWidth: 0 }}>
      <SectionHeading>{mediaHeading(item.action, parsed.media.length)}</SectionHeading>
      {mediaCaption && <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>{mediaCaption}</Typography>}
      <Alert severity="warning" role="note" sx={{ mb: 2 }}>Inspect each attachment through your approved moderation workflow. A URL or text check does not verify the actual media.</Alert>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
        {parsed.media.map((media, index) => <PublicationMediaPreview key={`${index}:${media.url}`} url={media.url} label={media.label} />)}
      </Box>
    </Box>}

    {parsed.letter !== undefined && <Box component="section" sx={{ minWidth: 0 }}>
      <SectionHeading detail="As donors will read it">Message</SectionHeading>
      <EvidenceText text={parsed.letter} expandNoun="message" />
    </Box>}
    {parsed.texts.map(text => <TextSection key={text.key} text={text} />)}

    {parsed.groups.map(group => <Box key={group.key} component="section" sx={{ minWidth: 0 }}>
      <SectionHeading>{group.label}</SectionHeading>
      {group.caption && <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>{group.caption}</Typography>}
      <Stack spacing={2}>
        {!!group.facts.length && <FactsGrid>{group.facts.map(fact => <FactTile key={fact.key} fact={fact} now={now} campaignReviewGoalGhs={campaignReviewGoalGhs} />)}</FactsGrid>}
        {group.texts.map(text => <TextSection key={text.key} text={text} level="h4" />)}
      </Stack>
    </Box>)}

    {parsed.kind === 'structured' && !!parsed.rest.length && <Box component="section" sx={{ minWidth: 0 }}>
      <SectionHeading>Other submitted fields</SectionHeading>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>Fields this view does not recognise, shown as submitted.</Typography>
      <FieldList entries={restEntries(parsed.rest)} />
    </Box>}
  </Stack>
})

/** Raw evidence for the "Submitted text" disclosure: ids, versions, media URLs and the exact text. */
export function SubmittedRecord({ item, boundTo }: { item: PublicationReviewItem; boundTo: string }) {
  const rows: [string, string][] = [['Action key', item.action], ['Author ID', item.actorId]]
  if (item.resourceId) rows.push(['Resource ID', item.resourceId])
  if (item.baseVersion) rows.push(['Base version', item.baseVersion])
  if (item.version) rows.push(['Content version', item.version])
  return <Stack spacing={1.5} sx={{ minWidth: 0 }}>
    <Typography variant="body2" color="text.secondary">{boundTo}</Typography>
    <Box component="dl" sx={{ m: 0, display: 'grid', gap: 1.25 }}>
      {rows.map(([label, value]) => <Box key={label} sx={{ minWidth: 0 }}>
        <Typography component="dt" sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{label}</Typography>
        <Typography component="dd" sx={{ m: 0, overflowWrap: 'anywhere', wordBreak: 'break-all' }}>{value}</Typography>
      </Box>)}
      <Box sx={{ minWidth: 0 }}>
        <Typography component="dt" sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Media, in order</Typography>
        <Box component="dd" sx={{ m: 0 }}>
          {item.mediaUrls?.length ? <Box component="ol" sx={{ m: 0, pl: 3 }}>{item.mediaUrls.map((url, index) => <li key={`${index}:${url}`}><Typography component="span" sx={{ overflowWrap: 'anywhere', wordBreak: 'break-all' }}>{url}</Typography></li>)}</Box> : <Typography color="text.secondary">None</Typography>}
        </Box>
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography component="dt" sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Text ({characterCount(item.text)} characters)</Typography>
        <Box component="dd" sx={{ m: 0, mt: 0.5 }}>
          <Box sx={{ ...wellSurface, p: { xs: 1.5, sm: 2 } }}>
            <Typography component="p" sx={{ m: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.6 }}>{item.text}</Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  </Stack>
}
