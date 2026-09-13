# Creator tip checkout safety

Status: API reservation and web/Expo-web retry lifecycle implemented; historical terminal cleanup implemented; abandoned-initialization recovery and public attribution admission remain open.

The creator tip endpoint accepts an optional `Idempotency-Key` header (16–128 ASCII letters, digits, underscore or hyphen). The API derives a provider reference scoped to the creator and authenticated supporter (or guest), then reserves it through the existing unique provider-reference index before contacting Paystack. The stored request fingerprint binds amount, currency, email, public name/message, anonymity and agreement input. Same-key changed details return 409. Matching retries reuse a saved checkout. Concurrent initialization or an unknown provider outcome returns the existing reference and local confirmation route without a second provider initialization. Unexpected provider references are rejected.

Legacy keyless requests retain their existing behavior and are not deduplicated. No external Paystack transaction was made during verification.

Evidence: 15 API tests pass, including eight concurrent use-case workers sharing a real Mongo repository with its unique index initialized, saved checkout replay from a new worker, and conflicting payload rejection. The phone-browser lost-response/reload flow passes with the same request header on both submissions and no donor email in local storage. Three web storage lifecycle tests pass; web type-check and lint pass (three existing lint warnings). API type-check/lint passed in the preceding slice. No external payment was made. Production index deployment is not verified.

Web retains an opaque viewer/creator-scoped attempt key in local storage across retries and reloads, serializes reservation with Web Locks where available, and sends it through the Idempotency-Key header. Draft names, emails and messages are not stored. Only a confirmed terminal callback releases the matching stored reference. Unknown outcomes and changed details do not silently generate fresh keys.

Expo-web now reuses one persisted attempt per viewer/creator through the existing payment-key helper with an empty payload (no draft or checkout URL in storage). Verification only releases a matching terminal reference. Explicit public-message terms acknowledgement is now passed to the API; it is unchecked initially. Native iOS/Android creator checkout remains denied before reservation or API calls. All 66 mobile tests pass, including new unknown-outcome, terminal-reference and native-gate checks; mobile type-check/lint pass with one existing hook warning, and iOS/Android/web bundle exports pass. Physical-device checkout and live provider behavior were not exercised.

Remaining: production index verification, abandoned checkout disposition/retention, safe reconciliation of abandoned initialization, and public attribution admission. Native creator tipping remains store-gated. Evidence uses mocked provider responses, not real charges or a production deployment.


Terminal and erasure lifecycle: SUCCEEDED/FAILED transitions unset stored checkout credentials. Persistence accepts only PENDING, non-revoked attempts, preventing a delayed initialization response from restoring completed/erased credentials. Matching terminal retries return the local confirmation route with no access code; Expo-web checks status directly for this response. Account erasure removes checkout credentials/fingerprint and records revocation while retaining amounts and payment references. Fingerprint removal makes an erased request ineligible for checkout replay.

Verification: 20 lifecycle/verification tests passed, three real HTTP account-erasure tests passed with tip assertions, then the final five-test Mongo suite passed including settlement-before-initialization-response. API type/lint and mobile type-check pass. Historical terminal cleanup is recorded below; abandonment reconciliation remains open.


HTTP and browser verification: the fully wired Express checkout route with real Mongo persistence passed invalid-header rejection, same-header replay, changed-payload conflict, one-record/one-provider-call assertions, private no-store responses and terminal confirmation routing. Paid entitlement and gateway calls were mocked; payment providers were not contacted. The phone-browser flow passed lost-response reload/retry, pending-key retention, confirmed-success key release, and a deliberate subsequent gift using a new key. The initial exact label selector was corrected to the rendered textbox accessible name before the passing run.


Unknown-outcome recovery: matching attempts without stored checkout credentials now lead to reference-bound confirmation instead of an error without a recovery reference. This verifies existing payment state only; it never initializes another charge or declares missing/unknown provider evidence failed. Unresolved provider states still require reconciliation/support and keep the attempt reserved. Web confirmation remounts when its reference changes to prevent showing an earlier payment result. Web and Expo-web storage cleanup failures preserve confirmed payment status while retaining the old attempt for safe replay.

Verification: 14 API request/Mongo/HTTP regressions, five web confirmation/storage tests and eight mobile checkout/gate tests pass; API/web/mobile type-check pass. The new tests cover navigation away from a successful reference and storage cleanup failure. No real provider payment was made.


Historical terminal credentials: a bounded Mongo cleanup removes checkout objects (including access-code-only remnants) from at most 500 SUCCEEDED/FAILED records per invocation. It rechecks terminal status in the update, preserves references, financial values and pending checkout credentials, and is idempotent. The application wires a boot invocation and a guarded five-minute production interval, with failure logging. No production data was accessed or cleaned in this session.

Verification: seven real Mongo/HTTP tests pass, including a 502-record historical fixture processed as 500 then 2 then 0, pending-credential preservation and unchanged terminal financial fields. API type-check/lint pass. The scheduler is wired and type-checked; its production execution remains deployment evidence, not a claim made by these repository tests.
