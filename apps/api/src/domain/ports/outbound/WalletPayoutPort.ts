export interface WalletPayoutPort {
  recordCampaignReview(payoutId: string, adminId: string, note: string): Promise<void>
  settleCampaign(payoutId: string, approvedBy: string, reviewNote: string): Promise<void>
  transferCreator(input: {
    userId: string
    amount: number
    fee: number
    feePercent: number
    netAmount: number
    reference: string
  }): Promise<{
    id: string
    status: 'PAID'
    amount: number
    fee: number
    feePercent: number
    netAmount: number
    currency: string
    reference: string
  }>
}
