export type TestimonialStatus = 'draft' | 'published' | 'archived'

export interface Testimonial {
  id: string
  name: string
  role: string
  location: string
  quote: string
  rating: number
  avatarUrl?: string
  avatarColor: string
  status: TestimonialStatus
  displayOrder: number
  createdAt: Date
  updatedAt: Date
}

export interface CreateTestimonialInput {
  name: string
  role: string
  location: string
  quote: string
  rating: number
  avatarUrl?: string
  avatarColor?: string
  status?: TestimonialStatus
  displayOrder?: number
}

export interface UpdateTestimonialInput {
  name?: string
  role?: string
  location?: string
  quote?: string
  rating?: number
  avatarUrl?: string
  avatarColor?: string
  status?: TestimonialStatus
  displayOrder?: number
}
