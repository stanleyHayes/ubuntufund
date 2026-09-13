import { useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
export function OtpInput({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  function insert(index: number, text: string) {
    const digits = text.replace(/\D/g, '')
    if (!digits) { onChange(value.slice(0, index)); return }
    const next = (value.slice(0, index) + digits + value.slice(index + digits.length)).slice(0, 6)
    onChange(next)
    inputs.current[Math.min(index + digits.length, 5)]?.focus()
  }
  return <Box><Typography variant="body2" sx={{ mb: 1 }}>Authenticator code</Typography>
    <Box role="group" aria-label="Six-digit authenticator code" sx={{ display: 'flex', gap: 1, maxWidth: 340 }}>
      {Array.from({ length: 6 }, (_, index) => <Box component="input" key={index} ref={(input: HTMLInputElement | null) => { inputs.current[index] = input }}
        aria-label={`Digit ${index + 1}`} inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'}
        value={value[index] ?? ''} disabled={disabled} onChange={event => insert(index, event.target.value)}
        onPaste={event => { event.preventDefault(); insert(index, event.clipboardData.getData('text')) }}
        onKeyDown={event => { if (event.key === 'Backspace' && !value[index] && index > 0) { event.preventDefault(); onChange(value.slice(0, index - 1)); inputs.current[index - 1]?.focus() } }}
        sx={{ width: 0, flex: 1, minWidth: 0, height: 48, borderRadius: 1.5, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', color: 'text.primary', textAlign: 'center', font: 'inherit', fontSize: '1.3rem', '&:focus': { outline: '2px solid', outlineColor: 'primary.main' } }} />)}
    </Box></Box>
}
