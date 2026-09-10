import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { RegisterForm } from '@/components/auth/RegisterForm'
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ register: vi.fn() }) }))
vi.mock('@/hooks/useSubscription', () => ({ usePlanMap: () => Object.fromEntries(['free', 'starter', 'pro', 'enterprise'].map(name => [name, { name, priceMonthly: 0, priceYearly: 0, maxActiveCampaigns: 1, platformFeePercent: 5 }])) }))
vi.mock('@/components/auth/OrganizationTypePicker', () => ({ OrganizationTypePicker: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => <input aria-label="Organization type" value={value} onChange={e => onChange(e.target.value)} /> }))
const mount = (role = '') => render(<ThemeProvider theme={ujimoraTheme}><MemoryRouter initialEntries={['/register' + role]}><RegisterForm /></MemoryRouter></ThemeProvider>)
const next = () => fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
const fill = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
describe('registration steps', () => {
  it('separates organization fields, validates only that step, and retains entries on Back', () => {
    mount('?role=organization'); next(); next()
    expect(screen.getByText('Organization name is required')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Contact name/)).not.toBeInTheDocument()
    fill(/Organization name/, 'Community Foundation'); fill(/Organization type/, 'ngo'); next()
    expect(screen.getByLabelText(/Contact name/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Organization name/)).not.toBeInTheDocument()
    next()
    expect(screen.getByText('Contact name is required')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByLabelText(/Organization name/)).toHaveValue('Community Foundation')
  })
  it('keeps personal registration at three steps', () => {
    mount(); next()
    fill(/Full name/, 'Test Person'); fill(/^Email/, 'test@example.com'); fill(/^Password/, 'securePassword1'); fill(/Confirm password/, 'securePassword1'); next()
    expect(screen.getByText('Choose a plan — you can change it anytime.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
  })
})
