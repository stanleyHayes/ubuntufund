/**
 * Search guides: one page per thing people in Ghana search for when they need
 * to raise money or want to give (crowdfunding in Ghana, medical bills, school
 * fees, funerals, churches, community projects, emergencies, mobile money,
 * giving from abroad, safety, and GoFundMe not paying out here).
 *
 * Content only, no React, so the build (scripts/prerender.ts via pageSeo.ts)
 * can read it. GuidePage.tsx renders each entry; GuidesIndexPage.tsx lists them.
 *
 * Every product claim here must stay true. Facts come from the published legal
 * pack (packages/types/src/legal.ts), the Help centre FAQ and the live plans;
 * __tests__/publicClaims.test.ts rejects the known false claims (for example
 * that campaigns themselves are verified: organizers are verified, campaigns
 * are screened).
 * Plan numbers appear only where the owner fixed them (the platform fees); goal
 * caps and plan features are left to the pricing page, which reads live plans.
 *
 * Inline links use [text](/path) and are rendered as links; FAQ structured data
 * gets the plain text.
 */

export type GuideIcon =
  | 'public' | 'timeline' | 'flag' | 'medical' | 'funeral' | 'school' | 'church'
  | 'community' | 'emergency' | 'flight' | 'phone' | 'shield' | 'compare'

export type FactIcon = 'payments' | 'phone' | 'percent' | 'verified' | 'bank' | 'campaign' | 'qr' | 'flight'

/** Where a call to action goes; GuidePage resolves these against the app's URL. */
export type GuideAction = 'start' | 'explore' | 'pricing' | 'organizations' | 'contact' | 'trust'

export interface GuideSection {
  heading: string
  paragraphs?: string[]
  bullets?: string[]
  /** Paragraphs after the bullets. */
  after?: string[]
}

export interface Guide {
  path: string
  /** <title>: under 60 characters, keyword first. */
  title: string
  /** Meta description: 140–158 characters. */
  description: string
  /** Short name for breadcrumbs, menus and related links. */
  name: string
  /** One line for menus and the guides index. */
  summary: string
  group: 'start' | 'causes' | 'giving'
  eyebrow: string
  h1: string
  lead: string
  panel: { label: string; title: string; body?: string }
  icon: GuideIcon
  facts?: { value: string; label: string; icon: FactIcon }[]
  checklist?: { heading: string; items: string[] }
  sections: GuideSection[]
  steps?: { heading: string; items: { title: string; body: string }[] }
  callout?: { heading: string; body: string }
  faqs: { question: string; answer: string }[]
  /** Other guides or site pages, by path. */
  related: string[]
  primaryAction: { label: string; action: GuideAction }
  secondaryAction?: { label: string; action: GuideAction }
  /** Date the content last changed (YYYY-MM-DD); sitemap.xml repeats it. */
  updated: string
}

const UPDATED = '2026-10-02'

const VERIFY_ID = 'a Ghana Card, passport or driver’s licence'
const PLAN_FEES = '5% on Free, 3.5% on Starter, 2% on Pro and Organization, and 1% on Enterprise'
const FOREIGN_CARDS = 'Donations are charged in cedis and the card issuer converts the amount; some cards issued outside Ghana may not be accepted.'
const ON_BEHALF = 'Plans marked “Campaigns on behalf of others” let you name the person you are raising for as the beneficiary. We email them an invitation to confirm, and payouts go to them unless they agree that the funds may be paid to you.'

