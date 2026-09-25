import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { RegisterForm } from '@/components/auth/RegisterForm'
const mocks = vi.hoisted(() => ({ register: vi.fn().mockResolvedValue(undefined), checkout: vi.fn(), navigate: vi.fn() }))
vi.mock('react-router-dom', async importOriginal => ({ ...await importOriginal<typeof import('react-router-dom')>(), useNavigate: () => mocks.navigate }))
vi.mock('@/lib/subscriptions', () => ({ createSubscriptionCheckout: mocks.checkout, saveSubscriptionCheckoutHandoff: vi.fn() }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ register: mocks.register }) }))
const prices: Record<string, [number, number]> = { free: [0, 0], starter: [49, 0], pro: [149, 1490], enterprise: [99.99, 999] }
vi.mock('@/hooks/useSubscription', () => ({ useSignupPlans: () => ({ plans: Object.fromEntries(['free', 'starter', 'pro', 'enterprise'].map(name => [name, { name, priceMonthly: prices[name][0], priceYearly: prices[name][1], maxActiveCampaigns: 1, platformFeePercent: 5 }])), error: false, retry: vi.fn() }) }))
vi.mock('@/components/auth/OrganizationTypePicker', () => ({ OrganizationTypePicker: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => <input aria-label="Organization type" value={value} onChange={e => onChange(e.target.value)} /> }))
const mount = (role = '') => render(<ThemeProvider theme={ujimoraTheme}><MemoryRouter initialEntries={['/register' + role]}><RegisterForm /></MemoryRouter></ThemeProvider>)
const next = () => {
  for (const name of [/I agree to the Terms/, /I confirm that I am at least/]) {
    const field = screen.queryByRole('checkbox', { name })
    if (field && !(field as HTMLInputElement).checked) fireEvent.click(field)
  }
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
}
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
  it('keeps yearly selection when checkout initialization fails after signup', async () => {
    mocks.checkout.mockRejectedValue(new Error('Provider unavailable'))
    mount(); next()
    fill(/Full name/, 'Test Person'); fill(/^Email/, 'test@example.com'); fill(/^Password/, 'securePassword1'); fill(/Confirm password/, 'securePassword1'); next()
    fireEvent.click(screen.getByRole('button', { name: 'Yearly · save' }))
    fireEvent.click(screen.getByRole('button', { name: /^pro/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Create account & continue' }))
    await vi.waitFor(() => expect(mocks.checkout).toHaveBeenCalledWith({ tier: 'pro', billingCycle: 'yearly' }))
    expect(mocks.register).toHaveBeenCalledTimes(1)
    expect(mocks.navigate).toHaveBeenCalledWith('/subscription?tier=pro&billingCycle=yearly&checkoutError=1')
  })

  it('never offers the sales-led Enterprise plan or a paid cycle without a price', () => {
    mount(); next()
    fill(/Full name/, 'Test Person'); fill(/^Email/, 'test@example.com'); fill(/^Password/, 'securePassword1'); fill(/Confirm password/, 'securePassword1'); next()
    expect(screen.queryByRole('button', { name: /enterprise/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^starter/ })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Yearly · save' }))
    const starter = screen.getByRole('button', { name: /^starter/ })
    expect(starter).toBeDisabled()
    expect(starter).toHaveTextContent('Not offered')
  })

  it('offers an unchecked website request only while the organization website is blank', () => {
    mount('?role=organization'); next()
    const checkbox = screen.getByRole('checkbox', { name: 'Does your organization need a website?' })
    expect(checkbox).not.toBeChecked()
    fireEvent.click(checkbox)
    expect(checkbox).toBeChecked()
    fill(/Website \(optional\)/, 'https://example.com')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    fill(/Website \(optional\)/, '   ')
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('attaches the website request to organization signup', async () => {
    mocks.register.mockClear()
    mount('?role=organization'); next()
    fill(/Organization name/, 'Community Foundation'); fill(/Organization type/, 'ngo')
    fireEvent.click(screen.getByRole('checkbox'))
    next()
    fill(/Contact name/, 'Contact Person'); fill(/^Email/, 'contact@example.com'); fill(/^Password/, 'securePassword1'); fill(/Confirm password/, 'securePassword1'); next()
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    await vi.waitFor(() => expect(mocks.register).toHaveBeenCalledWith(expect.objectContaining({ role: 'organization', needsWebsite: true, website: undefined })))
  })

})

it('requires explicit terms and age confirmation before continuing signup', () => {
  mount(); next()
  fill(/Full name/, 'Test Person'); fill(/^Email/, 'test@example.com'); fill(/^Password/, 'securePassword1'); fill(/Confirm password/, 'securePassword1')
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Accept the terms and confirm you are at least 18')
  expect(screen.getByRole('checkbox', { name: /I agree to the Terms/ })).not.toBeChecked()
  expect(screen.getByRole('checkbox', { name: /I confirm that I am at least/ })).not.toBeChecked()
})
