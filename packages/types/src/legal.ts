/**
 * Single source of truth for the operating-entity facts referenced across every
 * legal/policy page. `brand` is the product/service name; `companyName` is the
 * legal entity that operates it. {@link companyClause} degrades gracefully if
 * `registrationNumber` or `registeredAddress` is ever cleared, rendering a clause
 * with no fabricated registration data rather than a blank.
 */
export const LEGAL_ENTITY = {
  brand: 'Ujimora',
  companyName: 'DevTrack',
  jurisdiction: 'Ghana',
  // Registered as a business name (sole proprietorship) under the Registration of
  // Business Names Act, 1962 (Act 151). Owner name and TIN are deliberately not
  // published here — they are not required on public legal pages.
  registrationNumber: 'BN843072020',
  registeredAddress: 'UNN House, Nii Osae Ntifu Avenue, East Legon, Accra, Greater Accra, Ghana',
  // Six real mailboxes, addressed by what they are FOR rather than by name, so
  // policy copy keeps reading naturally and re-splitting one out later is a
  // one-line change here rather than an edit across every legal page:
  //   info@    — general enquiries; the public front door on the contact page
  //   support@ — support and refunds (a refund is a support workflow)
  //   trust@   — trust & safety, fraud and campaign reports
  //   legal@   — legal notices and data-protection requests
  //   sales@   — sales and partnerships
  //   no-reply@ — outbound transactional sender only (see FROM_EMAIL)
  emails: {
    general: 'info@ujimora.com',
    support: 'support@ujimora.com',
    legal: 'legal@ujimora.com',
    // Data-protection requests are handled by the same legal function.
    privacy: 'legal@ujimora.com',
    // Refunds are a support workflow, not a separate desk.
    refunds: 'support@ujimora.com',
    report: 'trust@ujimora.com',
    sales: 'sales@ujimora.com',
  },
  minAge: 18,
  effectiveDate: '8 September 2026',
  governingLaw: 'Ghana',
} as const

const E = LEGAL_ENTITY.emails

/**
 * Each policy shows its own effective date. `LEGAL_ENTITY.effectiveDate` is the
 * date of the first published pack and still applies to policies unchanged
 * since. When a policy's text changes, give it the date the new text is
 * published, record the change in docs/compliance/LEGAL_REVISIONS.md, and
 * update the fingerprint in apps/marketing/__tests__/legalClaims.test.ts.
 * Changing a date never changes LEGAL_ACCEPTANCE_VERSION; re-acceptance is a
 * separate owner decision.
 */
const REVISED_25_SEPTEMBER_2026 = '25 September 2026'

/**
 * The registered-company clause used in the opening section of the Terms and the
 * Privacy Notice. Omits registration number / registered office gracefully while
 * those config values are empty, so a live page never states a fabricated fact.
 */
function companyClause(): string {
  const { brand, companyName, jurisdiction, registrationNumber, registeredAddress } = LEGAL_ENTITY
  let clause = `operated by ${companyName}`
  clause += registrationNumber
    ? `, registered in ${jurisdiction} under registration number ${registrationNumber}`
    : `, a company operating in ${jurisdiction}`
  if (registeredAddress) clause += `, with a registered office at ${registeredAddress}`
  return `The ${brand} website, applications and crowdfunding services are ${clause} (“${brand}”, “we”, “us”).`
}

interface LegalSection {
  title: string
  content: string
}

export interface LegalPolicy {
  slug: string
  route: string
  order: number
  /** Short label for the index hub and footer. */
  navLabel: string
  /** One-line summary for the index hub card. */
  summary: string
  icon: string
  eyebrow: string
  title: string
  description: string
  panelLabel: string
  panelTitle: string
  panelBody: string
  introduction: string
  effectiveDate: string
  sections: LegalSection[]
  actions?: { label: string; href: string }[]
  contact: string
}

const REGULATORY_BASIS: LegalSection = {
  title: 'Legal & regulatory basis',
  content: `This document is grounded in the Ghanaian legal framework applicable to donation and reward crowdfunding, including:
• Bank of Ghana crowdfunding guidance — donation and reward crowdfunding involve the collection, holding and disbursement of funds through an appropriate regulated structure or partnership.
• Data Protection Act, 2012 (Act 843) and Data Protection Commission guidance.
• Electronic Transactions Act, 2008 (Act 772) — online supplier information, pricing and fees, contract access, refund information and secure payment-system requirements.
• Payment Systems and Services Act, 2019 (Act 987), as applicable to our regulated payment partners.
• Applicable AML/CFT requirements confirmed with our regulated partners.`,
}

