/**
 * Contextual help for the organization verification form: the copy behind
 * each field's help button, shared by the website and the app so both explain
 * a field in the same words.
 */

/** What a field's help popup shows, top to bottom. */
export interface FieldHelpContent {
  /** The field's name; the popup title. */
  title: string
  /** One short line: the tooltip on the website, the screen-reader hint in the app. */
  summary: string
  /** One or two short paragraphs saying what the field asks for. */
  body: readonly string[]
  /** Short examples, listed after the body. */
  examples?: readonly string[]
  /** A closing paragraph, after the examples. */
  note?: string
  /** Final small print. For uploads: who sees the file and what can be uploaded. */
  footnote?: string
}

/** Accessible name of a field's help button. */
export const fieldHelpLabel = (help: Pick<FieldHelpContent, 'title'>) => `What is "${help.title}"?`

/** Lead-in shown above a help popup's examples. */
export const FIELD_HELP_EXAMPLES_LABEL = 'For example'

/** The button that closes a help popup. */
export const FIELD_HELP_DISMISS_LABEL = 'Got it'

/**
 * Ends every upload's help. The format and size match both uploaders and the
 * API: images or PDF up to 4 MB (web ImageUpload MAX_IMAGE_UPLOAD_MB, the app's
 * MediaUploadField, POST /uploads/image), stored privately for review.
 * Change this line if any of those limits change.
 */
export const ORGANIZATION_KYC_UPLOAD_NOTE = 'Private: only authorized Ujimora staff review it. Image or PDF, up to 4 MB.'

/** The fields that carry a help button, keyed as the forms key their values. */
export const ORGANIZATION_KYC_HELP_FIELDS = ['representativeCapacity', 'idNumber', 'registration', 'authorization', 'identity', 'control'] as const
export type OrganizationKycHelpField = (typeof ORGANIZATION_KYC_HELP_FIELDS)[number]

/** The form's private uploads, in order: the key each form stores the file under, and the field label. */
export const ORGANIZATION_KYC_UPLOADS = [
  ['registration', 'Organization registration document'],
  ['authorization', 'Representative authorization document'],
  ['identity', 'Representative identity document'],
  ['control', 'Ownership or control register (optional)'],
] as const

export const ORGANIZATION_KYC_FIELD_HELP: Readonly<Record<OrganizationKycHelpField, FieldHelpContent>> = {
  representativeCapacity: {
    title: 'Role and authority to act',
    summary: 'Your position in the organization and what gives you the right to act for it.',
    body: ['A short line naming your position in the organization and what gives you the right to act for it.'],
    examples: ['Executive Director, authorized by board resolution of 12 August 2026', 'Trustee and signatory under our trust deed'],
    note: 'The document that proves it goes in the “Representative authorization document” upload.',
  },
  idNumber: {
    title: 'Representative ID number',
    summary: 'The number on your own ID, not the organization’s registration number.',
    body: [
      'The number on your own ID — not the organization’s registration number. It must match the identity document you upload.',
      'Choose which ID in “Representative identity document type”: National ID card (Ghana Card), passport or driving licence.',
    ],
  },
  registration: {
    title: 'Organization registration document',
    summary: 'Your organization’s certificate of incorporation or registration.',
    body: ['Your organization’s certificate of incorporation or registration, from the registrar or the body you are registered with.'],
    footnote: ORGANIZATION_KYC_UPLOAD_NOTE,
  },
  authorization: {
    title: 'Representative authorization document',
    summary: 'Proof that you may act for the organization, such as a board resolution.',
    body: ['Proof that you may act for the organization.'],
    examples: ['A board or trustee resolution naming you', 'A signed letter on the organization’s letterhead from a director or trustee', 'A power of attorney'],
    footnote: ORGANIZATION_KYC_UPLOAD_NOTE,
  },
  identity: {
    title: 'Representative identity document',
    summary: 'A clear photo or scan of the ID whose number you entered.',
    body: ['A clear photo or scan of the ID whose number you entered. The name must match “Representative full name”.'],
    footnote: ORGANIZATION_KYC_UPLOAD_NOTE,
  },
  control: {
    title: 'Ownership or control register',
    summary: 'Optional: an official record of who owns or runs the organization.',
    body: ['An official record of who owns or runs the organization.'],
    examples: ['The register of directors, members or shareholders', 'The list of trustees or board members', 'A beneficial-owner record from the registrar'],
    note: 'It isn’t required, but it lets our team check your “People who control the organization” list quickly. Without it, they may ask for it later through a verification request.',
    footnote: ORGANIZATION_KYC_UPLOAD_NOTE,
  },
}
