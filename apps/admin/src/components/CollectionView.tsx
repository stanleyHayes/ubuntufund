import { useState } from 'react'
import type { ReactNode } from 'react'
import { Box, ToggleButton, ToggleButtonGroup, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded'
import TableRowsRoundedIcon from '@mui/icons-material/TableRowsRounded'
import { raisedSurface } from '@/lib/surfaces'

export function useCollectionView(collection: string) {
  const key = `uf_admin_${collection}_view`
  const [view, setView] = useState<'cards' | 'table'>(() => {
    try { return localStorage.getItem(key) === 'table' ? 'table' : 'cards' } catch { return 'cards' }
  })
  const changeView = (next: 'cards' | 'table') => {
    setView(next)
    try { localStorage.setItem(key, next) } catch { /* Selection still works without storage. */ }
  }
  return { view, changeView }
}

export function CollectionViewSwitch({ view, onChange }: { view: 'cards' | 'table'; onChange: (view: 'cards' | 'table') => void }) {
  return <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
    <ToggleButtonGroup exclusive value={view} onChange={(_, value) => { if (value) onChange(value) }} aria-label="Display layout" size="small" sx={{ ...raisedSurface, border: 'var(--neu-border)', p: 0.5 }}>
      <ToggleButton value="cards" aria-label="Card view" sx={{ gap: 1, color: 'text.primary', '&.Mui-selected': { color: 'primary.main', boxShadow: 'var(--neu-inset)' } }}><GridViewRoundedIcon fontSize="small" />Cards</ToggleButton>
      <ToggleButton value="table" aria-label="Table view" sx={{ gap: 1, color: 'text.primary', '&.Mui-selected': { color: 'primary.main', boxShadow: 'var(--neu-inset)' } }}><TableRowsRoundedIcon fontSize="small" />Table</ToggleButton>
    </ToggleButtonGroup>
  </Box>
}

export function CollectionTable({ label, columns, rows }: { label: string; columns: string[]; rows: { id: string; cells: ReactNode[] }[] }) {
  return <TableContainer tabIndex={0} role="region" aria-label={`${label} table scroll area`} sx={{ ...raisedSurface, border: 'var(--neu-border)', backdropFilter: 'var(--neu-backdrop)', overflowX: 'auto' }}>
    <Table aria-label={label} sx={{ minWidth: 680, '& td .MuiButton-root': { p: 0, minWidth: 0, minHeight: 32 }, '& th': { color: 'text.secondary', fontWeight: 700 }, '& td, & th': { borderBottom: '1px solid', borderColor: 'divider', py: 1.25 } }}>
      <TableHead><TableRow>{columns.map(column => <TableCell key={column} scope="col">{column}</TableCell>)}</TableRow></TableHead>
      <TableBody>{rows.map(row => <TableRow key={row.id} hover>{row.cells.map((cell, i) => <TableCell key={columns[i]}>{cell}</TableCell>)}</TableRow>)}</TableBody>
    </Table>
  </TableContainer>
}