export const GUIDES: Guide[] = [
  {
    path: '/crowdfunding-ghana',
    title: 'Crowdfunding in Ghana: Raise Money Online | Ujimora',
    description: 'How crowdfunding works in Ghana: verify your ID, start a campaign, share it on WhatsApp and receive donations in cedis by mobile money or card.',
    name: 'Crowdfunding in Ghana',
    summary: 'How online fundraising works here, what it costs and how to choose a platform.',
    group: 'start',
    eyebrow: 'Crowdfunding in Ghana',
    h1: 'Crowdfunding in Ghana, built for how we already give',
    lead: 'Ghanaians have always raised money together: at funerals, in church, through hometown associations and family WhatsApp groups. Ujimora takes that giving online. One campaign page holds the story, the goal and every update, supporters give in cedis by mobile money or card, and everyone can see how much has been raised.',
    panel: { label: 'At a glance', title: 'One page for the cause. Donations in cedis. A total everyone can see.', body: 'Organizers verify their identity before they can create a campaign, and campaigns are screened before they go live.' },
    icon: 'public',
    facts: [
      { value: 'GH₵', label: 'Campaigns raise in cedis', icon: 'payments' },
      { value: 'MoMo + card', label: 'How supporters give', icon: 'phone' },
      { value: '1–5%', label: 'Platform fee, by plan', icon: 'percent' },
      { value: '18+', label: 'Verified organizers', icon: 'verified' },
    ],
    sections: [
      {
        heading: 'What crowdfunding means in Ghana',
        paragraphs: [
          'Crowdfunding is raising money from many people, each giving what they can, towards one clear goal. In Ghana the idea is not new. Families share the cost of a funeral, congregations build churches one appeal at a time, and old students’ associations fix up their schools. What changes online is the reach and the record-keeping.',
          'A campaign gives your cause one link. Instead of collecting contributions on several phone numbers and keeping a list in a notebook, supporters give on the same page and the total updates by itself. Relatives abroad can give by card, and anyone who gave can come back to read your updates.',
        ],
      },
      {
        heading: 'What people raise money for',
        paragraphs: ['Most campaigns serve one of a handful of causes. Each guide explains how to set one up and what supporters expect to see:'],
        bullets: [
          '[Medical bills and surgery](/medical-fundraising): hospital deposits, treatment and medication',
          '[School fees and education](/education-fundraising): fees, boarding costs, books and school projects',
          '[Funerals](/funeral-fundraising): the mortuary, burial and the costs a family shares',
          '[Church and faith projects](/church-fundraising): buildings, instruments, missions and outreach',
          '[Community projects](/community-fundraising): boreholes, classrooms, clinics and roads',
          '[Emergencies](/emergency-fundraising): fires, floods and accidents',
        ],
      },
      {
        heading: 'How donations reach a campaign',
        paragraphs: [
          'Supporters give in Ghana cedis (GHS). At checkout they choose mobile money (MTN MoMo, Telecel Cash or AT Money) or a debit or credit card, including many cards issued outside Ghana. Payments are processed by Paystack, our regulated payment partner, and a donation counts towards the campaign once the payment is confirmed.',
          'Supporters with an account can also pay from their Ujimora Wallet, and anyone can choose to give anonymously, which hides their name on the campaign.',
        ],
      },
      {
        heading: 'What it costs',
        paragraphs: [
          'Starting a campaign costs nothing upfront on the Free plan, which takes a 5% platform fee from each donation. Paid plans lower the fee: 3.5% on Starter, 2% on Pro and Organization, and 1% on Enterprise. A campaign keeps the fee of the plan you were on when you created it. Payment-processing charges are shown before anyone confirms a payment.',
          'A standard payout to your bank account or mobile money wallet carries no extra Ujimora fee. Optional faster payouts cost more, and the fee is shown before you confirm. See [current plans and fees](/pricing).',
        ],
      },
      {
        heading: 'How to choose a crowdfunding platform in Ghana',
        paragraphs: ['Whichever platform you use, ask these questions before you share a link with family and friends:'],
        bullets: [
          'Can the money be paid out to a Ghanaian bank account or mobile money wallet?',
          'Do organizers have to verify their identity?',
          'Are the fees shown before anyone pays?',
          'Can relatives abroad give by card?',
          'Will supporters see updates and a running total?',
          'Is personal data handled under Ghana’s Data Protection Act, 2012 (Act 843)?',
        ],
        after: ['Ujimora was built around those questions. If a global platform has turned you away, read [why GoFundMe does not pay out in Ghana](/gofundme-alternative-ghana).'],
      },
    ],
    steps: {
      heading: 'Start a campaign in five steps',
      items: [
        { title: 'Create an account and verify your identity', body: `Sign up with your email, then verify your identity with ${VERIFY_ID}. Organizations also submit their registration documents.` },
        { title: 'Write your campaign', body: 'Add a title, category, story, goal and end date, plus a cover photo if your plan includes images. The end date cannot be changed later, so choose it carefully.' },
        { title: 'Pass screening', body: 'Your text is screened before the campaign goes live, by automated safety screening if you allow it or otherwise by our staff. Cover photos are always checked by staff. Some campaigns go live straight away; others wait for staff approval.' },
        { title: 'Share it everywhere', body: 'Post the link in WhatsApp groups, announce it in church and print the campaign’s QR code on posters and programmes.' },
        { title: 'Update supporters and request your payout', body: 'Post updates as things happen. When donations have cleared, request a payout to your bank account or mobile money wallet.' },
      ],
    },
    callout: {
      heading: 'Read before you give',
      body: 'We verify organizers and screen campaigns, but screening cannot confirm every claim. Read the story, check who the organizer is and look at the updates. [See how we keep giving safe](/trust-and-safety).',
    },
    faqs: [
      { question: 'Is crowdfunding legal in Ghana?', answer: 'Ujimora runs donation-based fundraising: supporters give without expecting money back. Investment, loan and equity crowdfunding, which promise a financial return, are not allowed on Ujimora; in Ghana those are regulated by the Securities and Exchange Commission.' },
      { question: 'Can I start a campaign if I live outside Ghana?', answer: 'Campaign creation is open to organizers based in Ghana. If you live abroad, a relative or organization in Ghana can start the campaign, and you can share it and give from abroad.' },
      { question: 'How much does Ujimora charge?', answer: `The platform fee depends on your plan: ${PLAN_FEES}. Payment-processing and optional payout fees are shown before you confirm a transaction.` },
      { question: 'How do I receive the money?', answer: 'Once donations have cleared and the usual verification checks are done, you request a payout to your bank account or mobile money wallet from your dashboard. Payout times depend on the payment provider and are not guaranteed.' },
      { question: 'What happens if I do not reach my goal?', answer: 'Your goal is a target, not an all-or-nothing condition. Donations are not refunded automatically when a campaign misses its goal; cleared funds remain payable after the usual checks.' },
      { question: 'Can supporters give anonymously?', answer: 'Yes. A supporter can choose to give anonymously, which hides their name on the campaign.' },
    ],
    related: ['/start-a-fundraiser', '/how-it-works', '/donate-to-ghana-from-abroad', '/mobile-money-donations', '/trust-and-safety', '/gofundme-alternative-ghana'],
    primaryAction: { label: 'Start a campaign', action: 'start' },
    secondaryAction: { label: 'Browse campaigns', action: 'explore' },
    updated: UPDATED,
  },
  {
    path: '/how-it-works',
    title: 'How Ujimora Works: Campaigns, Donations and Payouts',
    description: 'How Ujimora works: organizers verify their ID, campaigns are screened before going live, supporters give by MoMo or card, and payouts go to bank or MoMo.',
    name: 'How Ujimora works',
    summary: 'What happens at each stage, for organizers and for supporters.',
    group: 'start',
    eyebrow: 'How it works',
    h1: 'How Ujimora works, from first story to payout',
    lead: 'Ujimora connects people raising money for a cause in Ghana with the family, friends and strangers who want to help. Here is what happens at each stage, for the person running a campaign and for the people giving to it, including the limits of what we check.',
    panel: { label: 'Three commitments', title: 'Verified organizers. Screened campaigns. Payouts after checks.', body: 'Each is explained below, along with what it does not cover.' },
    icon: 'timeline',
    sections: [
      {
        heading: 'For organizers: running a campaign',
        paragraphs: [
          `Anyone 18 or older who is based in Ghana can organize a campaign after verifying their identity with ${VERIFY_ID}. Churches, schools, NGOs and associations register as organizations and verify with their registration documents, which opens a shared workspace for their team.`,
          'You write the campaign once: title, category, story, the people it benefits, the goal and an end date. After you submit, the story, images, goal and end date cannot be edited, so it is worth taking your time. You can keep posting updates, which everyone following the campaign sees, and you can change the campaign link.',
        ],
      },
      {
        heading: 'Screening before a campaign goes live',
        paragraphs: [
          'A campaign’s text is screened before it is published, by automated safety screening if the organizer allows it, or otherwise by our staff. Cover photos and videos are always checked by staff. Depending on the goal and our review settings, a campaign then goes live straight away or waits for staff approval. Goals above GH₵250,000 need staff approval unless the organizer is currently verified and has published a campaign before.',
          'There is no fixed review time. Screening looks for unsafe and prohibited content; it does not confirm every claim in a story.',
        ],
      },
      {
        heading: 'For supporters: giving to a campaign',
        paragraphs: [
          'Open a campaign, choose an amount and pay by mobile money or card. You do not need an account to give, although signing in keeps your donations in one place and lets you request a refund review from your donation history. Every amount is in Ghana cedis.',
          'A donation counts towards the campaign once the payment provider confirms it. You can give anonymously, and you will see the organizer’s updates on the campaign page as the cause moves forward.',
        ],
      },
      {
        heading: 'Payouts: how the money reaches the cause',
        paragraphs: [
          'Raised is not the same as withdrawable. Before a payout, contributions must clear, the campaign is reconciled against payment records, and the person being paid must be verified. Payouts go to a bank account or a mobile money wallet in Ghana.',
          'A standard payout carries no extra Ujimora fee. Optional priority, early and assisted payouts are available where enabled, each with a fee shown before you confirm. Submitting a request does not guarantee a payment date, because provider processing and checks take time.',
        ],
      },
      {
        heading: 'What Ujimora does not do',
        paragraphs: ['Being clear about the limits is part of being trustworthy:'],
        bullets: [
          'We do not guarantee that a campaign will reach its goal, or that every claim in a story is true.',
          'Campaigns are not all-or-nothing: donations are not refunded automatically when a goal is missed.',
          'We do not offer investment, loan or equity crowdfunding.',
          'We do not store card details; the payment provider handles them.',
        ],
      },
    ],
    faqs: [
      { question: 'How long does it take for a campaign to go live?', answer: 'There is no fixed review time. Many campaigns go live as soon as screening finishes; others, such as those with photos or videos, or goals above GH₵250,000 from organizers without a previously published campaign, wait for staff approval.' },
      { question: 'Can I edit my campaign after it goes live?', answer: 'Not at the moment. After you submit, the story, images, goal and end date cannot be changed. You can post updates and change your campaign link. If something material changes, such as the purpose or who benefits, post an update and contact support.' },
      { question: 'How long can a campaign run?', answer: 'You choose the end date when you create the campaign; it can be any future date, and we suggest 30 to 60 days. The end date cannot be changed later, and a campaign that reaches its goal early keeps accepting donations until then.' },
      { question: 'Does Ujimora store my card details?', answer: 'No. Card details are handled by the payment provider rather than stored by Ujimora.' },
      { question: 'Can I get a refund on a donation?', answer: 'You can request a refund review from your donation history, or contact support about a guest payment. Requests are reviewed against the refund policy, applicable law and provider rules; approval is not automatic.' },
    ],
    related: ['/start-a-fundraiser', '/trust-and-safety', '/mobile-money-donations', '/crowdfunding-ghana', '/pricing', '/help'],
    primaryAction: { label: 'Start a campaign', action: 'start' },
    secondaryAction: { label: 'Browse campaigns', action: 'explore' },
    updated: UPDATED,
  },
  {
    path: '/start-a-fundraiser',
    title: 'How to Start a Fundraiser in Ghana, Step by Step | Ujimora',
    description: 'Start a fundraiser in Ghana: verify your ID, write a clear story, set a realistic goal and end date, share it on WhatsApp and keep supporters updated.',
    name: 'Start a fundraiser',
    summary: 'A step-by-step guide from verifying your ID to your first payout.',
    group: 'start',
    eyebrow: 'Step-by-step guide',
    h1: 'How to start a fundraiser in Ghana',
    lead: 'A good fundraiser answers three questions in the first minute: who needs help, how much is needed and what the money will pay for. This guide walks you through setting one up on Ujimora, from verifying your identity to your first payout, with practical tips at each step.',
    panel: { label: 'Before you begin', title: 'Have your ID, your payout details and a cost breakdown ready.', body: 'Ten minutes of preparation saves days of answering the same questions from supporters.' },
    icon: 'flag',
    checklist: {
      heading: 'What you need before you start',
      items: [
        `${VERIFY_ID.charAt(0).toUpperCase()}${VERIFY_ID.slice(1)} for identity verification`,
        'A bank account or mobile money wallet in your name for payouts',
        'A cost breakdown: a hospital estimate, fee bill, quotation or budget',
        'Permission from the person you are raising money for, if it is not you',
        'One or two clear photos, if your plan includes images',
      ],
    },
    sections: [
      {
        heading: 'Write a story people trust',
        paragraphs: [
          'Open with the need in one sentence, for example: “Ama needs GH₵18,000 for a kidney operation by 30 November.” Then explain who you are and how you are connected, what has happened so far, and exactly what the money will pay for. Specific numbers build trust; vague appeals do not.',
          'Keep private details private. Share what supporters need to understand the cause, not full medical records, ID numbers or account details. If the campaign is for someone else, agree with them what you will say.',
        ],
      },
      {
        heading: 'Set a realistic goal and end date',
        paragraphs: [
          'Base your goal on the real cost, plus a small allowance for the platform fee and payment-processing charges. A goal people can see is achievable attracts more support than an inflated one.',
          'Choose the end date with care. It can be any future date, but it cannot be changed after you submit. We suggest 30 to 60 days. If you need the money by a deadline, such as a hospital date or school reopening, end the campaign a week or two before it so there is time to request a payout.',
          'Each plan sets the largest goal you can choose, and goals above GH₵250,000 need staff approval unless you are currently verified and have published a campaign before.',
        ],
      },
      {
        heading: 'Pick the right plan',
        paragraphs: [
          'You can start on the Free plan, which takes a 5% platform fee from each donation. Paid plans lower the fee to 3.5%, 2% or 1%, allow more active campaigns and higher goals, and add tools such as team collaboration and live fundraising on the larger plans. A campaign keeps the fee of the plan you were on when you created it, so choose your plan before you submit. [Compare plans](/pricing).',
        ],
      },
      {
        heading: 'Share it where your supporters already are',
        paragraphs: [
          'Your first supporters are usually people who already know you. Share the link in family and alumni WhatsApp groups and on your social media, and call the people who prefer to be asked directly. In church and at events, show the campaign’s QR code so people can give from their phones on the spot.',
          'Ask a few close friends to share it too. Each new circle of family, colleagues and church members reaches people you could not reach alone, including relatives abroad who can give by card.',
        ],
      },
      {
        heading: 'Keep supporters updated',
        paragraphs: [
          'Post an update when something changes: a milestone reached, an operation done, fees paid. Updates reach everyone following the campaign and show that their money is doing what you said it would. When the campaign is over, a thank-you message to your donors closes the loop.',
        ],
      },
      {
        heading: 'Request your payout',
        paragraphs: [
          'When donations have cleared, request a payout from your dashboard to your bank account or mobile money wallet. Payouts follow verification and reconciliation checks, and timing depends on the payment provider. If you need funds before the campaign ends, an optional early payout may be available for a fee shown before you confirm.',
        ],
      },
    ],
    steps: {
      heading: 'The steps at a glance',
      items: [
        { title: 'Sign up and verify your identity', body: `Create an account with your email, then verify with ${VERIFY_ID}.` },
        { title: 'Start a campaign', body: 'Choose a title, a category and the people it benefits, then write your story.' },
        { title: 'Set your goal and end date', body: 'Use the real cost. The goal and end date cannot be changed after you submit.' },
        { title: 'Add a cover photo', body: 'If your plan includes images. Photos are checked by staff before the campaign goes live.' },
        { title: 'Submit for screening', body: 'Your text is screened, then the campaign goes live straight away or after staff approval. There is no fixed review time.' },
        { title: 'Share, update and get paid', body: 'Share the link and QR code, post updates, and request payouts once donations have cleared.' },
      ],
    },
    faqs: [
      { question: 'How much does it cost to start a fundraiser?', answer: 'Nothing upfront on the Free plan. Ujimora takes a platform fee from each donation, 5% on Free and less on paid plans, and payment-processing charges are shown before anyone pays.' },
      { question: 'Do I need a Ghana Card to start a fundraiser?', answer: 'You need to verify your identity with a government ID. A Ghana Card works, and so does a passport or driver’s licence.' },
      { question: 'Can I start a fundraiser for someone else?', answer: `Yes, with their permission. Describe who benefits in your campaign and use the funds as the story says. ${ON_BEHALF}` },
      { question: 'How long does approval take?', answer: 'There is no fixed review time. Depending on your goal and whether your campaign has photos or videos, it goes live straight away after screening or waits for staff approval.' },
      { question: 'Can I change my goal after the campaign starts?', answer: 'No. After you submit, the goal, story, images and end date cannot be edited. Post an update if circumstances change, and contact support if something material changes.' },
      { question: 'What if I raise more than my goal?', answer: 'A campaign that reaches its goal keeps accepting donations until its end date. Tell supporters in an update how any extra money will be used.' },
    ],
    related: ['/how-it-works', '/crowdfunding-ghana', '/medical-fundraising', '/education-fundraising', '/funeral-fundraising', '/pricing'],
    primaryAction: { label: 'Start your fundraiser', action: 'start' },
    secondaryAction: { label: 'Compare plans', action: 'pricing' },
    updated: UPDATED,
  },
  {
    path: '/medical-fundraising',
    title: 'Medical Fundraising in Ghana: Hospital Bills & Surgery',
    description: 'Raise money for surgery, treatment and hospital bills in Ghana. Share one campaign with family, church and friends abroad, who give by MoMo or card.',
    name: 'Medical fundraising',
    summary: 'Raise money for surgery, treatment and hospital bills.',
    group: 'causes',
    eyebrow: 'Medical fundraising',
    h1: 'Raise money for medical bills in Ghana',
    lead: 'When a hospital asks for a deposit before surgery, or treatment runs on for months, families usually start calling relatives one by one. A medical fundraiser on Ujimora puts the need, the costs and every update on one page that you can share in WhatsApp groups, at church and with relatives abroad, who can give by mobile money or card.',
    panel: { label: 'Medical campaigns', title: 'One link for the whole family to give to, wherever they live.', body: 'Medical claims can receive enhanced review, so keep the hospital’s estimate to hand.' },
    icon: 'medical',
    facts: [
      { value: 'MoMo + card', label: 'Ways supporters give', icon: 'phone' },
      { value: 'GH₵', label: 'Raised and paid out in cedis', icon: 'payments' },
      { value: 'Bank or MoMo', label: 'Where payouts go', icon: 'bank' },
      { value: 'Updates', label: 'Keep supporters informed', icon: 'campaign' },
    ],
    sections: [
      {
        heading: 'What a medical fundraiser can pay for',
        paragraphs: ['Supporters give more readily when they can see exactly what their money covers. A medical campaign can raise money for:'],
        bullets: [
          'Surgery, and the deposit a hospital asks for before admission',
          'Cancer treatment, dialysis and other long-term care',
          'Medication, tests and scans',
          'Maternity and newborn care',
          'Physiotherapy and recovery',
          'Travel and accommodation for treatment away from home',
        ],
      },
      {
        heading: 'Write a medical story donors can trust',
        paragraphs: [
          'Explain the diagnosis in plain words, the treatment the doctors recommend and the total cost, broken down where you can: the hospital’s estimate, the deposit, medication and recovery. Say who you are, how you are related to the patient and when the money is needed.',
          'Medical and emergency claims can receive enhanced review, and our staff may ask for supporting documents such as a hospital estimate. Keep these to hand, but do not post full medical records or ID numbers on the public page.',
        ],
      },
      {
        heading: 'Respect the patient’s privacy and consent',
        paragraphs: [
          'Get the patient’s permission before you share their story, and agree what you will say. For a child, the parent or guardian should agree. Share only what supporters need to understand the need.',
          `If you are raising money for someone else, describe who benefits and use the funds as the story says. ${ON_BEHALF}`,
        ],
      },
      {
        heading: 'Plan the payout around the hospital’s deadline',
        paragraphs: [
          'Donations count once the payment provider confirms them, and payouts go to a bank account or mobile money wallet after verification and reconciliation checks. Provider processing takes time and no payout date is guaranteed, so start the campaign as early as you can.',
          'If treatment cannot wait for the end date, an optional early payout may be available, with its fee and the amount you will receive shown before you confirm.',
        ],
      },
      {
        heading: 'Keep supporters with you',
        paragraphs: [
          'Post an update after each step: admission, surgery, discharge, the next round of treatment. People who gave want to know how the patient is doing, and updates bring in new support. When the campaign ends, send your donors a thank-you message.',
        ],
      },
    ],
    steps: {
      heading: 'Set up a medical fundraiser',
      items: [
        { title: 'Get the cost in writing', body: 'Ask the hospital for an estimate or quotation, and agree with the patient what to share.' },
        { title: 'Verify your identity', body: `Sign up and verify with ${VERIFY_ID}.` },
        { title: 'Create the campaign', body: 'Choose the Medical category, write the story and set a goal that matches the estimate.' },
        { title: 'Share it widely', body: 'Send the link to family WhatsApp groups and relatives abroad, and show the QR code at church.' },
        { title: 'Update and request payouts', body: 'Post updates as treatment progresses, and request payouts once donations have cleared.' },
      ],
    },
    faqs: [
      { question: 'Can I raise money for someone else’s surgery?', answer: 'Yes, with their permission, or a parent’s or guardian’s for a child. Describe who benefits and use the funds as the story says. Plans marked “Campaigns on behalf of others” let you name the patient as the beneficiary, who confirms by email and receives the payouts.' },
      { question: 'Does Ujimora check medical campaigns?', answer: 'Every organizer verifies their identity, and every campaign is screened before it goes live. Medical claims can receive enhanced review, and staff may ask for supporting documents. Screening cannot confirm every claim, so supporters should still read the campaign before giving.' },
      { question: 'How quickly can I get the money?', answer: 'Donations count as soon as the payment provider confirms them. Payouts follow verification and reconciliation checks, and provider timing varies, so no date is guaranteed. Optional early payouts may be available for a fee shown before you confirm.' },
      { question: 'Can relatives abroad donate to a medical campaign?', answer: `Yes, by debit or credit card. ${FOREIGN_CARDS}` },
      { question: 'What if the treatment plan changes?', answer: 'The story and goal cannot be edited after you submit, so post an update explaining the change. If the purpose of the money changes, contact support as well.' },
    ],
    related: ['/start-a-fundraiser', '/emergency-fundraising', '/donate-to-ghana-from-abroad', '/trust-and-safety', '/mobile-money-donations', '/crowdfunding-ghana'],
    primaryAction: { label: 'Start a medical fundraiser', action: 'start' },
    secondaryAction: { label: 'Browse campaigns', action: 'explore' },
    updated: UPDATED,
  },
  {
    path: '/funeral-fundraising',
    title: 'Funeral Fundraising in Ghana: Collect Donations Online',
    description: 'Collect funeral donations online in Ghana. Family at home and abroad give by MoMo or card to one campaign, and everyone can see what has been raised.',
    name: 'Funeral fundraising',
    summary: 'Collect funeral contributions from family at home and abroad.',
    group: 'causes',
    eyebrow: 'Funeral fundraising',
    h1: 'Funeral fundraising for Ghanaian families',
    lead: 'A Ghanaian funeral brings the whole family together, and so do its costs: the mortuary, the coffin, the venue, food, printing and the one-week observance. Instead of chasing contributions on many phone numbers, one funeral fundraiser lets relatives at home and abroad give to the same place, by mobile money or card, and see what has been raised.',
    panel: { label: 'For the family', title: 'One link in the family WhatsApp group. One total everyone can see.', body: 'Print the campaign’s QR code on the funeral programme so mourners can give on the day.' },
    icon: 'funeral',
    sections: [
      {
        heading: 'What a funeral fundraiser can cover',
        paragraphs: ['Families usually raise money for some or all of these:'],
        bullets: [
          'Mortuary and preservation fees',
          'The coffin, burial and cemetery costs',
          'Canopies, chairs, sound and the venue',
          'Food and drinks for mourners',
          'Printing: posters, banners and funeral programmes',
          'Transport for the family and the body',
        ],
      },
      {
        heading: 'Agree who manages the money',
        paragraphs: [
          'Before you share anything, agree as a family who will organize the campaign. That person verifies their identity, receives the payouts to their bank account or mobile money wallet, and accounts for the money. Say clearly in the story who is organizing and who the funds are for, such as the family of the deceased.',
          'If the funds should go to someone else, such as a surviving spouse, plans marked “Campaigns on behalf of others” let you name them as the beneficiary. They confirm by email, and payouts go to them.',
        ],
      },
      {
        heading: 'Bring in relatives abroad',
        paragraphs: [
          'Family members in the UK, the US, Europe or elsewhere can give by debit or credit card. Donations are charged in cedis and their bank converts the amount. Some cards issued outside Ghana may not be accepted, so suggest trying another card if a payment fails.',
          'Share the link in the family WhatsApp group early, so relatives abroad can give before the funeral rather than sending money through several people.',
        ],
      },
      {
        heading: 'Be open about the totals',
        paragraphs: [
          'The campaign page shows how much has been raised. Post updates as arrangements are made, and after the funeral share a short account of how the money was used. Anyone who prefers to give quietly can give anonymously, which hides their name on the campaign.',
          'When it is all over, a thank-you message to everyone who gave is a fitting close.',
        ],
      },
    ],
    steps: {
      heading: 'Set up a funeral fundraiser',
      items: [
        { title: 'Agree on an organizer', body: 'Choose one trusted family member to organize, verify and receive the payouts.' },
        { title: 'Estimate the costs', body: 'List the main costs so you can set an honest goal.' },
        { title: 'Create the campaign', body: 'Explain whose funeral it is, the dates and what the money will pay for.' },
        { title: 'Share the link and QR code', body: 'Post it in family groups and print the QR code on posters and programmes.' },
        { title: 'Update and thank', body: 'Post updates as arrangements are made, and thank your donors afterwards.' },
      ],
    },
    faqs: [
      { question: 'Can I collect funeral donations online in Ghana?', answer: 'Yes. A verified organizer can start a campaign for the funeral costs and share it with family and friends, who give by mobile money or card. Payouts go to the organizer’s bank account or mobile money wallet after the usual checks.' },
      { question: 'Can I put a QR code on the funeral programme?', answer: 'Yes. Every campaign has a share link and a QR code. Print the QR code on posters, banners or the programme so mourners can give from their phones.' },
      { question: 'Can relatives abroad contribute to the funeral?', answer: `Yes, by debit or credit card. ${FOREIGN_CARDS}` },
      { question: 'Can we keep collecting after the funeral?', answer: 'A campaign accepts donations until the end date you set. The end date cannot be changed later, so allow time after the funeral for late contributions and outstanding bills.' },
      { question: 'What does a funeral fundraiser cost?', answer: 'Starting a campaign costs nothing upfront on the Free plan, which takes a 5% platform fee from each donation; paid plans have lower fees. Payment-processing charges are shown before anyone pays.' },
    ],
    related: ['/donate-to-ghana-from-abroad', '/mobile-money-donations', '/start-a-fundraiser', '/emergency-fundraising', '/crowdfunding-ghana', '/trust-and-safety'],
    primaryAction: { label: 'Start a funeral fundraiser', action: 'start' },
    secondaryAction: { label: 'Browse campaigns', action: 'explore' },
    updated: UPDATED,
  },
  {
    path: '/education-fundraising',
    title: 'School Fees Fundraising in Ghana: Raise Money for Education',
    description: 'Raise money for school fees, university fees, books and school projects in Ghana. Share one campaign with family and alumni, who give by MoMo or card.',
    name: 'School fees and education',
    summary: 'Raise money for school or university fees, books and school projects.',
    group: 'causes',
    eyebrow: 'Education fundraising',
    h1: 'Raise money for school fees and education in Ghana',
    lead: 'A fee bill can arrive just as a family’s money runs out, and a bright student can lose a year waiting. An education fundraiser on Ujimora lets family, old students and friends abroad chip in towards fees, boarding, books or a laptop, all on one page with updates on the student’s progress.',
    panel: { label: 'Education campaigns', title: 'Fees paid on time. A student who stays in school.', body: 'End the campaign a week or two before fees are due, so there is time to request a payout.' },
    icon: 'school',
    sections: [
      {
        heading: 'What an education fundraiser can cover',
        paragraphs: ['An education campaign can raise money for one student or for a whole school:'],
        bullets: [
          'School and university fees',
          'Boarding, hostel and feeding costs',
          'Books, uniforms and a laptop',
          'Exam and registration fees',
          'Scholarships for students from your community',
          'School projects: a library, a classroom block or a computer lab',
        ],
      },
      {
        heading: 'Show supporters the student behind the story',
        paragraphs: [
          'Say who the student is, what they are studying and what they hope to do, with the amounts from the fee bill or admission letter and the date they are due. Supporters respond to a clear plan: how much is needed, by when, and what happens next.',
          'Campaigns for children need extra care. A parent or guardian should organize or agree to the campaign, and you should share only what supporters need to know. Campaigns involving minors can receive enhanced review.',
        ],
      },
      {
        heading: 'Old students, alumni and churches',
        paragraphs: [
          'Old students’ associations, alumni groups and churches often fund scholarships or school projects together. A group can organize as an organization, verified with its registration documents, or a verified member can organize on the group’s behalf.',
          'Share the campaign in year-group WhatsApp chats and at homecoming events. Alumni abroad can give by card.',
        ],
      },
      {
        heading: 'Paying the school',
        paragraphs: [
          'Payouts go to the organizer’s or beneficiary’s bank account or mobile money wallet after the usual checks, and you then pay the school. Post an update confirming that the fees were paid, with personal details covered, so supporters can see the result.',
        ],
      },
    ],
    steps: {
      heading: 'Set up an education fundraiser',
      items: [
        { title: 'Get the fee bill', body: 'Have the admission letter or fee bill to hand, and the date the fees are due.' },
        { title: 'Verify your identity', body: `Sign up and verify with ${VERIFY_ID}.` },
        { title: 'Create the campaign', body: 'Choose the Education category and set the goal to the amount on the bill.' },
        { title: 'Share with your circles', body: 'Family, alumni groups, church and colleagues: each circle reaches new supporters.' },
        { title: 'Pay the fees and post an update', body: 'Request your payout, pay the school and show supporters it is done.' },
      ],
    },
    faqs: [
      { question: 'Can I raise money for my child’s school fees?', answer: 'Yes. As a parent or guardian you can organize an education campaign after verifying your identity, then share it with family and friends.' },
      { question: 'Can a school raise money for a project?', answer: 'Yes. Schools register as organizations, verify with their registration documents and can then run campaigns for projects such as a library or a classroom block.' },
      { question: 'Can an old students’ association use Ujimora?', answer: 'Yes. Register the association as an organization, or have a verified member organize the campaign for the group.' },
      { question: 'Can people abroad help pay school fees?', answer: `Yes, by debit or credit card. ${FOREIGN_CARDS}` },
      { question: 'How long should an education campaign run?', answer: 'We suggest 30 to 60 days, ending a week or two before the fees are due so there is time to request a payout. The end date cannot be changed after you submit.' },
    ],
    related: ['/start-a-fundraiser', '/community-fundraising', '/church-fundraising', '/donate-to-ghana-from-abroad', '/for-organizations', '/crowdfunding-ghana'],
    primaryAction: { label: 'Start an education fundraiser', action: 'start' },
    secondaryAction: { label: 'Browse campaigns', action: 'explore' },
    updated: UPDATED,
  },
  {
    path: '/church-fundraising',
    title: 'Church Fundraising in Ghana: Raise Funds Online | Ujimora',
    description: 'Raise funds for church buildings, harvests, missions and outreach in Ghana. Members at home and abroad give by MoMo or card, with updates at every stage.',
    name: 'Church and faith fundraising',
    summary: 'Buildings, instruments, missions and appeals, with members giving from anywhere.',
    group: 'causes',
    eyebrow: 'Church and faith fundraising',
    h1: 'Church fundraising in Ghana, online and accountable',
    lead: 'Churches across Ghana fund buildings, instruments, missions and outreach through the generosity of their members, often over many years. A campaign on Ujimora gives each project one page: the goal, the progress and updates from the project committee, with members at home and abroad able to give by mobile money or card.',
    panel: { label: 'For congregations', title: 'Show the QR code during service. Members give from their phones.', body: 'Members abroad can give by card and follow the project through updates.' },
    icon: 'church',
    sections: [
      {
        heading: 'Projects churches raise money for',
        bullets: [
          'Building, roofing and renovation',
          'Instruments, sound systems and chairs',
          'A church bus or vehicle',
          'Missions, evangelism and outreach',
          'Welfare support for members in need',
          'Harvests and special appeals',
        ],
      },
      {
        heading: 'Set the church up as an organization',
        paragraphs: [
          'Register the church as an organization and verify it with its registration documents. Once verified, it can run campaigns in its own name, and verified organizations show a badge that helps members and visitors judge credibility.',
          'Plans with team collaboration let the pastor, the treasurer and the project committee manage campaigns together from a shared workspace, so no single phone holds the records. [See organization tools](/for-organizations).',
        ],
      },
      {
        heading: 'Bring it into the service',
        paragraphs: [
          'Announce the campaign from the pulpit and put its QR code on the screen or in the bulletin, so members can give from their phones on the spot. Share the link in church WhatsApp groups and on the church’s social media.',
          'Members who are travelling, unwell or living abroad can give from wherever they are, by mobile money or by debit or credit card.',
        ],
      },
      {
        heading: 'Report back to the congregation',
        paragraphs: [
          'Post updates as the project moves forward: the foundation laid, the roof on, the instruments delivered. Photos of progress show members that their giving is working. Members who prefer not to be named can give anonymously.',
        ],
      },
    ],
    steps: {
      heading: 'Run a church campaign',
      items: [
        { title: 'Register and verify the church', body: 'Create an organization account and submit the church’s registration documents.' },
        { title: 'Plan the project', body: 'Agree the goal from quotations, and a timeline, with the committee.' },
        { title: 'Create the campaign', body: 'Choose the Religious category and describe the project clearly.' },
        { title: 'Launch it in service', body: 'Announce it, show the QR code and share the link in church groups.' },
        { title: 'Post progress updates', body: 'Report each stage, with photos, until the project is complete.' },
      ],
    },
    faqs: [
      { question: 'Can a church open an account on Ujimora?', answer: 'Yes. Register as an organization, provide the church’s registration details and complete verification with its documents before creating campaigns.' },
      { question: 'Can several church officers manage a campaign?', answer: 'Yes, on plans that include team collaboration. Officers share a workspace to prepare campaigns, post updates and follow donations.' },
      { question: 'Can we show a QR code during the service?', answer: 'Yes. Every campaign has a QR code and a share link you can show on screen, print or post.' },
      { question: 'Can members give anonymously?', answer: 'Yes. A member can choose to give anonymously, which hides their name on the campaign.' },
      { question: 'Is Ujimora suitable for weekly offerings or tithes?', answer: 'Ujimora is built for campaigns with a goal and an end date, such as a building project or a special appeal, rather than recurring weekly giving.' },
      { question: 'What does it cost a church?', answer: 'The platform fee depends on the plan, for example 2% on the Organization plan. Payment-processing charges are shown before anyone pays.' },
    ],
    related: ['/for-organizations', '/community-fundraising', '/education-fundraising', '/mobile-money-donations', '/donate-to-ghana-from-abroad', '/pricing'],
    primaryAction: { label: 'Start a church campaign', action: 'start' },
    secondaryAction: { label: 'Organization tools', action: 'organizations' },
    updated: UPDATED,
  },
  {
    path: '/community-fundraising',
    title: 'Fundraising for Community Projects in Ghana | Ujimora',
    description: 'Fund boreholes, classrooms, clinics and roads in Ghana. Hometown and development associations raise money together, with MoMo and card giving and updates.',
    name: 'Community projects',
    summary: 'Boreholes, classrooms, clinics and roads, funded together.',
    group: 'causes',
    eyebrow: 'Community fundraising',
    h1: 'Raise money for community projects in Ghana',
    lead: 'Hometown associations, youth groups and sons and daughters abroad have long pooled money for boreholes, school blocks and clinics. A community campaign on Ujimora gives the project one public page: the plan, the budget, the progress and a running total, with contributions by mobile money or card from home and abroad.',
    panel: { label: 'Community projects', title: 'A shared goal, a public total and progress everyone can follow.', body: 'Organize as a registered association or through a verified member.' },
    icon: 'community',
    sections: [
      {
        heading: 'Projects communities fund',
        bullets: [
          'Boreholes, water tanks and sanitation',
          'Classroom blocks, libraries and teachers’ quarters',
          'Clinic equipment and health outreach',
          'Street lights, culverts and access roads',
          'Scholarships for students from the community',
          'Community centres and festival projects',
        ],
      },
      {
        heading: 'Plan the project before you raise',
        paragraphs: [
          'Get quotations, agree a budget and decide what happens in each phase. A campaign with a costed plan, such as “GH₵45,000 to drill and mechanise a borehole for the town, with work starting in January”, earns far more trust than a general appeal.',
          'Large projects can run in phases, each with its own campaign and goal, so supporters can see one stage finished before the next begins.',
        ],
      },
      {
        heading: 'Who should organize',
        paragraphs: [
          'A registered association, NGO or development committee can organize as an organization after verifying with its registration documents, and on plans with team collaboration its officers can share a workspace. Otherwise, a trusted member verifies their identity and organizes on the community’s behalf.',
          'On eligible plans, a campaign can also split its proceeds between several named beneficiaries by percentage. Each beneficiary must be verified before they can be paid, and the split is locked once donations start.',
        ],
      },
      {
        heading: 'Bring in sons and daughters abroad',
        paragraphs: [
          'Members of the community living abroad are often the most committed supporters of hometown projects. They can give by debit or credit card, and donations are charged in cedis. Share the link in diaspora association groups and at their meetings.',
        ],
      },
      {
        heading: 'Show the work',
        paragraphs: [
          'Post updates with photos as the project progresses: the site cleared, the walls up, water flowing. When the project is finished, a final update and a thank-you message to donors close the loop and make the next appeal easier.',
        ],
      },
    ],
    steps: {
      heading: 'Run a community campaign',
      items: [
        { title: 'Agree the project and budget', body: 'Get quotations and agree the plan with the community’s leadership.' },
        { title: 'Choose the organizer', body: 'A registered association verifies as an organization, or a trusted member verifies as an individual.' },
        { title: 'Create the campaign', body: 'Choose the Community category, explain the plan and set the goal from the budget.' },
        { title: 'Share at home and abroad', body: 'Post in community and diaspora groups, and announce it at meetings and events.' },
        { title: 'Update with photos', body: 'Report progress at each phase until the project is complete.' },
      ],
    },
    faqs: [
      { question: 'Can a hometown association raise money on Ujimora?', answer: 'Yes. Register the association as an organization with its registration documents, or have a verified member organize the campaign on its behalf.' },
      { question: 'How do we show donors the money was used well?', answer: 'Post updates with photos and receipts, with personal details covered, at each stage, and send a thank-you message when the project is complete.' },
      { question: 'Can the money be shared between several beneficiaries?', answer: 'On eligible plans, a campaign can split its proceeds by percentage between named beneficiaries. Each beneficiary must be verified, and the split is locked once donations start.' },
      { question: 'Can people outside Ghana contribute?', answer: `Yes, by debit or credit card. ${FOREIGN_CARDS}` },
      { question: 'Is there a limit on how much we can raise?', answer: 'Each plan sets a maximum goal, and goals above GH₵250,000 need staff approval unless the organizer is currently verified and has published a campaign before.' },
    ],
    related: ['/church-fundraising', '/education-fundraising', '/emergency-fundraising', '/donate-to-ghana-from-abroad', '/for-organizations', '/start-a-fundraiser'],
    primaryAction: { label: 'Start a community campaign', action: 'start' },
    secondaryAction: { label: 'Organization tools', action: 'organizations' },
    updated: UPDATED,
  },
  {
    path: '/emergency-fundraising',
    title: 'Emergency Fundraising in Ghana: Fires, Floods & Accidents',
    description: 'Raise money for urgent needs after a fire, flood or accident in Ghana. Start a campaign, share it widely and receive donations by MoMo or card.',
    name: 'Emergency fundraising',
    summary: 'Urgent help after a fire, flood or accident.',
    group: 'causes',
    eyebrow: 'Emergency fundraising',
    h1: 'Emergency fundraising for fires, floods and accidents',
    lead: 'A house fire, a flood or a road accident can leave a family with nothing overnight. An emergency fundraiser on Ujimora lets you tell people what happened and what is needed right now, then share one link that friends, colleagues and relatives abroad can give to by mobile money or card.',
    panel: { label: 'Urgent needs', title: 'Tell people what happened. Show what is needed. Share one link.', body: 'Emergency claims can receive enhanced review, so keep any reports or photos to hand.' },
    icon: 'emergency',
    sections: [
      {
        heading: 'What an emergency fundraiser can cover',
        bullets: [
          'Shelter, food and clothing after a fire or flood',
          'Rebuilding or repairing a home',
          'Hospital bills after an accident',
          'Replacing the tools or stock someone needs to earn a living',
          'Support for a community hit by a disaster',
        ],
      },
      {
        heading: 'Move fast, but tell the truth',
        paragraphs: [
          'In an emergency it is tempting to share a few lines and a photo. Take ten more minutes to say what happened, when and where, who is affected and what the money will pay for first. Clear, specific campaigns are easier for people to trust and to share.',
          'Emergency claims can receive enhanced review, and our staff may ask for supporting evidence, such as a fire service or police report, or photos of the damage. Keeping them ready avoids delays.',
        ],
      },
      {
        heading: 'Getting money to where it is needed',
        paragraphs: [
          'Payouts go to a bank account or mobile money wallet after verification and reconciliation checks, and provider timing varies, so no payout date is guaranteed. Where available, optional early and urgent payouts let you withdraw part of the cleared funds before the campaign ends, for a fee shown before you confirm.',
        ],
      },
      {
        heading: 'When more comes in than you need',
        paragraphs: [
          'A campaign keeps accepting donations until its end date, even after the goal is reached. If generosity outruns the need, tell supporters in an update how the extra will be used, and contact support if the purpose of the money changes.',
        ],
      },
    ],
    steps: {
      heading: 'Start an emergency fundraiser',
      items: [
        { title: 'Verify your identity', body: `Sign up and verify with ${VERIFY_ID}.` },
        { title: 'Say what happened', body: 'Describe the emergency, who is affected and what is needed first.' },
        { title: 'Set a realistic goal', body: 'Base it on immediate needs; the goal cannot be changed after you submit.' },
        { title: 'Share right away', body: 'Send the link to family, colleagues, church and community groups.' },
        { title: 'Update as things change', body: 'Post updates on what the money has done and what is still needed.' },
      ],
    },
    faqs: [
      { question: 'How quickly can I raise money in an emergency?', answer: 'Your campaign can go live as soon as screening allows, and donations count once the payment provider confirms them. There is no fixed review time; campaigns with photos or videos, or very high goals, wait for staff approval.' },
      { question: 'Can I get the money before the campaign ends?', answer: 'Where available, optional early and urgent payouts let you withdraw part of the cleared funds before the campaign ends, for a fee shown before you confirm. Every payout follows verification and reconciliation checks.' },
      { question: 'Does Ujimora check emergency campaigns?', answer: 'Every organizer verifies their identity and every campaign is screened before it goes live. Emergency claims can receive enhanced review, and staff may ask for supporting evidence.' },
      { question: 'Can I raise money for my whole community after a flood?', answer: 'Yes. A verified individual or a registered organization can run a campaign for a community. The [community fundraising guide](/community-fundraising) explains how groups organize.' },
      { question: 'What if we raise more than we need?', answer: 'Tell supporters in an update how the extra will be used. If the purpose of the money changes, contact support.' },
    ],
    related: ['/medical-fundraising', '/community-fundraising', '/funeral-fundraising', '/start-a-fundraiser', '/trust-and-safety', '/mobile-money-donations'],
    primaryAction: { label: 'Start an emergency fundraiser', action: 'start' },
    secondaryAction: { label: 'Browse campaigns', action: 'explore' },
    updated: UPDATED,
  },
  {
    path: '/donate-to-ghana-from-abroad',
    title: 'Donate to Ghana from Abroad: Support Family and Causes',
    description: 'Living abroad? Give to campaigns in Ghana by debit or credit card. Donations are charged in cedis, and you can follow updates from the family or cause.',
    name: 'Give from abroad',
    summary: 'How the diaspora gives to family and causes in Ghana by card.',
    group: 'giving',
    eyebrow: 'Diaspora giving',
    h1: 'Donate to family and causes in Ghana from abroad',
    lead: 'When a relative needs surgery, a parent passes or your hometown builds a school, being far away should not stop you from helping. Ujimora campaigns accept debit and credit cards, including many issued outside Ghana, so you can give from the UK, the US, Canada and beyond, and follow every update from home.',
    panel: { label: 'For the diaspora', title: 'Give by card from abroad. Follow every update from home.', body: 'Donations are charged in cedis; your card issuer converts the amount.' },
    icon: 'flight',
    facts: [
      { value: 'Card', label: 'Give from abroad', icon: 'flight' },
      { value: 'GH₵', label: 'Charged in cedis', icon: 'payments' },
      { value: 'Updates', label: 'Follow the cause', icon: 'campaign' },
      { value: 'Verified', label: 'Organizers checked', icon: 'verified' },
    ],
    sections: [
      {
        heading: 'How to give from abroad',
        paragraphs: [
          'Open the campaign link, choose an amount in cedis and pay by debit or credit card. Your card issuer converts the amount into your currency and may add a foreign transaction fee, so check with your bank if you give often. Some cards issued outside Ghana may not be accepted; if a payment fails, try another card.',
          'If you have a Ghanaian mobile money wallet, you can use that instead. Either way, the donation counts once the payment provider confirms it.',
        ],
      },
      {
        heading: 'What you can support',
        bullets: [
          '[Medical bills](/medical-fundraising) for relatives at home',
          '[Funeral costs](/funeral-fundraising) shared across the family',
          '[School fees](/education-fundraising) for nieces, nephews and students from your community',
          '[Hometown projects](/community-fundraising) such as boreholes and classrooms',
          '[Church appeals](/church-fundraising) for the congregation you grew up in',
        ],
      },
      {
        heading: 'Why a campaign beats sending money to one person',
        paragraphs: [
          'A transfer to one relative helps, but it leaves everyone else asking how much has been raised and what is still needed. A campaign gathers every contribution in one place, shows the total and gives the family a page to post updates on, so relatives in different countries see the same picture.',
          'Organizers verify their identity before a campaign can be created, and payouts go to a Ghanaian bank account or mobile money wallet after checks.',
        ],
      },
      {
        heading: 'Starting a campaign from abroad',
        paragraphs: [
          'Campaign creation is open to organizers based in Ghana. If you live abroad, ask a trusted family member, church or organization in Ghana to start the campaign, then share it with the rest of the diaspora and give yourself.',
        ],
      },
      {
        heading: 'Before you give',
        paragraphs: ['A few checks take a minute and protect your money:'],
        bullets: [
          'Give through the campaign page, not to phone numbers posted in comments or messages',
          'Check who the organizer is and how they are connected to the cause',
          'Read the updates to see what has happened so far',
          '[Report anything that looks wrong](/trust-and-safety) to our trust team',
        ],
      },
    ],
    faqs: [
      { question: 'Can I donate to a campaign in Ghana from the UK, US or Canada?', answer: 'Yes. You can give by debit or credit card, including many cards issued abroad. Some cards issued outside Ghana may not be accepted; if a payment fails, try another card.' },
      { question: 'Which currency will I be charged in?', answer: 'Donations are made in Ghana cedis (GHS). Your card issuer converts the amount into your currency and may charge a foreign transaction fee.' },
      { question: 'Can I use mobile money from abroad?', answer: 'Only with a Ghanaian mobile money wallet. Otherwise, give by debit or credit card.' },
      { question: 'Can I start a campaign if I live abroad?', answer: 'Campaign creation is open to organizers based in Ghana. A relative, church or organization in Ghana can start the campaign, and you can share it and give.' },
      { question: 'Will the family see that I donated?', answer: 'Yes, unless you choose to give anonymously, which hides your name on the campaign.' },
    ],
    related: ['/funeral-fundraising', '/medical-fundraising', '/community-fundraising', '/trust-and-safety', '/mobile-money-donations', '/gofundme-alternative-ghana'],
    primaryAction: { label: 'Browse campaigns', action: 'explore' },
    secondaryAction: { label: 'How we keep giving safe', action: 'trust' },
    updated: UPDATED,
  },
  {
    path: '/mobile-money-donations',
    title: 'Mobile Money Donations in Ghana: Give with MoMo | Ujimora',
    description: 'Donate to campaigns in Ghana with MTN MoMo, Telecel Cash or AT Money. How mobile money donations work on Ujimora, what to expect and how to stay safe.',
    name: 'Mobile money donations',
    summary: 'Give with MTN MoMo, Telecel Cash or AT Money, and stay safe.',
    group: 'giving',
    eyebrow: 'Mobile money',
    h1: 'Donate with mobile money in Ghana',
    lead: 'Mobile money is how most of Ghana pays, so it is front and centre on Ujimora. Choose an amount, pick mobile money at checkout and approve the payment on your phone. Here is how it works with MTN MoMo, Telecel Cash and AT Money, and how to stay safe while you give.',
    panel: { label: 'Networks', title: 'MTN MoMo, Telecel Cash and AT Money.', body: 'Payments are processed by Paystack. You approve them on your own phone.' },
    icon: 'phone',
    sections: [
      {
        heading: 'How a mobile money donation works',
        paragraphs: [
          'Open the campaign, choose Donate and enter your amount in cedis. At checkout, choose mobile money, select your network and enter your number, then follow your network’s prompt on your phone to approve the payment. The steps differ slightly between networks, and the checkout explains what to do.',
          'Your donation counts towards the campaign once the payment provider confirms it. If your wallet is debited but the donation does not appear after a while, contact support with your payment reference rather than paying again.',
        ],
      },
      {
        heading: 'Which networks you can use',
        paragraphs: ['Checkout offers mobile money through our payment partner, Paystack, for Ghana’s networks:'],
        bullets: ['MTN MoMo', 'Telecel Cash (formerly Vodafone Cash)', 'AT Money (formerly AirtelTigo Money)'],
        after: ['The methods shown at checkout depend on provider availability. You can also give by debit or credit card.'],
      },
      {
        heading: 'Stay safe with mobile money',
        bullets: [
          'Never share your mobile money PIN with anyone, including anyone who says they work for Ujimora',
          'Approve only payment prompts you started yourself',
          'Give through the campaign page, not to numbers posted in comments or messages',
          'If something feels wrong, [report the campaign](/trust-and-safety)',
        ],
      },
      {
        heading: 'For organizers: payouts to mobile money',
        paragraphs: [
          'Organizers can receive payouts to a mobile money wallet or a bank account in their name. Payouts follow verification and reconciliation checks, and a standard payout carries no extra Ujimora fee.',
        ],
      },
    ],
    faqs: [
      { question: 'Which mobile money networks can I donate with?', answer: 'MTN MoMo, Telecel Cash and AT Money, offered through our payment partner at checkout. The methods shown depend on provider availability.' },
      { question: 'Do I need an Ujimora account to donate with MoMo?', answer: 'No. You can give without an account. Signing in keeps your donations in one place and lets you request a refund review from your history.' },
      { question: 'My MoMo was debited but my donation is not showing. What should I do?', answer: 'Donations count once the payment provider confirms them, which can take a little time. If it still does not appear, contact support with your payment reference instead of paying again.' },
      { question: 'Is there a minimum donation?', answer: 'The amount must be more than zero, and campaign and account limits may apply.' },
      { question: 'Can I get a refund on a mobile money donation?', answer: 'You can request a refund review from your donation history, or contact support about a guest payment. Requests are reviewed against the refund policy and are not approved automatically; eligible refunds use the original payment method where supported.' },
    ],
    related: ['/how-it-works', '/donate-to-ghana-from-abroad', '/trust-and-safety', '/crowdfunding-ghana', '/refund-policy', '/help'],
    primaryAction: { label: 'Browse campaigns', action: 'explore' },
    secondaryAction: { label: 'Start a campaign', action: 'start' },
    updated: UPDATED,
  },
  {
    path: '/trust-and-safety',
    title: 'Is Ujimora Safe? Trust and Safety for Donors | Ujimora',
    description: 'How Ujimora protects donors: verified organizers, campaigns screened before going live, payouts after checks, and reports reviewed by our trust team.',
    name: 'Trust and safety',
    summary: 'What we check, what happens to the money and how to report a concern.',
    group: 'giving',
    eyebrow: 'Trust and safety',
    h1: 'Is Ujimora safe? How we protect donors',
    lead: 'Giving to a stranger’s cause takes trust. Here is exactly what Ujimora checks, what happens to the money, what we do when something goes wrong and the limits of what any platform can promise, so you can decide for yourself before you give.',
    panel: { label: 'Our approach', title: 'Verified organizers. Screened campaigns. Payouts after checks.', body: 'And a clear limit: screening does not confirm every claim, so read before you give.' },
    icon: 'shield',
    sections: [
      {
        heading: 'Every organizer is verified',
        paragraphs: [
          `Before anyone can create a campaign, they verify their identity with a government ID such as ${VERIFY_ID}. Organizations verify with their registration documents, and verified organizations show a badge on their profile. Organizers must be at least 18.`,
        ],
      },
      {
        heading: 'Campaigns are screened before they go live',
        paragraphs: [
          'A campaign’s text is screened before it is published, by automated safety screening if the organizer allows it, or otherwise by our staff. Photos and videos are checked by staff. Some campaigns, including those with very large goals, wait for staff approval before they go live.',
          'Some causes receive enhanced review: medical and emergency claims, campaigns involving minors, charities, political or public-interest fundraising, very high-value targets, cross-border beneficiaries and disaster response. Staff may ask for supporting documents.',
        ],
      },
      {
        heading: 'Payouts happen after checks',
        paragraphs: [
          'An amount raised is not automatically withdrawable. Before a payout, contributions must clear, the campaign is reconciled against payment records and the person being paid must be verified. Payouts can be held for unresolved verification, a fraud or risk review, a dispute, or refund and chargeback exposure.',
        ],
      },
      {
        heading: 'When something goes wrong',
        paragraphs: [
          'Anyone can report a campaign with the Report button on its page, or by emailing trust@ujimora.com. If a campaign is fraudulent, we remove it from public view, hold payouts that have not yet been approved while we investigate, and work with donors on refunds where funds can be recovered. We cooperate with law enforcement.',
          'If you gave to a campaign you are worried about, request a refund review from your donation history, or contact support about a guest payment.',
        ],
      },
      {
        heading: 'What screening cannot do',
        paragraphs: [
          'Screening looks for unsafe and prohibited content; it cannot confirm every claim in a story. Ujimora does not guarantee that a campaign will succeed or that funds will achieve their stated purpose. Before you give, read the story, look at who the organizer is and check the updates.',
        ],
      },
      {
        heading: 'Your data and payments',
        paragraphs: [
          'Payments are processed by Paystack, our regulated payment partner, and card details are handled by the payment provider rather than stored by Ujimora. Personal data is handled under Ghana’s Data Protection Act, 2012 (Act 843); our [privacy notice](/privacy) explains what we collect and why.',
          'Ujimora is operated by DevTrack, a business registered in Ghana (registration number BN843072020) and based in Accra. Our [terms](/terms) and every other [policy](/legal) are published in full.',
        ],
      },
    ],
    faqs: [
      { question: 'Is Ujimora legit?', answer: 'Ujimora is operated by DevTrack, a business registered in Ghana. Organizers verify their identity before creating campaigns, campaigns are screened before they go live, and payouts follow verification and reconciliation checks. Our terms and policies are published in full.' },
      { question: 'Are campaigns on Ujimora checked?', answer: 'Yes. Every campaign is screened before it goes live, and some are reviewed by staff. Screening cannot confirm every claim, so read the campaign and check the organizer before you give.' },
      { question: 'How do I report a suspicious campaign?', answer: 'Use the Report button on the campaign page, or email trust@ujimora.com with the campaign link and what concerns you.' },
      { question: 'Can I get my money back if a campaign turns out to be fraudulent?', answer: 'We hold payouts that have not yet been approved while we investigate, and work with donors on refunds where funds can be recovered. Request a refund review from your donation history or contact support.' },
      { question: 'Does Ujimora store my card details?', answer: 'No. Card details are handled by our payment provider, Paystack, rather than stored by Ujimora.' },
    ],
    related: ['/how-it-works', '/mobile-money-donations', '/crowdfunding-ghana', '/acceptable-use', '/refund-policy', '/privacy'],
    primaryAction: { label: 'Browse campaigns', action: 'explore' },
    secondaryAction: { label: 'Contact us', action: 'contact' },
    updated: UPDATED,
  },
  {
    path: '/gofundme-alternative-ghana',
    title: 'GoFundMe in Ghana? A Local Alternative | Ujimora',
    description: 'GoFundMe pays out only in its supported countries, and Ghana is not one of them. Raise money in Ghana on Ujimora, with payouts to a bank or MoMo wallet.',
    name: 'GoFundMe and Ghana',
    summary: 'Why GoFundMe does not pay out in Ghana, and what to use instead.',
    group: 'start',
    eyebrow: 'GoFundMe and Ghana',
    h1: 'Looking for GoFundMe in Ghana?',
    lead: 'Many Ghanaians reach for GoFundMe when a relative needs help, then find they cannot use it. GoFundMe supports fundraisers in a list of 20 countries in North America, Europe and Australia, and withdrawals need a bank account in that country. Ghana is not on the list. Ujimora is built in Ghana for Ghana: campaigns raise in cedis and pay out to Ghanaian bank accounts and mobile money wallets.',
    panel: { label: 'The short answer', title: 'Raise in cedis. Get paid to a Ghanaian bank account or MoMo wallet.', body: 'Supporters at home give by mobile money; relatives abroad give by card.' },
    icon: 'compare',
    sections: [
      {
        heading: 'Why GoFundMe does not work for most organizers in Ghana',
        paragraphs: [
          'GoFundMe’s help centre lists the countries where fundraisers are supported: as of October 2026, 20 countries, including the United States, Canada, Mexico, the United Kingdom, much of Western Europe and Australia. To withdraw the money, the organizer or beneficiary needs a bank account in the supported country where the fundraiser was created. A Ghanaian bank account or mobile money wallet does not qualify.',
          'The list can change, so check GoFundMe’s own [supported countries page](https://support.gofundme.com/hc/en-us/articles/360001972748-Countries-supported-on-GoFundMe) for the latest version.',
        ],
      },
      {
        heading: 'The workaround, and what it costs',
        paragraphs: [
          'Some families ask a relative in the UK or the US to run a GoFundMe from there, withdraw the money to their own account and send it home. It can work, but it puts one person in charge of everyone’s money, adds a second transfer with its own costs and delays, and leaves the family in Ghana unable to run the campaign themselves.',
        ],
      },
      {
        heading: 'What a Ghana-based platform does differently',
        bullets: [
          'Campaigns raise in Ghana cedis',
          'Supporters in Ghana give by mobile money: MTN MoMo, Telecel Cash or AT Money',
          'Relatives abroad give by debit or credit card',
          'Payouts go to a Ghanaian bank account or mobile money wallet',
          `Organizers verify with ${VERIFY_ID}`,
          'Personal data is handled under Ghana’s Data Protection Act',
        ],
      },
      {
        heading: 'When GoFundMe may still suit you',
        paragraphs: [
          'If you and the person you are raising money for both live in one of GoFundMe’s supported countries, it may be the simpler choice there. Ujimora is for causes in Ghana, run by organizers based in Ghana.',
        ],
      },
      {
        heading: 'Moving a fundraiser to Ujimora',
        paragraphs: [
          'If you have already started collecting elsewhere, start an Ujimora campaign for the amount still needed and share the new link. Say in the story how much was raised before and what remains, so supporters see the full picture.',
        ],
      },
    ],
    faqs: [
      { question: 'Can I use GoFundMe in Ghana?', answer: 'Not as an organizer receiving the funds in Ghana. GoFundMe supports fundraisers in 20 countries, and withdrawals need a bank account in the country where the fundraiser was created. Ghana was not on the list as of October 2026.' },
      { question: 'Can someone abroad start a GoFundMe for my family in Ghana?', answer: 'A relative living in a supported country can run one and withdraw to their own bank account there, then send the money on. That adds a second transfer and puts one person in charge of the funds.' },
      { question: 'What is the best alternative to GoFundMe in Ghana?', answer: 'Use a platform that pays out in Ghana. Ujimora campaigns raise in cedis, accept mobile money and cards, and pay out to Ghanaian bank accounts and mobile money wallets after verification.' },
      { question: 'Can people abroad give to an Ujimora campaign?', answer: `Yes, by debit or credit card. ${FOREIGN_CARDS}` },
      { question: 'How much does Ujimora charge?', answer: `The platform fee depends on your plan: ${PLAN_FEES}. Payment-processing charges are shown before anyone pays.` },
    ],
    related: ['/crowdfunding-ghana', '/start-a-fundraiser', '/donate-to-ghana-from-abroad', '/how-it-works', '/trust-and-safety', '/pricing'],
    primaryAction: { label: 'Start a campaign', action: 'start' },
    secondaryAction: { label: 'Compare plans', action: 'pricing' },
    updated: UPDATED,
  },
]

