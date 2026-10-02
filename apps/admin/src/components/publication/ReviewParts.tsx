import { Fragment, isValidElement, useId, useState, type ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, Button, Link, Typography } from '@mui/material'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded'
import { insetSurface } from '@/lib/surfaces'
import { characterCount, type FormattedEntry, type FormattedValue } from '@/lib/publicationReview'

/**
 * Inset evidence surface: everything the author wrote sits in one of these.
 * The border is the hairline the minimal and glass skins need (0px in
 * neumorphism and clay). No backdrop: tiles sit inside the frosted card.
 */
export const wellSurface = { ...insetSurface, border: 'var(--neu-border)' } as const

/** Small uppercase kicker, as in the campaign panels. */
export const labelSx = {
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  color: 'text.secondary',
  letterSpacing: 1,
  fontFamily: '"Outfit", sans-serif',
} as const

const termSx = { fontSize: '0.72rem', color: 'text.secondary', mb: 0.75 } as const
/** Author values: plain text that keeps its line breaks and never overflows. */
const plainTextSx = { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } as const

export function SectionHeading({ children, detail }: { children: ReactNode; detail?: ReactNode }) {
  return <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 1, rowGap: 0.25, mb: 1.25 }}>
    <Typography component="h3" variant="subtitle1" fontWeight={700}>{children}</Typography>
    {detail && <Typography variant="caption" color="text.secondary">{detail}</Typography>}
  </Box>
}

/** A grid of facts: one column on phones, two on tablets, four on wide screens. */
export function FactsGrid({ children, columns = 4 }: { children: ReactNode; columns?: 2 | 4 }) {
  return <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', ...(columns === 4 ? { lg: 'repeat(4, minmax(0, 1fr))' } : {}) }, gap: 2, m: 0 }}>{children}</Box>
}

export function Fact({ label, children, note, noteColor = 'text.secondary', caption, wide, muted }: { label: string; children: ReactNode; note?: string; noteColor?: string; caption?: string; wide?: boolean; muted?: boolean }) {
  return <Box sx={{ ...wellSurface, p: 2, minWidth: 0, ...(wide ? { gridColumn: '1 / -1' } : {}) }}>
    <Typography component="dt" sx={termSx}>{label}</Typography>
    <Typography component="dd" sx={{ ...plainTextSx, m: 0, fontSize: '.95rem', fontWeight: 600, color: muted ? 'text.secondary' : 'text.primary' }}>{children}</Typography>
    {caption && <Typography component="dd" variant="caption" sx={{ ...plainTextSx, display: 'block', m: 0, mt: 0.5, color: 'text.secondary' }}>{caption}</Typography>}
    {note && <Typography component="dd" variant="body2" sx={{ m: 0, mt: 0.75, color: noteColor, fontWeight: 600 }}>{note}</Typography>}
  </Box>
}

/** One exact string per line, for lists such as beneficiaries. */
export function ValueList({ values }: { values: string[] }) {
  return <Box component="ul" sx={{ m: 0, pl: 2.5, '& > li + li': { mt: 0.5 } }}>
    {values.map((value, index) => <li key={index}>{value}</li>)}
  </Box>
}

const CLAMP_CHARS = 1500
const CLAMP_LINES = 20

/**
 * Author text in an inset tile, exactly as written: one text node, line breaks
 * and runs of spaces kept. Long text is clamped behind an expander, but the
 * full text always stays in the page.
 */
export function EvidenceText({ text, expandNoun = 'text', empty }: { text: string; expandNoun?: string; empty?: string }) {
  const id = useId()
  const [expanded, setExpanded] = useState(false)
  const clamp = text.length > CLAMP_CHARS || text.split('\n').length > CLAMP_LINES
  const clamped = clamp && !expanded
  return <Box sx={{ minWidth: 0 }}>
    <Box sx={{ ...wellSurface, p: { xs: 1.5, sm: 2 } }}>
      <Typography
        id={id}
        component="p"
        sx={{
          ...plainTextSx,
          m: 0,
          lineHeight: 1.65,
          maxWidth: '72ch',
          color: text ? 'text.primary' : 'text.secondary',
          ...(clamped ? { maxHeight: '24em', overflow: 'hidden', maskImage: 'linear-gradient(180deg, #000 75%, transparent)', WebkitMaskImage: 'linear-gradient(180deg, #000 75%, transparent)' } : {}),
        }}
      >{text || empty || '(empty)'}</Typography>
    </Box>
    {clamp && <Button size="small" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)} startIcon={expanded ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />} sx={{ mt: 1 }}>
      {expanded ? 'Show less' : `Show full ${expandNoun} (${characterCount(text)} characters)`}
    </Button>}
  </Box>
}

