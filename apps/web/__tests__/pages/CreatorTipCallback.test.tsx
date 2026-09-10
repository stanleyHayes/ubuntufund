import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CreatorTipCallbackPage } from '@/pages/CreatorTipCallbackPage'
import { api } from '@/lib/api'
vi.mock('@/lib/api',()=>({api:{post:vi.fn()}}))
vi.mock('@/components/donate/DonationCelebration',()=>({DonationCelebration:()=> <div>Celebration particles</div>}))
afterEach(()=>vi.resetAllMocks())
function mount(url='/tip/callback?reference=tip-fixture123') {render(<MemoryRouter initialEntries={[url]}><CreatorTipCallbackPage/></MemoryRouter>)}
describe('creator tip return',()=>{
 it('confirms guest support and links back to the creator',async()=>{vi.mocked(api.post).mockResolvedValue({status:'SUCCEEDED',amount:25,currency:'GHS',displayName:'Stanley',handle:'pontifex'});mount();expect(await screen.findByText('Thank you for your support!')).toBeInTheDocument();expect(screen.getByText('Celebration particles')).toBeInTheDocument();expect(screen.getByRole('link',{name:'Back to Stanley'})).toHaveAttribute('href','/creators/pontifex')})
 it('does not celebrate a pending transaction',async()=>{vi.mocked(api.post).mockResolvedValue({status:'PENDING',amount:25,currency:'GHS'});mount();expect(await screen.findByText(/Confirming your support/)).toBeInTheDocument();expect(screen.queryByText('Celebration particles')).not.toBeInTheDocument()})
 it('does not start verification without a reference',()=>{mount('/tip/callback');expect(screen.getByText('Payment reference missing')).toBeInTheDocument();expect(api.post).not.toHaveBeenCalled()})
})