export const GUIDE_BY_PATH: Readonly<Record<string, Guide>> = Object.fromEntries(GUIDES.map((guide) => [guide.path, guide]))

/** The guides index. */
export const GUIDES_INDEX = {
  path: '/guides',
  title: 'Fundraising Guides for Ghana | Ujimora',
  description: 'Practical guides to raising money in Ghana: medical bills, school fees, funerals, churches, community projects, emergencies, mobile money and giving from abroad.',
  name: 'Fundraising guides',
  updated: UPDATED,
} as const

export const GUIDE_GROUPS: { id: Guide['group']; heading: string; intro: string }[] = [
  { id: 'start', heading: 'Getting started', intro: 'How crowdfunding works in Ghana and how to run a campaign well.' },
  { id: 'causes', heading: 'Raise money for', intro: 'What to know for each kind of cause.' },
  { id: 'giving', heading: 'Giving and safety', intro: 'For supporters at home and abroad.' },
]

/** Titles for the non-guide pages guides link to as related reading. */
export const SITE_PAGE_NAMES: Readonly<Record<string, string>> = {
  '/pricing': 'Pricing and plans',
  '/help': 'Help center',
  '/for-organizations': 'For organizations',
  '/refund-policy': 'Payout, refund and failed campaign policy',
  '/acceptable-use': 'Acceptable use and prohibited campaigns',
  '/privacy': 'Privacy notice',
  '/contact': 'Contact us',
}

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g

/** Copy with [text](/path) links reduced to their text, for structured data and checks. */
export function plainText(text: string): string {
  return text.replace(LINK, (_, label: string) => label)
}

/** Every link target in a piece of copy. */
export function linkTargets(text: string): string[] {
  return [...text.matchAll(LINK)].map((match) => match[2])
}

export type CopySegment = { text: string } | { label: string; href: string }

/** Copy split into plain runs and links, in order, for rendering. */
export function copySegments(text: string): CopySegment[] {
  const segments: CopySegment[] = []
  let last = 0
  for (const match of text.matchAll(LINK)) {
    if (match.index > last) segments.push({ text: text.slice(last, match.index) })
    segments.push({ label: match[1], href: match[2] })
    last = match.index + match[0].length
  }
  if (last < text.length) segments.push({ text: text.slice(last) })
  return segments
}

/** A stable in-page anchor for a heading, e.g. "What it costs" -> "what-it-costs". */
export function headingId(heading: string): string {
  return heading.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