function ValueView({ value }: { value: FormattedValue }) {
  switch (value.kind) {
    case 'text':
      return <Typography component="span" sx={{ ...plainTextSx, display: 'block', fontSize: '.95rem', fontWeight: 600, color: value.muted ? 'text.secondary' : 'text.primary' }}>{value.text}</Typography>
    case 'long':
    case 'json':
      return <Typography component="span" sx={{ ...plainTextSx, display: 'block', fontSize: '.92rem', lineHeight: 1.6 }}>{value.text}</Typography>
    case 'items':
      return <Box component="ul" sx={{ m: 0, pl: 2.5 }}>{value.items.map((item, index) => <li key={index}><ValueView value={item} /></li>)}</Box>
    case 'fields':
      return <NestedFields entries={value.entries} />
  }
}

function NestedFields({ entries }: { entries: FormattedEntry[] }) {
  return <Box component="dl" sx={{ m: 0, pl: 1.5, borderLeft: '2px solid', borderColor: 'divider', display: 'grid', gap: 1 }}>
    {entries.map(entry => <Box key={entry.key} sx={{ minWidth: 0 }}>
      <Typography component="dt" sx={{ ...termSx, mb: 0.25 }}>{entry.label}</Typography>
      <Box component="dd" sx={{ m: 0 }}><ValueView value={entry.value} /></Box>
    </Box>)}
  </Box>
}

/** Every entry of an object, labelled and formatted; nothing is left out. */
export function FieldList({ entries }: { entries: FormattedEntry[] }) {
  return <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5, m: 0 }}>
    {entries.map(entry => <Box key={entry.key} sx={{ ...wellSurface, p: 1.5, minWidth: 0, ...(entry.value.kind === 'text' ? {} : { gridColumn: '1 / -1' }) }}>
      <Typography component="dt" sx={termSx}>{entry.label}</Typography>
      <Box component="dd" sx={{ m: 0 }}><ValueView value={entry.value} /></Box>
    </Box>)}
  </Box>
}

/** An ordered list of submitted values, for arrays this view has no layout for. */
export function ValuesList({ values }: { values: FormattedValue[] }) {
  return <Box component="ol" sx={{ ...wellSurface, m: 0, py: 1.5, pr: 1.5, pl: 4, display: 'grid', gap: 0.75 }}>
    {values.map((value, index) => <li key={index}><ValueView value={value} /></li>)}
  </Box>
}

/**
 * A show/hide section. Hidden content is not rendered at all, so raw values are
 * not in the page until the reviewer asks for them.
 */
export function Disclosure({ showLabel, hideLabel, children }: { showLabel: string; hideLabel: string; children: ReactNode }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  return <Box>
    <Button size="small" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)} startIcon={open ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}>
      {open ? hideLabel : showLabel}
    </Button>
    <Box id={id} hidden={!open} sx={{ mt: 1 }}>{open && children}</Box>
  </Box>
}

/** Explicit embedding, override and isolate controls (U+202A–U+202E, U+2066–U+2069). */
const DIRECTION_CONTROLS = /[\u202A-\u202E\u2066-\u2069]/

/** The text of a value: a string, a link around one, or parts such as "/c/" and a slug. */
function nodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children)
  return ''
}

/**
 * An author-controlled value (an account, organization, campaign or page name)
 * inside a line of system text, isolated so its text direction cannot reorder
 * the labels around it. A <bdi> does that for ordinary text and still wraps
 * with the line. A value holding direction controls is also laid out as an
 * inline block, whose text is ordered on its own: an unmatched U+2069 (or an
 * isolate left open) ends a plain <bdi>'s isolation early in Chromium. Only
 * then, because an inline block that does not fit moves to a line of its own,
 * stranding the quotes or separators beside it.
 */
export function Isolated({ children }: { children: ReactNode }) {
  const contained = DIRECTION_CONTROLS.test(nodeText(children))
  return <Box component="bdi" sx={contained ? { display: 'inline-block', maxWidth: '100%' } : undefined}>{children}</Box>
}

/** One "who or what" tile in a card's context strip. `primary` is a name, shown isolated; `suffix` is system text after it. */
export function ContextItem({ icon, label, primary, suffix, secondary, to }: { icon: ReactNode; label: string; primary: string; suffix?: string; secondary?: ReactNode; to?: string }) {
  return <Box sx={{ ...wellSurface, p: 1.5, minWidth: 0 }}>
    <Typography component="dt" sx={{ ...termSx, display: 'flex', alignItems: 'center', gap: 1, '& svg': { fontSize: 20 } }}>
      <Box component="span" aria-hidden sx={{ display: 'inline-flex', color: 'text.secondary' }}>{icon}</Box>
      {label}
    </Typography>
    <Box component="dd" sx={{ m: 0, pl: '28px', minWidth: 0 }}>
      {/* The link sits inside the isolated block so its underline still reaches the name. */}
      <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}><Isolated>{to ? <Link component={RouterLink} to={to}>{primary}</Link> : primary}</Isolated>{suffix}</Typography>
      {secondary && <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{secondary}</Typography>}
    </Box>
  </Box>
}

/** Parts of one line joined with " · ", for lines that mix system labels with isolated names. */
export function joinParts(parts: ReactNode[]): ReactNode {
  return parts.filter(part => part !== undefined && part !== null && part !== false && part !== '').map((part, index) => <Fragment key={index}>{index > 0 && ' · '}{part}</Fragment>)
}
