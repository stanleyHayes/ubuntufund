import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import { LegalPageLayout } from '../components/LegalPageLayout'

const sections = [
  {
    title: '1. Information We Collect',
    content: `We collect information you provide directly, including: name, email address, phone number, and payment information when you create an account; campaign details, descriptions, and media when you create a campaign; donation amounts and payment details when you make a contribution; communications you send to us or other users through the Platform. We also automatically collect: device information (browser type, operating system, device identifiers); usage data (pages visited, features used, time spent); IP address and approximate location; cookies and similar tracking technologies.`,
  },
  {
    title: '2. How We Use Your Information',
    content: `We use your information to: operate, maintain, and improve the Platform; record wallet-backed donations; review identity information and investigate fraud reports; communicate with you about your account, campaigns, and donations; send marketing communications with your consent; comply with legal obligations and enforce our terms; and generate analytics to improve our services.`,
  },
  {
    title: '3. Information Sharing',
    content: `We may share limited information with campaign organizers where needed to display non-anonymous support, with service providers that host or operate the Platform under contractual safeguards, and with authorities when required by law or necessary to protect rights and safety. External payment processors are not active in the current launch configuration. We do not sell your personal information.`,
  },
  {
    title: '4. Cookies and Tracking',
    content: `We use cookies and similar technologies for: essential platform functionality (session management, security); remembering your preferences and settings; analytics and performance monitoring; marketing and advertising (with consent). You can manage cookie preferences through your browser settings. Note that disabling certain cookies may affect Platform functionality. We use both first-party and third-party cookies.`,
  },
  {
    title: '5. Data Security',
    content: `We use access controls, authentication requirements, and encrypted HTTPS connections in production to help protect your data. External payment providers remain disabled until their integrations and compliance requirements are verified. No method of electronic transmission or storage is 100% secure, and we cannot guarantee absolute security.`,
  },
  {
    title: '6. Data Retention',
    content: `We retain your personal information for as long as your account is active or as needed to provide services. After account deletion, we may retain certain information for up to 5 years for legal compliance, fraud prevention, and dispute resolution. Transaction records are retained as required by applicable financial regulations. You may request deletion of your data at any time, subject to legal requirements.`,
  },
  {
    title: '7. Your Rights',
    content: `Depending on your jurisdiction, you may have the right to: access the personal information we hold about you; correct inaccurate or incomplete information; delete your personal information; restrict or object to processing of your data; data portability (receive your data in a structured format); withdraw consent for marketing communications; lodge a complaint with a supervisory authority. To exercise any of these rights, please contact us at privacy@ujimora.com.`,
  },
  {
    title: '8. International Data Transfers',
    content: `Ujimora operates in Ghana but may transfer data internationally for processing and storage. When we transfer data outside Ghana, we ensure appropriate safeguards are in place, including standard contractual clauses and adequacy decisions where applicable. By using the Platform, you consent to the transfer of your information as described in this policy.`,
  },
  {
    title: '9. Children\'s Privacy',
    content: `Ujimora is not intended for children under 18 years of age. We do not knowingly collect personal information from children. If we become aware that we have collected information from a child, we will take steps to delete that information promptly. Parents or guardians who believe their child has provided us with personal information should contact us immediately.`,
  },
  {
    title: '10. Changes to This Policy',
    content: `We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on the Platform and updating the "Last updated" date. We may also notify you via email for significant changes. Your continued use of the Platform after changes become effective constitutes acceptance of the updated policy.`,
  },
  {
    title: '11. Contact Us',
    content: `If you have questions or concerns about this Privacy Policy or our data practices, contact privacy@ujimora.com. A public postal address and formal response-time commitment will be published only after owner and legal verification.`,
  },
]

function PrivacyPage() {
  return (
    <LegalPageLayout
      eyebrow="Your information"
      title="Privacy Policy"
      description="A clear account of what Ujimora collects, why it is needed, and the choices available to you."
      icon={<ShieldRoundedIcon />}
      panelLabel="Privacy principle"
      panelTitle="Collect what is needed. Protect it. Explain its use."
      panelBody="This policy covers account data, campaign records, donations, security, retention, and your rights."
      introduction="At Ujimora, we are committed to protecting your privacy and the security of your personal information. This policy explains how we collect, use, share, retain, and protect data when you use the platform."
      sections={sections}
      contact={<>Privacy-related inquiries can be sent to <strong>privacy@ujimora.com</strong>.</>}
    />
  )
}

export default PrivacyPage
