# Native fundraising release controls

12 September 2026 — engineering implemented; device and owner evidence pending.

## Campaign donations

Apple App Review 3.2.1(vi) permits approved nonprofits with Apple Pay support; 3.2.2(iv) requires other fundraising collections outside the app. No nonprofit approval was supplied. The iOS donation route therefore renders ExternalFundraisingScreen and opens the public HTTPS donation website with React Native Linking.openURL. It does not use SFSafariViewController/expo-web-browser, collect donor fields, create an intent, debit a wallet or display a crypto deposit address inside the iOS donation flow.

The handoff contains only campaign slug and validated optional amount/live-session context. It carries no access token, email, name, message or wallet credentials. The browser handles sign-in and fee/payment review. Returning to the app is not treated as payment success. Existing app balances and payment records are preserved.

Current app config has no iOS associated-domain interception of the HTTPS website. Verify the final build and hosted association files before release: tapping Continue in browser must leave the app, and the browser link must not immediately route back into native donation. Confirm active campaigns have valid public slugs and test browser sign-in, cancellation, receipt and pending-payment recovery. No production payment was made.

Android campaign collection remains available under its existing donation/P2P classification. Owner/provider and territory approval still require evidence (C03); this implementation does not establish tax exemption or regulatory permission.

## Creator support

CreateTipIntentUseCase currently credits the full tip before a plan-based platform fee is deducted on creator withdrawal. This fee-bearing end-to-end model requires review before relying on Apple's 100-percent-to-recipient personal-gift exception. Google also distinguishes digital tips from qualifying P2P/tax-exempt transactions. Do not label the fee-bearing service exempt merely because the UI says tip.

Native creator pages no longer render the payment form or external checkout CTA. The shared native createTip helper rejects before any payment API request on iOS/Android. Web creator checkout remains available. Creator profiles, safety controls, balances and existing withdrawal access remain available. No region-specific external-billing entitlement or alternative-billing program is assumed.

Re-enabling native tips requires a reviewed supported payment model, server verification and refund/reversal accounting, with store sandbox evidence. It must not be enabled through a remote flag solely to evade app review. This restriction is documented for release reviewers, not a claim of full store approval.

## Verification

Mobile tests: 10 files / 42 pass. Includes HTTPS/public-context handoff validation and native creator checkout refusal before API calls; existing payment recovery tests remain passing. Type and lint checks pass. Actual iOS browser transition, device accessibility and real provider/store transactions remain separate release checks.

## Sources

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), sections 3.1.1, 3.2.1(vi-vii), 3.2.2(iv).
- [Google Play Payments](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en), digital payments and donation/P2P exceptions. Rechecked 12 September 2026.