export const LEGAL_POLICIES: LegalPolicy[] = [
  {
    slug: 'delete-account', route: '/delete-account', order: 9,
    navLabel: 'Delete your account', icon: 'ShieldRoundedIcon',
    summary: 'Request deletion of your Ujimora account and associated personal data, including without the app.',
    eyebrow: 'Privacy controls', title: 'Delete your Ujimora account',
    description: 'Request account and personal-data deletion from the app, the website, or by email.',
    panelLabel: 'Your information', panelTitle: 'You can request deletion without reinstalling the app.',
    panelBody: 'Use Settings when signed in, or contact our privacy team from your account email.',
    introduction: 'You can initiate account deletion in Ujimora Settings. If you cannot sign in or no longer have the app, use the email request below. You do not need to install the app again.',
    effectiveDate: '12 September 2026',
    actions: [
      { label: 'Request account and data deletion by email', href: `mailto:${E.privacy}?subject=${encodeURIComponent('Ujimora account and personal-data deletion request')}&body=${encodeURIComponent('Please delete my Ujimora account and associated personal data. My account email is: [your account email]. Please confirm the next steps, any information that must be retained, the reason and retention period. I understand that you may need to verify account ownership.')}` },
      { label: 'Open account settings on the website', href: 'https://app.ujimora.com/settings' },
    ],
    sections: [
      { title: '1. Send your request', content: `Sign in and open Settings → Delete account, or email ${E.privacy} with the subject “Ujimora account and personal-data deletion request”. Send the request from your registered email where possible. We may ask for proportionate information to verify ownership. Never send your password, one-time codes, full payment-card details or identity documents in an initial email.` },
      { title: '2. What happens to your account', content: 'The in-app deletion action removes your account from active account access. A request also covers associated personal data, including profile information, saved preferences, device tokens and other information that is no longer necessary. Some data needs separate review or removal by a service provider. Account closure alone does not mean every copy of your personal data has already been erased.' },
      { title: '3. Payments, subscriptions and records we may retain', content: 'Account deletion does not forfeit your rights to eligible funds or refunds. Tell support about outstanding balances, campaigns, payouts, refunds or disputes so they can be resolved. If you have a recurring subscription, request cancellation and check the billing provider’s subscription controls; uninstalling the app is not cancellation. Transaction, identity-verification, fraud, dispute and legal records may need to be retained where there is a specific continuing lawful purpose or obligation. Request details of the categories, reason and applicable retention period from the privacy team.' },
      { title: '4. Timing and confirmation', content: 'We will verify your request, explain any necessary additional steps and confirm the outcome. Where a legal hold, financial obligation, backup cycle or service-provider process prevents immediate erasure, we will explain what remains and why. Contact the privacy team for the status of a pending request or to request correction, access or deletion of particular data without closing your account.' },
    ],
    contact: `Privacy and deletion requests: ${E.privacy}. Payment or subscription help: ${E.support}.`,
  },
  // ─────────────────────────────────────────────────────────── Terms of Use ──
  {
    slug: 'terms',
    route: '/terms',
    order: 1,
    navLabel: 'Terms of Use',
    summary: 'The ground rules for creating campaigns, contributing, fees, payouts and disputes.',
    icon: 'GavelRoundedIcon',
    eyebrow: 'Platform agreement',
    title: 'Terms of Use',
    description: 'The ground rules for creating campaigns, supporting causes, and using Ujimora responsibly.',
    panelLabel: 'Plain-language principle',
    panelTitle: 'Use the platform honestly, securely, and for its stated purpose.',
    panelBody: 'These terms cover accounts, campaigns, contributions, fees, payouts, refunds and dispute handling.',
    introduction:
      'Welcome to Ujimora. These Terms of Use govern your use of our crowdfunding platform. Please read them carefully before creating an account, publishing a campaign, or making a contribution.',
    effectiveDate: REVISED_25_SEPTEMBER_2026,
    sections: [
      { title: 'Creator profile donations and withdrawal fees', content: 'Creator profile donations require an active, unexpired paid subscription. Free plans and trials cannot enable a creator page or accept new tips. If your paid entitlement ends, new tip checkouts are disabled; existing balances remain withdrawable. Each creator withdrawal deducts the current effective plan’s platform-fee percentage from the requested amount. The fee and net transfer are shown before confirmation and fixed for that withdrawal. The same platform fee is not also deducted when a new tip is received. A failed or reversed transfer restores the full requested amount, including the Ujimora fee. Existing withdrawals keep their original fee terms.' },
      { title: "Crypto contributions, where available", content: "Crypto is an optional contribution method only where offered at checkout. Review the supported asset, network, exact amount, campaign-currency value and payment window before sending. A quote is not a completed contribution; campaign credit follows provider confirmation. Crypto contributions are not an investment, savings product or promise of returns. Availability does not represent regulatory approval or an endorsement of an asset." },
      {
        title: '1. About Ujimora',
        content: `${companyClause()} Contact: ${E.support}; legal: ${E.legal}.`,
      },
      {
        title: '2. Eligibility and accounts',
        content: `You must provide accurate information, protect your account credentials, satisfy applicable age and capacity requirements (a minimum age of ${LEGAL_ENTITY.minAge} applies), and complete identity or business verification when requested. Ujimora may restrict financial features until verification is complete.`,
      },
      {
        title: '3. Nature of the service',
        content:
          'Ujimora provides technology for creating, discovering, contributing to and administering donation and reward crowdfunding campaigns. Unless expressly stated and legally permitted, Ujimora does not promise campaign success, endorse organizer claims, provide investment products, or guarantee that funds will achieve the stated purpose.',
      },
      {
        title: '4. Organizer responsibilities',
        content: `Campaign information must be truthful, current and not misleading.
Organizers must have authority to raise and receive funds for the stated purpose.
Organizers must provide requested KYC/KYB, beneficiary, banking and supporting documents.
Organizers must use funds consistently with the campaign representation and applicable law.
Material changes must be disclosed promptly to contributors and to Ujimora.
Organizers must also follow the Campaign Organizer Agreement, which supplements these Terms and which you accept when you submit a campaign.`,
      },
      {
        title: '5. Contributions',
        content:
          'Contributions are processed through regulated payment partners. A contribution counts toward a campaign only after Ujimora receives reliable confirmation and verification. Pending, failed, reversed, refunded or disputed transactions do not constitute final funds raised.',
      },
      {
        title: '6. Subscriptions, platform fees and charges',
        content:
          'Plan prices, campaign limits, active-campaign limits and platform fees are displayed before purchase or use. Payment-processing, transfer, early-payout, priority-payout and assisted-payout charges may apply and will be disclosed before the relevant transaction. Ujimora may change future pricing with notice and effective dates; existing commitments are governed by the applicable version and grandfathering rule.',
      },
      {
        title: '7. Campaign limits and verification',
        content:
          'Goals above GHS 250,000 require staff approval unless the organizer has current approved identity verification (business verification for organizations) and an earlier published campaign. Draft, pending and blocked campaigns do not qualify for this exception. Goals up to GHS 250,000 follow the current tier review policy. Subscription entitlements and automatic approval do not override compliance limits or content-safety controls. Ujimora may require supporting documents, impose a lower approved target, pause fundraising, restrict withdrawals or refuse a campaign where reasonably required for fraud, safety, provider, legal or compliance reasons.',
      },
      {
        title: '8. Payouts and holds',
        content:
          'Payouts require eligible funds, reconciliation, verification and approval. Confirm provider processing time and any hold with support; submitting a request does not guarantee a payment date. Early, priority and assisted payouts are optional services subject to eligibility and disclosed fees. Applicable rights and mandatory deadlines are unaffected.',
      },
      {
        title: '9. Refunds, reversals and chargebacks',
        content:
          'Refunds, failed settlements, reversals and chargebacks may reduce campaign balances or amounts otherwise payable. Organizers authorize Ujimora to account for such adjustments in the campaign ledger and payout calculation to the extent permitted by law and provider rules.',
      },
      {
        title: '10. Prohibited use',
        content: `Fraud, impersonation, misleading campaigns or fabricated emergencies.
Money laundering, terrorist financing, sanctions evasion or unlawful fundraising.
Investment, debt or equity crowdfunding unless separately authorized and enabled.
Illegal goods or services, hate, harassment, exploitation, or infringement of third-party rights.
Circumvention of subscription, campaign, payment or risk controls.`,
      },
      {
        title: '11. Content and licence',
        content:
          'Users retain ownership of campaign content. They grant Ujimora a non-exclusive licence to host, reproduce, display, format and distribute that content as necessary to operate, secure and promote the campaign and service, subject to privacy settings and applicable law.',
      },
      {
        title: '12. Suspension and termination',
        content:
          'Ujimora may suspend or terminate accounts and campaigns for material breach, fraud risk, legal requirements, payment-provider requirements or threats to users and platform integrity. Where appropriate, Ujimora will provide notice and a review or appeal path.',
      },
      {
        title: '13. Disclaimers and liability',
        content:
          'To the extent permitted by law, Ujimora is not responsible for the truth of organizer representations or for events outside reasonable control. Nothing in these Terms excludes liability that cannot legally be excluded, or consumer and data rights that cannot be waived.',
      },
      {
        title: '14. Complaints and disputes',
        content: `Users should first contact ${E.support}. If you are not satisfied with the response, you can escalate to ${E.legal}. Privacy complaints can also be submitted in account Settings. These Terms are governed by the laws of ${LEGAL_ENTITY.governingLaw}, subject to mandatory consumer rights and any agreed lawful dispute-resolution mechanism.`,
      },
      {
        title: '15. Changes',
        content: `Material changes will be published with an effective date and, where appropriate, notified to affected users. Earlier versions are available on request from ${E.legal}.`,
      },
      {
        title: '16. Split-proceeds campaigns',
        content:
          'Certain campaigns may designate multiple beneficiaries and allocate campaign proceeds among them by percentage (“split-proceeds campaigns”). The published campaign may identify the applicable allocation and beneficiaries where appropriate.\nThe allocation forms part of the campaign’s financial configuration. Once the campaign has received a successful contribution, Ujimora may lock the allocation. Any exceptional amendment is subject to Ujimora approval, affected-recipient consent, audit requirements, and applicable law.\nUjimora may withhold or block a particular beneficiary’s payout pending identity verification, compliance review, dispute resolution, chargeback or refund exposure, or other lawful payout conditions. A blocked share is not automatically transferred to another beneficiary.\nCampaign-level charges may be deducted before proceeds are allocated. Beneficiary-specific optional payout fees may be deducted from the relevant beneficiary’s share as disclosed at the time of request.',
      },
      REGULATORY_BASIS,
    ],
    contact: `Questions about these terms can be sent to ${E.legal}.`,
  },

  // ────────────────────────────────────────────────────────── Privacy Notice ──
  {
    slug: 'privacy',
    route: '/privacy',
    order: 2,
    navLabel: 'Privacy Notice',
    summary: 'What we collect, why it is needed, how it is shared and protected, and your rights.',
    icon: 'ShieldRoundedIcon',
    eyebrow: 'Your information',
    title: 'Privacy Notice',
    description: 'A clear account of what Ujimora collects, why it is needed, and the choices available to you.',
    panelLabel: 'Privacy principle',
    panelTitle: 'Collect what is needed. Protect it. Explain its use.',
    panelBody: 'This notice covers account data, campaign records, payments, security, retention, and your rights under Act 843.',
    introduction:
      'At Ujimora, we are committed to protecting your privacy and the security of your personal information. This notice explains how we collect, use, share, retain, and protect data when you use the platform.',
    effectiveDate: REVISED_25_SEPTEMBER_2026,
    sections: [
      { title: "Blockchain and crypto payment information", content: "Where you use crypto checkout, payment records may include wallet addresses, network, asset, transaction hash, memo or tag, quote, campaign-currency value and provider references. We use relevant records to match and confirm contributions, investigate failures and support required compliance checks with payment partners. Blockchain transactions can be public and persistent; hiding your name on a campaign does not make a blockchain transfer anonymous. We cannot erase records on public blockchains." },
      {
        title: 'AI writing and safety screening',
        content: 'For account and organization identity changes, creator-page changes, campaign creation, campaign URL changes, comments and campaign updates, automated text screening is optional and requires your permission for that submission. If you opt in, the proposed public text is sent to OpenAI for safety screening. Otherwise staff review it; flagged text and attached media also require staff review. Proposed versions and decisions stay in a private publication-review record for up to 30 days, with scheduled deletion, and operational review records are removed on account closure. An approved version must be submitted again within seven days; an approval does not authorize changed content, a campaign goal or any payment. Staff audit records may be retained separately for accountability. When you explicitly request AI writing, your text, instructions and generated draft are processed by OpenAI for writing assistance and safety screening. Flagged drafts are withheld; unavailable screening does not approve a draft. Ujimora records usage and your request-specific permission without storing raw writing input or output in its usage log. A result fingerprint lets us validate safety reports. If you choose Report on a suggestion, the original generated text and your report are saved in the restricted moderation queue for review and follow-up. Review suggestions before using them. Automated checks can make mistakes and do not verify facts or replace human moderation; contact support if a request needs review.',
      },
      {
        title: '1. Controller and scope',
        content: `${companyClause()} Contact: ${E.support}; privacy: ${E.privacy}. Ujimora acts as data controller for personal data it determines how and why to process, subject to any processor or controller allocation agreed with payment, identity and infrastructure partners.`,
      },
      {
        title: '2. Data we collect',
        content: `Account and contact data: name, email, phone, and login or account identifiers.
Identity, KYC and KYB data: identity documents, organization records, beneficial owners or signatories, and verification results where required.
Campaign data: story, beneficiary information, evidence, updates and public content.
Payment and financial metadata: transaction references, amounts, payment channel, payout destination details and reconciliation status. Card credentials are handled by the payment provider rather than stored by Ujimora.
Device and security data: IP address, device and browser, logs, fraud signals and authentication events.
Support, complaint and communications records.`,
      },
      {
        title: '3. Why we use data',
        content: `Provide accounts, campaigns, contributions and payouts.
Perform identity and business verification, fraud prevention, AML/CFT and security controls.
Process subscriptions and fees and reconcile transactions.
Provide support, resolve disputes and enforce our terms.
Meet legal, regulatory, audit and partner obligations.
Improve and oversee the service using internal, aggregated reports on accounts, campaigns and transactions (no third-party analytics or tracking tools).
Send marketing only where permitted and with applicable choice or consent.`,
      },
      {
        title: '4. Legal basis and fairness',
        content:
          'Ujimora processes personal data only on an applicable lawful basis, including consent where required, performance of a contract, legal obligations and other bases permitted under Act 843. Collection is relevant, necessary and not excessive for the stated purpose.',
      },
      {
        title: '5. Sharing',
        content:
          'Data may be shared as necessary with payment processors, banks, identity and KYC vendors, hosting and security providers, professional advisers, authorities where legally required, and campaign parties where the service requires it. Ujimora contractually governs its processors and discloses material categories of recipients.',
      },
      {
        title: 'Optional activity alerts and emails',
        content: 'In Settings, you can separately opt in to notification-inbox alerts and emails about donations, creator support, withdrawals and payouts, refunds, wallet activity and subscriptions. Each activity and channel starts off. We store your choices and their change times and use relevant transaction details to prepare the updates you select. Activity emails use our email delivery provider, Resend, and require a verified account email. You can turn a choice off at any time; this stops queued messages that have not already been sent. These choices do not subscribe you to marketing. Account verification, password recovery and password-change security notices remain separate. Decisions our team makes on your own campaigns, verification applications and reports appear in your notification inbox as service notices. Newsletter and promotional emails require a separate request and email confirmation. We record when you request, confirm or withdraw that choice. You can turn newsletter emails off in Settings or use the unsubscribe link without signing in. Confirmation emails use Resend. Previously collected addresses without confirmed consent are excluded from the mailing list.',
      },
      {
        title: 'Optional account protection',
        content: 'After signing in, you can enable an authenticator app for an extra sign-in code. We store its secret encrypted, hashes of single-use recovery codes and security-change records. Keep the setup key and downloaded recovery codes private. On supported mobile devices, biometric unlock is a separate optional setting. Fingerprint and face information stays within your device authentication system; Ujimora uses the result to access a protected saved sign-in credential. Signing out removes that saved credential and biometric preference from the app. You can use password and authenticator sign-in instead. Server-side authenticator data is removed through the account-erasure process; necessary security audit records are kept only as long as needed for security and legal purposes.',
      },
      {
        title: 'Optional organization website requests',
        content: 'An organization can separately request website assistance during signup. If selected, its organization and contact details and website request may be used for follow-up by parent company Neurodyne Corp Ltd (https://neurodyne.dev; info@neurodyne.dev). This is optional and is not required to use Ujimora. New requests and withdrawals are timestamped. Use Withdraw website request in the signed-in notice to stop the request; for contact already underway, contact info@neurodyne.dev. Withdrawing the request does not affect the account or its donations.',
      },
      {
        title: '6. International transfers',
        content:
          'Where data is processed outside Ghana, Ujimora assesses and implements the safeguards required by applicable Ghanaian law and by its contractual and provider arrangements.',
      },
      {
        title: '7. Retention',
        content: `Personal data is retained only as long as necessary for the stated purpose and applicable legal, financial, fraud, dispute, audit and regulatory obligations. Contact ${E.privacy} for the retention period that applies to particular data.`,
      },
      {
        title: '8. Your rights',
        content: `Subject to Act 843, you may have rights to be informed, to access your personal data, to request correction or rectification, to object to certain processing and to exercise other applicable data-subject rights. To make a request, contact ${E.privacy}.`,
      },
      {
        title: '9. Security',
        content:
          'Ujimora uses reasonable technical and organisational measures including access controls, encryption where appropriate, secure development, monitoring, backups, incident response and least-privilege administration. No method of electronic transmission or storage is completely secure.',
      },
      {
        title: '10. Cookies and analytics',
        content:
          'Ujimora web properties do not currently use cookies or third-party analytics, tracking or advertising technologies. We produce internal, aggregated reports on accounts, campaigns and transactions from records we already hold (see section 3). See the Cookie Notice for the browser storage we use.',
      },
      {
        title: '11. Children',
        content: `Ujimora is intended for users aged ${LEGAL_ENTITY.minAge} and over. Campaigns involving children require appropriate adult authority and heightened handling of personal information.`,
      },
      {
        title: '12. Contact and complaints',
        content: `In account Settings, you can submit a private request for access to your data, correction or a privacy review, check progress and read our response. We aim to respond within 30 days; applicable legal requirements continue to apply. If you cannot sign in, or need another way to receive information, contact ${E.privacy}. Request details and review records are used to handle and document your request. You may also contact the Ghana Data Protection Commission regarding your rights or concerns where applicable.`,
      },
      {
        title: '13. Updates',
        content:
          'This notice shows its effective date and material changes will be communicated appropriately.',
      },
      REGULATORY_BASIS,
    ],
    contact: `Privacy-related inquiries can be sent to ${E.privacy}.`,
  },

  // ──────────────────────────────────────────── Campaign Organizer Agreement ──
  {
    slug: 'organizer-agreement',
    route: '/organizer-agreement',
    order: 3,
    navLabel: 'Organizer Agreement',
    summary: 'What campaign organizers commit to: accuracy, verification, fees, payouts and split beneficiaries.',
    icon: 'HandshakeRoundedIcon',
    eyebrow: 'For campaign organizers',
    title: 'Campaign Organizer Agreement',
    description: 'The commitments you make when you create or control a campaign on Ujimora.',
    panelLabel: 'Organizer principle',
    panelTitle: 'Raise funds honestly, with authority, for the purpose you state.',
    panelBody: 'This agreement supplements the Terms of Use and applies to everyone who creates or controls a campaign.',
    introduction:
      'This Campaign Organizer Agreement supplements the Ujimora Terms of Use and applies whenever an individual or organization creates or controls a campaign.',
    effectiveDate: REVISED_25_SEPTEMBER_2026,
    sections: [
      { title: "Campaign credit from crypto contributions", content: "Where crypto contributions are enabled, campaign credit is recorded in the campaign currency after confirmation, using the accepted payment value. A pending transfer or unaccepted quote is not available campaign proceeds. Crypto acceptance does not by itself provide crypto payouts or change beneficiary allocations, payout review or applicable fees." },
      {
        title: '1. Incorporation',
        content:
          'This Agreement supplements the Ujimora Terms of Use and applies whenever an individual or organization creates or controls a campaign.',
      },
      {
        title: '2. Organizer warranties',
        content:
          'You confirm that the campaign is genuine, that its information and evidence are accurate, that required permissions have been obtained, that beneficiaries are correctly identified, and that funds will not be used unlawfully or materially inconsistently with the campaign.',
      },
      {
        title: '3. Verification',
        content:
          'You agree to provide KYC/KYB, beneficial-owner, signatory, beneficiary, bank or mobile-money, and supporting evidence requested by Ujimora or its regulated partners.',
      },
      {
        title: '4. Campaign changes',
        content:
          'Material changes to purpose, beneficiary, target or use of funds require disclosure and may trigger re-review. Ujimora may pause contributions or payouts during review.',
      },
      {
        title: '5. Fees',
        content:
          'You accept the subscription, platform, processing and optional payout fees displayed for the applicable plan or request. Fees and net proceeds must be shown before confirmation where applicable.',
      },
      {
        title: '6. Payout eligibility',
        content:
          'A displayed amount raised is not automatically withdrawable. Payout depends on cleared verified contributions, deductions, reserves, disputes, refunds, reconciliation, verification and compliance approval.',
      },
      {
        title: '7. Early payout',
        content:
          'Early payout is optional and request-based. You accept the displayed early-payout fee and reserve. Ujimora may deny or reduce a request based on risk, provider rules, disputes or legal requirements.',
      },
      {
        title: '8. Use of funds and accountability',
        content:
          'Ujimora may request evidence of use of funds, especially for high-value or organization campaigns. Misuse may result in suspension, reporting, refund or recovery steps, or other lawful action.',
      },
      {
        title: '9. Indemnity and liability',
        content:
          'Subject to applicable law, you are responsible for losses or claims caused by fraudulent, unlawful or materially misleading organizer content or instructions. This clause does not waive rights or liabilities that cannot legally be waived.',
      },
      {
        title: '10. Acceptance',
        content:
          'You accept this Agreement when you submit a campaign. On the website and in the mobile app, the last step of campaign creation links to this Agreement and states that submitting the campaign means you agree to it. Ujimora’s records show which account submitted each campaign and when; Ujimora does not keep a separate signature or acceptance record for this Agreement. Submitting a campaign also requires your current acceptance of the Terms of Use, which is recorded with your user ID, the version you accepted and a timestamp. This Agreement continues to apply while you control the campaign.',
      },
      {
        title: '11. Split beneficiary allocation',
        content:
          'If you configure a campaign to divide proceeds among multiple beneficiaries, you represent that the beneficiary information and percentage allocations are accurate and authorized. Allocations must total 100% before publication.\nYou must not use split functionality to conceal the true recipient of funds, evade verification, disguise a commercial payment, launder funds, or redirect proceeds after donations are received.\nAfter the first successful contribution, allocations are locked by default. You have no unilateral right to reduce, remove, replace or reallocate a beneficiary’s accrued share. Any approved change may apply only prospectively and may require all affected beneficiaries to consent.\nEach beneficiary must satisfy applicable verification and payout requirements. If a beneficiary cannot be paid, Ujimora may hold that beneficiary’s allocated share pending resolution rather than redistribute it automatically.\nYou must disclose the split structure accurately to contributors where Ujimora requires it and must not make representations inconsistent with the configured allocation.',
      },
    ],
    contact: `Questions about organizer obligations can be sent to ${E.support}.`,
  },

  // ───────────────────────────────────────────────── Contributor/Donor Terms ──
  {
    slug: 'contributor-terms',
    route: '/contributor-terms',
    order: 4,
    navLabel: 'Contributor Terms',
    summary: 'What contributing to a campaign means, refunds, disputes and multi-beneficiary campaigns.',
    icon: 'VolunteerActivismRoundedIcon',
    eyebrow: 'For contributors',
    title: 'Contributor & Donor Terms',
    description: 'What it means to contribute to a Ujimora campaign, and the protections that apply.',
    panelLabel: 'Contributor principle',
    panelTitle: 'Give with clear information about where your contribution goes.',
    panelBody: 'These terms apply whenever you contribute to a campaign — including campaigns with multiple beneficiaries.',
    introduction:
      'These Contributor & Donor Terms apply when you contribute to a Ujimora campaign or creator profile. They explain the nature of a contribution, refunds, disputes, and campaigns with multiple beneficiaries.',
    effectiveDate: LEGAL_ENTITY.effectiveDate,
    sections: [
      { title: 'Creator profile donations and withdrawal fees', content: 'Creator profile donations require an active, unexpired paid subscription. Free plans and trials cannot enable a creator page or accept new tips. If your paid entitlement ends, new tip checkouts are disabled; existing balances remain withdrawable. Each creator withdrawal deducts the current effective plan’s platform-fee percentage from the requested amount. The fee and net transfer are shown before confirmation and fixed for that withdrawal. The same platform fee is not also deducted when a new tip is received. A failed or reversed transfer restores the full requested amount, including the Ujimora fee. Existing withdrawals keep their original fee terms.' },
      { title: "Sending a crypto contribution", content: "Use only the asset, network, address and required memo or tag shown for your payment. Review the quoted campaign-currency value, exchange rate and any fees shown; your wallet may also charge sending fees. Obtain a fresh quote if it expires before you proceed. Do not send after the payment window closes. Wrong-network transfers, incorrect addresses and missing tags can cause permanent loss. If you have already sent and confirmation is delayed, contact support with the campaign, payment reference and transaction hash before sending again. Never share private keys or recovery phrases." },
      {
        title: '1. Scope',
        content: 'These terms apply when a person contributes to a Ujimora campaign or makes a direct donation to a creator profile.',
      },
      {
        title: '2. Nature of contribution',
        content:
          'Unless a campaign is explicitly offered under a separately authorized model, a contribution is a donation or eligible non-financial reward contribution — not an equity investment, loan, deposit or promise of financial return.',
      },
      {
        title: '3. Campaign responsibility',
        content:
          'Campaigns are created by organizers. Ujimora may verify information and enforce platform rules but cannot guarantee every statement, outcome or use of funds. You should review campaign information before paying.',
      },
      {
        title: '4. Payment',
        content:
          'The final amount, applicable processing and other charges, and the payment method are shown before confirmation. Ujimora counts a contribution only after reliable provider confirmation.',
      },
      {
        title: '5. Refunds',
        content:
          'Refund eligibility is governed by the published Payout, Refund & Failed Campaign Policy, applicable law, payment-provider rules and campaign circumstances. A change of mind does not automatically create a refund right where the law does not require one.',
      },
      {
        title: '6. Failed or cancelled campaigns',
        content:
          'Where Ujimora operates an all-or-nothing campaign, or an applicable policy requires the return of funds when the target is not met, the campaign page discloses this before contribution. Otherwise the campaign’s funding model is clearly stated.',
      },
      {
        title: '7. Chargebacks and disputes',
        content:
          'Please contact Ujimora first where possible so issues can be investigated. Nothing restricts rights available through the payment provider or applicable law.',
      },
      {
        title: '8. Privacy',
        content:
          'Contributor information is handled under the Ujimora Privacy Notice. Public display of your name or amount is optional and configurable unless required for the service or by law.',
      },
      {
        title: '9. Complaints',
        content: `Contact ${E.support} with the campaign reference and transaction reference.`,
      },
      {
        title: '10. Campaigns with multiple beneficiaries',
        content:
          'A campaign may state that its distributable proceeds will be divided among multiple beneficiaries by percentage. Where shown, this allocation is part of the campaign information on which you may rely when deciding whether to contribute.\nCampaign fees, payment-processing charges, refunds, reserves or other disclosed deductions may reduce the amount ultimately available to split among beneficiaries.\nVerification, compliance review, disputes or payout holds may delay payment to one beneficiary without necessarily delaying or reallocating another beneficiary’s share, subject to Ujimora’s payout policy and applicable law.\nA post-launch split amendment, if permitted, follows Ujimora’s controlled amendment process and does not retroactively reassign amounts already accrued under an earlier split version.',
      },
    ],
    contact: `Contribution questions can be sent to ${E.support} with your transaction reference.`,
  },

  // ─────────────────────────────────── Payout, Refund & Failed Campaign Policy ──
  {
    slug: 'refund-policy',
    route: '/refund-policy',
    order: 5,
    navLabel: 'Payout & Refund Policy',
    summary: 'Standard, priority, early and assisted payouts, holds, refunds, and split-proceeds payouts.',
    icon: 'CurrencyExchangeRoundedIcon',
    eyebrow: 'Money movement',
    title: 'Payout, Refund & Failed Campaign Policy',
    description: 'When and how funds are paid out or refunded, the fees involved, and when holds apply.',
    panelLabel: 'Payout principle',
    panelTitle: 'Funds move only when they are cleared, reconciled and compliant.',
    panelBody: 'Review the fee, net amount and eligibility shown for your payout before confirming. Refund requests are free to submit and require review.',
    introduction:
      'This policy explains how payouts and refunds work on Ujimora: the standard payout window, the optional priority, early and assisted payout services, the holds that can apply, and how failed or cancelled campaigns are handled.',
    effectiveDate: LEGAL_ENTITY.effectiveDate,
    sections: [
      { title: 'Creator profile donations and withdrawal fees', content: 'Creator profile donations require an active, unexpired paid subscription. Free plans and trials cannot enable a creator page or accept new tips. If your paid entitlement ends, new tip checkouts are disabled; existing balances remain withdrawable. Each creator withdrawal deducts the current effective plan’s platform-fee percentage from the requested amount. The fee and net transfer are shown before confirmation and fixed for that withdrawal. The same platform fee is not also deducted when a new tip is received. A failed or reversed transfer restores the full requested amount, including the Ujimora fee. Existing withdrawals keep their original fee terms.' },
      { title: "Crypto transfers and refund review", content: "A completed blockchain transfer cannot simply be reversed. Contact support with the campaign reference, payment reference and transaction hash to request review. Do not send another transfer to resolve a delayed payment unless instructed through verified support. Any eligible refund depends on applicable rights, provider capabilities and the circumstances of the payment; confirm the currency, amount, conversion basis, fees and destination with support. Do not assume the same crypto quantity will be returned or that an exchange sending address can receive refunds. This does not limit applicable statutory rights." },
      {
        title: '1. Standard payout',
        content:
          'Standard campaign payout has no additional Ujimora payout service fee. Donation processing and platform fees may already have been deducted before the eligible balance is calculated. Payout requires available funds, verification, reconciliation and approval. Submission does not guarantee a payment date; provider processing and holds can affect timing.',
      },
      {
        title: '2. Priority and early payout',
        content: 'Where available, priority, early and urgent payout services carry an additional service fee. The current percentage, minimum fee, reserve and eligible balance determine the amount available. Review the fee and net transfer shown before confirming. Early and urgent withdrawals are subject to a reserve ceiling. A paid service does not bypass verification, holds or provider restrictions.',
      },
      {
        title: '3. Assisted bank payout',
        content:
          'Where available, assisted bank payout carries a percentage fee and fixed service charge. Review the fee and net amount before confirming. Requests require operational review and documented bank processes; selecting this option does not confirm offline delivery or authorize an undisclosed charge.',
      },
      {
        title: '4. Holds',
        content:
          'Ujimora may delay payout for unresolved KYC/KYB, beneficiary mismatch, fraud or risk review, chargeback or refund exposure, provider outage or restriction, a court or regulatory request, a campaign dispute, or a reconciliation discrepancy.',
      },
      {
        title: '5. Refunds',
        content:
          'Submitting a donation refund request is free and does not approve or execute a refund. The team reviews applicable law, provider rules, cancellation, duplicate or erroneous payment, fraud concerns and the circumstances of the contribution. Contact support for guest payments, optional platform tips or payments not listed in your account. Eligible refunds use the original payment rail where supported; support must confirm any alternative securely. Review the amount, fee treatment and provider timing with support. Mandatory rights and deadlines are unaffected.',
      },
      {
        title: '6. Target not met',
        content:
          'The platform does not automatically refund contributions when a campaign misses its target. A goal is a fundraising target, not an automatic all-or-nothing escrow instruction. Funds remain subject to payout eligibility and holds. If a campaign fails, is cancelled or makes an unfulfilled commitment, request review through your donation record or contact support. Applicable refund rights are unaffected.',
      },
      {
        title: '7. Fee treatment',
        content:
          'No automatic percentage deduction is applied when you submit a new donation refund request. The recorded requested amount is not proof of payment or a final settlement quote. Platform fees, processor charges, optional tips, previously paid-out funds and partial refunds require review against the original transaction and applicable rights. Ujimora will not retain a fee where law or provider rules require its return. Existing financial records retain their historical amounts; contact support to review a previously recorded request fee.',
      },
      {
        title: '8. Admin configuration',
        content:
          'Administrators can version supported payout pricing and reserve settings. Some transfer limits and approval controls are deployment settings. A later configuration change does not rewrite a payout’s recorded fee and net amount. Review the transaction-specific terms before confirming; applicable law takes precedence.',
      },
      {
        title: '9. Split-proceeds payouts',
        content:
          'For an approved split campaign, Ujimora calculates each beneficiary’s share from the campaign’s net distributable proceeds using the applicable accepted split version.\nEach beneficiary is paid separately and must independently satisfy verification, payout-method and compliance requirements.\nA beneficiary requesting priority, early or assisted bank payout may only request against that beneficiary’s own cleared and eligible share. Applicable optional-service charges are normally borne by the requesting beneficiary unless the campaign configuration states otherwise.\nA payout hold affecting one beneficiary does not automatically transfer that beneficiary’s allocation to the remaining beneficiaries.\nRefunds, chargebacks and post-payment adjustments are applied to the campaign and beneficiary ledger under Ujimora’s configured allocation and reserve rules. Ujimora may maintain reserves or offset future eligible amounts where contractually and legally permitted.',
      },
    ],
    contact: `Submit from your donation history or email ${E.refunds} with the relevant transaction reference.`,
  },

  // ───────────────────────────────── Acceptable Use & Prohibited Campaigns ──
  {
    slug: 'acceptable-use',
    route: '/acceptable-use',
    order: 6,
    navLabel: 'Acceptable Use',
    summary: 'Campaigns that are prohibited or need enhanced review, and how we enforce the rules.',
    icon: 'PolicyRoundedIcon',
    eyebrow: 'Community safety',
    title: 'Acceptable Use & Prohibited Campaigns',
    description: 'What may not be fundraised for on Ujimora, what needs extra review, and how we enforce it.',
    panelLabel: 'Safety principle',
    panelTitle: 'Protect contributors, organizers and regulated partners from harm.',
    panelBody: 'This policy defines prohibited and high-review campaigns and the enforcement actions available to Ujimora.',
    introduction:
      'This policy protects contributors, organizers, regulated partners and Ujimora from unlawful, deceptive or harmful fundraising. It sets out what is prohibited, what needs enhanced review, and how Ujimora enforces the rules.',
    effectiveDate: LEGAL_ENTITY.effectiveDate,
    sections: [
      { title: "Crypto payment misuse", content: "Do not use contributions to conceal the source of funds, evade sanctions or verification, route prohibited transactions, or operate an unapproved exchange or investment scheme. Do not ask contributors to send to substitute wallet addresses outside the checkout or to disclose private keys or recovery phrases." },
      {
        title: '1. Purpose',
        content:
          'This policy protects contributors, organizers, regulated partners and Ujimora from unlawful, deceptive or harmful fundraising.',
      },
      {
        title: '2. Prohibited campaigns',
        content: `Fraudulent, fabricated, impersonating or materially misleading campaigns.
Money laundering, terrorist financing, sanctions evasion, bribery or proceeds of crime.
Unlicensed investment, equity, debt or interest-bearing fundraising.
Illegal goods or services, or instructions facilitating crime.
Exploitation, trafficking, sexual abuse material, or fundraising that facilitates abuse.
Hate, threats, targeted harassment or violent wrongdoing.
Infringement of intellectual property or privacy rights.
Attempts to bypass KYC/KYB, campaign limits, payment restrictions, subscription limits or payout controls.`,
      },
      {
        title: '3. Restricted and high-review campaigns',
        content:
          'Ujimora may require enhanced review for medical or emergency claims, minors, charities and NPOs, political or public-interest fundraising, very high-value targets, cross-border beneficiaries, disaster response, and other categories presenting elevated fraud or compliance risk.',
      },
      {
        title: '4. Enforcement',
        content:
          'Ujimora may reject, pause, unpublish, restrict payments or payouts, request evidence, preserve records, refund where appropriate, or report matters where legally required. Appeals should be available for eligible enforcement decisions.',
      },
      {
        title: '5. Reporting',
        content: `You can report suspicious campaigns to ${E.report}.`,
      },
    ],
    contact: `Report a campaign or ask a question at ${E.report}.`,
  },

  // ────────────────────────────────────────────────────────────── Cookie Notice ──
  {
    slug: 'cookies',
    route: '/cookies',
    order: 7,
    navLabel: 'Cookie Notice',
    summary: 'The browser storage Ujimora uses and how to control it.',
    icon: 'CookieRoundedIcon',
    eyebrow: 'Tracking technologies',
    title: 'Cookie Notice',
    description: 'The browser storage used on Ujimora web properties, and the choices you have.',
    panelLabel: 'Cookie principle',
    panelTitle: 'No tracking cookies. Browser storage only for sign-in, preferences, drafts, payments and referrals.',
    panelBody: 'This notice lists what Ujimora keeps in your browser, how long it stays and how to clear it.',
    introduction:
      'This notice explains the cookies and similar technologies used on Ujimora web properties. We do not currently set cookies; we use your browser’s local and session storage only for the purposes listed below.',
    effectiveDate: REVISED_25_SEPTEMBER_2026,
    sections: [
      {
        title: '1. Scope',
        content: 'This notice explains cookies and similar technologies used on Ujimora web properties.',
      },
      {
        title: '2. What we use',
        content: `Ujimora web properties do not currently set cookies or use third-party analytics, tracking or advertising technologies. We use your browser’s local storage and, where marked, session storage (cleared when you close the tab) for:
• Sign-in (uf_tokens, uf_tokens:received, uf_user, accessToken, uf_last_activity) to keep you signed in. Removed when you sign out. After an hour without activity they are removed straight away if a Ujimora page is open, or otherwise the next time you open the site; until then they stay in your browser.
• Display preferences (uf_color_mode, uf_skin), kept until you clear site data.
• Unsent drafts (ujimora:publication-draft:*): the campaign form while you fill it in, and profile images held for safety review, so the exact version can be submitted again once approved. Saved per account. A draft older than 30 days is deleted the next time its page is opened, and all drafts are deleted when you sign out. They are not deleted when a session ends through inactivity.
• Payment recovery, so the confirmation page can pick up your payment after the payment provider sends you back. Donation handoffs (uf_pending_donations, session storage) are removed once the payment succeeds, fails or expires. Wallet top-up references (ujimora-topup-*) stay in session storage until you close the tab. Tip attempts (ujimora:tip-attempt:*) are removed once the payment is resolved. Subscription checkouts (uf_pending_subscriptions) are removed once the checkout is settled, fails or expires, or when you clear site data.
• Checkout retry keys (ujimora:checkout-attempt:*, session storage): opaque codes that stop a retried donation from being charged twice. They contain no amounts or personal details.
• Referral attribution (uf_ref), which stores an affiliate code from a ?ref= link so the referrer can be credited if you sign up. Kept until you create an account or clear site data.
The staff console uses equivalent sign-in and display-preference entries.`,
      },
      {
        title: '3. Choices',
        content:
          'You can clear this storage at any time using your browser’s site-data controls. Clearing sign-in storage signs you out, and clearing drafts removes any unsent campaign or profile-image version. If we introduce analytics, tracking or advertising technologies on our web properties, we will update this notice first and ask for your consent where required.',
      },
      {
        title: '4. Third parties',
        content:
          'We do not use third-party cookies, analytics or tracking SDKs on our web properties. Images and fonts may be delivered by content-delivery providers, which receive standard request information such as your IP address. Payment pages hosted by our payment providers are governed by their own notices.',
      },
      {
        title: '5. Retention',
        content:
          'Each item is kept for the period described in section 2. You can remove any of it sooner by clearing your browser’s site data.',
      },
      {
        title: '6. Updates',
        content:
          'This notice is updated whenever analytics, advertising, payment or authentication technologies materially change.',
      },
    ],
    contact: `Questions about cookies can be sent to ${E.privacy}.`,
  },

  // ─────────────────────────────────────────────── Subscription & Billing Terms ──
  {
    slug: 'billing-terms',
    route: '/billing-terms',
    order: 8,
    navLabel: 'Subscription & Billing',
    summary: 'Plans, billing, renewal and cancellation, upgrades, downgrades, price changes and enterprise.',
    icon: 'ReceiptLongRoundedIcon',
    eyebrow: 'Plans & billing',
    title: 'Subscription & Billing Terms',
    description: 'How Ujimora subscription plans are billed, renewed, upgraded, downgraded and changed.',
    panelLabel: 'Billing principle',
    panelTitle: 'Clear prices, disclosed before purchase, versioned when they change.',
    panelBody: 'Plan price, campaign limits, active-campaign limits, platform fee and features are shown at purchase.',
    introduction:
      'These terms explain how Ujimora subscription plans are billed and managed, including renewal, cancellation, upgrades, downgrades and price changes.',
    effectiveDate: REVISED_25_SEPTEMBER_2026,
    sections: [
      { title: 'Creator profile donations and withdrawal fees', content: 'Creator profile donations require an active, unexpired paid subscription. Free plans and trials cannot enable a creator page or accept new tips. If your paid entitlement ends, new tip checkouts are disabled; existing balances remain withdrawable. Each creator withdrawal deducts the current effective plan’s platform-fee percentage from the requested amount. The fee and net transfer are shown before confirmation and fixed for that withdrawal. The same platform fee is not also deducted when a new tip is received. A failed or reversed transfer restores the full requested amount, including the Ujimora fee. Existing withdrawals keep their original fee terms.' },
      {
        title: '1. Plans',
        content:
          'Ujimora may offer Community, Plus, Pro, Organization and Enterprise plans. The current price, campaign target limit, active-campaign limit, platform fee and feature entitlements are displayed at purchase and controlled by versioned admin dashboard configuration.',
      },
      {
        title: '2. Billing',
        content:
          'Paid plans are charged for the 30-day (monthly) or one-year (yearly) period you select. Before you confirm, checkout shows the plan, the period, any coupon discount and the total you will be charged. If taxes or other charges apply to a plan, checkout will show them before you pay.',
      },
      {
        title: '3. Renewal and cancellation',
        content:
          'Plans bought on the Ujimora website are paid for one period at a time and do not renew automatically; your plan ends at the end of the paid period unless you buy again, and there is nothing to cancel. Plans bought through the App Store or Google Play renew under that store’s terms until you cancel there; cancelling stops future renewal but keeps access until the end of the paid period. Elapsed periods are not automatically refunded except where required by law or an express guarantee.',
      },
      {
        title: '4. Upgrades',
        content:
          'Upgrades take effect under the billing rules shown before you confirm and may immediately increase commercial entitlements, but never bypass compliance approval. On the website, buying the plan you already have adds the new period to the end of your current one; buying a different plan while one is active replaces it once you confirm, and unused time on the replaced plan is not credited or refunded.',
      },
      {
        title: '5. Downgrades',
        content:
          'Downgrades do not delete active campaigns. If active campaigns or targets exceed the new plan’s limits, the account becomes over-limit and cannot publish additional campaigns until usage falls within entitlement or the plan is upgraded.',
      },
      {
        title: '6. Price changes',
        content:
          'Future price or fee changes have an effective date. Ujimora provides reasonable notice for material changes and supports grandfathering and version rules where promised.',
      },
      {
        title: '7. Enterprise',
        content:
          'Enterprise terms, limits and fees may be negotiated in an order form or enterprise agreement that prevails over conflicting standard commercial terms to the stated extent.',
      },
    ],
    contact: `Billing questions can be sent to ${E.support}.`,
  },
]

export function getPolicyBySlug(slug: string): LegalPolicy | undefined {
  return LEGAL_POLICIES.find((p) => p.slug === slug)
}
