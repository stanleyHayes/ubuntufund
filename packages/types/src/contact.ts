export type InquiryType = 'general' | 'partnership' | 'campaign' | 'bug'
export type ContactStatus = 'new' | 'in_progress' | 'resolved' | 'archived'

export interface ContactSubmission {
  id: string
  name: string
  email: string
  subject: string
  inquiryType: InquiryType
  message: string
  status: ContactStatus
  adminNotes?: string
  resolvedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface SubmitContactInput {
  name: string
  email: string
  subject: string
  inquiryType: InquiryType
  message: string
}

export interface UpdateContactStatusInput {
  status: ContactStatus
  adminNotes?: string
}
