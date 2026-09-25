/**
 * FAQ entries exactly as earlier releases seeded them, before they were
 * corrected. The boot seed fills only an empty collection, so every deployment
 * keeps the FAQ text of its first boot; refreshSupersededFaqDefaults() uses this
 * list to replace an entry only while it still matches one of these word for
 * word. An entry an admin has edited never matches, so it is left alone.
 *
 * Generated from the git history of siteContentDefaults.json (commits b3082f8d,
 * fc2e2e9f, 2d6a3205, c6617a29, c4aa963a and 9db8be4e). When a default FAQ answer
 * changes, add its previous text here so existing deployments pick up the fix.
 * `current` is the question of the default that replaces the entry; null
 * removes it (the feature it described does not exist).
 */
export interface SupersededFaqDefault {
  question: string;
  answer: string;
  current: string | null;
}

export const SUPERSEDED_FAQ_DEFAULTS: readonly SupersededFaqDefault[] = [
  {
    question: "How do I create an account on UbuntuFund?",
    answer: "Click \"Sign Up\" on the homepage, enter your email and create a password. You can also sign up with Google or Facebook. Complete your profile with your name, location, and a photo to build trust with the community.",
    current: "How do I create an account on Ujimora?",
  },
  {
    question: "Is UbuntuFund available in my country?",
    answer: "UbuntuFund is built for Ghana. Campaign creation is open to organizers based in Ghana, and anyone worldwide can donate to a Ghanaian campaign — family abroad included. All campaigns raise funds in Ghanaian cedis (GHS).",
    current: "Is Ujimora available in my country?",
  },
  {
    question: "Do I need to verify my identity?",
    answer: "Basic usage requires email verification. To create campaigns and build trust, we recommend completing our multi-level verification: email/phone, national ID, institutional, and community vouching. Higher verification means a higher trust score.",
    current: "Do I need to verify my identity?",
  },
  {
    question: "How do I start a fundraising campaign?",
    answer: "Click \"Start a Campaign\" and follow the guided setup: title, description, goal amount, category, and compelling photos. Set a deadline and submit for review. Our team typically reviews campaigns within 24-48 hours.",
    current: "How do I start a fundraising campaign?",
  },
  {
    question: "How long can my campaign run?",
    answer: "Campaigns run up to 90 days. We recommend 30-60 days for optimal engagement. You can extend once for 30 additional days if you haven't reached your goal. Campaigns that reach their goal early continue accepting donations.",
    current: "How long can my campaign run?",
  },
  {
    question: "Can I edit my campaign after it's live?",
    answer: "Yes. You can update the description, images, and deadline. The goal amount cannot be reduced once donations are received. Major changes may trigger a re-review by our trust team.",
    current: "Can I edit my campaign after it's live?",
  },
  {
    question: "How do I make a donation?",
    answer: "Browse campaigns and click \"Donate.\" Enter the amount, choose your payment method, and confirm. You'll receive a confirmation email with your receipt. You can donate anonymously if you prefer.",
    current: "How do I make a donation?",
  },
  {
    question: "Is there a minimum or maximum donation?",
    answer: "Minimum is GH₵ 5. No maximum, though large donations may require additional verification. Enterprise organizations can set custom minimums for their campaigns.",
    current: "Is there a minimum or maximum donation?",
  },
  {
    question: "Can I get a refund on my donation?",
    answer: "Refunds are available within 14 days if the campaign hasn't withdrawn the funds. For campaigns that are suspended or found fraudulent, full refunds are processed automatically. Visit your donation history to request a refund.",
    current: "Can I get a refund on my donation?",
  },
  {
    question: "What payment methods are accepted?",
    answer: "MTN Mobile Money (MoMo), Telecel Cash, AT Money, Visa & Mastercard cards, and bank transfer. Mobile money is the fastest way to give and receive funds in Ghana.",
    current: "What payment methods are accepted?",
  },
  {
    question: "How do I withdraw my campaign funds?",
    answer: "Go to your dashboard and click \"Withdraw.\" Choose mobile money (processed within 24 hours) or bank transfer to any Ghanaian bank (2-3 business days). Platform fees are automatically deducted.",
    current: "How do I withdraw my campaign funds?",
  },
  {
    question: "What are the platform fees?",
    answer: "Fees depend on your subscription tier. Free accounts pay a 5% platform fee. Starter (3.5%), Pro (2%), and Enterprise (1%). All tiers incur standard payment processing fees (2.9% + GH₵ 1). See our pricing page for details.",
    current: "What are the platform fees?",
  },
  {
    question: "How does UbuntuFund verify campaigns?",
    answer: "Multi-layer verification: initial team review, organizer identity verification, documentation checks, and community trust scores. Verified campaigns earn badges that help donors assess credibility at a glance.",
    current: "How does Ujimora verify campaigns?",
  },
  {
    question: "What happens if a campaign is fraudulent?",
    answer: "The campaign is immediately suspended, funds are frozen, and we process refunds for affected donors. Fraudulent accounts are permanently banned. We cooperate with law enforcement. Use the \"Report\" button on any campaign to flag concerns.",
    current: "What happens if a campaign is fraudulent?",
  },
  {
    question: "How does the trust score work?",
    answer: "Trust scores (0-100) are calculated from verification level, campaign track record, community engagement, and donor feedback. Higher scores unlock features like increased campaign limits and featured placement.",
    current: null,
  },
  {
    question: "How do I register as an organization?",
    answer: "During registration, select \"Organization\" as your account type. Provide your organization name, registration number, and type (NGO, hospital, school, etc.). Complete verification with official documents for priority trust status.",
    current: "How do I register as an organization?",
  },
  {
    question: "What features are available for organizations?",
    answer: "Organizations get: branded campaign pages, team management, advanced analytics, automated tax receipts, recurring donation support, API access, and dedicated account management. See our \"For Organizations\" page for tier details.",
    current: "What features are available for organizations?",
  },
  {
    question: "How do I create an account on Ujimora?",
    answer: "Click \"Sign Up\" on the homepage, enter your email and create a password. You can also sign up with Google or Facebook. Complete your profile with your name, location, and a photo to build trust with the community.",
    current: "How do I create an account on Ujimora?",
  },
  {
    question: "Is Ujimora available in my country?",
    answer: "Ujimora is built for Ghana. Campaign creation is open to organizers based in Ghana, and anyone worldwide can donate to a Ghanaian campaign — family abroad included. All campaigns raise funds in Ghanaian cedis (GHS).",
    current: "Is Ujimora available in my country?",
  },
  {
    question: "How do I make a donation?",
    answer: "Browse campaigns and choose Donate. During launch readiness, confirmed contributions use your Ujimora Wallet balance. External payment methods remain disabled until their provider integrations are verified.",
    current: "How do I make a donation?",
  },
  {
    question: "Is there a minimum or maximum donation?",
    answer: "The amount must be positive and cannot exceed your available Ujimora Wallet balance. Campaign and account limits may also apply.",
    current: "Is there a minimum or maximum donation?",
  },
  {
    question: "Can I get a refund on my donation?",
    answer: "You can submit a refund request from your donation history. Requests are recorded for review, but approval and wallet settlement are not automatic and no processing time is guaranteed.",
    current: "Can I get a refund on my donation?",
  },
  {
    question: "What payment methods are accepted?",
    answer: "Ujimora Wallet is the only live payment method currently enabled. Mobile money, cards, and bank transfer remain disabled until their production payment adapters and compliance reviews are complete.",
    current: "What payment methods are accepted?",
  },
  {
    question: "How do I withdraw my campaign funds?",
    answer: "Self-service campaign withdrawals are not currently available. Campaign organizers should contact support for the controlled disbursement process while production payout rails are being finalized.",
    current: "How do I withdraw my campaign funds?",
  },
  {
    question: "What are the platform fees?",
    answer: "Current plan pricing and platform fees are shown on the pricing page. External payment-processing fees are not charged while those payment methods remain disabled.",
    current: "What are the platform fees?",
  },
  {
    question: "How does Ujimora verify campaigns?",
    answer: "Multi-layer verification: initial team review, organizer identity verification, documentation checks, and community trust scores. Verified campaigns earn badges that help donors assess credibility at a glance.",
    current: "How does Ujimora verify campaigns?",
  },
  {
    question: "What features are available for organizations?",
    answer: "Organizations have a dedicated workspace, member collaboration, campaign management, updates, comments, donation history, and review status across web and mobile. Paid billing and external integrations are not available yet.",
    current: "What features are available for organizations?",
  },
  {
    question: "How does Ujimora verify campaigns?",
    answer: "Our team reviews every campaign before it goes live, together with organizer identity verification and documentation checks. Verified organizations show a badge that helps donors judge credibility.",
    current: "How does Ujimora verify campaigns?",
  },
];
