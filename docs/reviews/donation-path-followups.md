# Donation-path follow-ups (deferred code-review findings)

From the pre-production code review (2026-09-06). Five findings were fixed and
committed in `fix(api): code-review fixes across payments & subscriptions`. The
two below were **deliberately deferred** — they sit on the money-settlement path
and warrant a dedicated change with its own tests rather than an overnight fix.
Both are pre-existing (not introduced by the production-completion work).

---

## 1. HIGH — Settlement state flips before ledger/projection are durable

**File:** `apps/api/src/application/use-cases/SettleDonationUseCase.ts`
(`execute`, lines ~57–119)

**What happens.** Step 1 atomically flips the intent `CREATED|PENDING →
SUCCEEDED` (the exactly-once gate, line 58). Steps 2–3 — save the donation, post
the immutable ledger journal, project the campaign raised total + beneficiary
balance, enqueue+dispatch the outbox — run **after** the gate, each as a separate
non-transactional write.

**The gap.** If the process dies between the gate (line 58) and the projection
(line 96), the intent is already `SUCCEEDED` but the ledger journal and/or the
campaign total never posted. A retried webhook then hits the idempotent-return
branch (lines 63–67), sees `status === 'SUCCEEDED'`, and returns early — so the
missing ledger/projection work is **never** completed. Result: money the donor
paid is confirmed on the intent but under-counted in the campaign total and
missing from the ledger.

The docstring's claim that "every step after the gate is idempotent … so a
retried settlement is safe" only holds when steps 2–3 completed on the first
pass. It does not cover a mid-sequence crash.

**Failure scenario.** Paystack `charge.success` webhook → gate flips to
SUCCEEDED → pod is killed (deploy/OOM) before `projector.projectDonation` →
Paystack retries the webhook → `SettleDonationUseCase` returns the already-
SUCCEEDED intent without projecting → campaign shows less raised than was
actually paid; ledger is missing a journal entry (accounting integrity break).

**Recommended fix (pick one):**
- **Outbox-drive the whole settlement.** Make the gate transition the only
  synchronous write; enqueue a `donation.settle` outbox row in the same step and
  have one idempotent handler do donation-save + ledger + projection +
  side-effects. The boot sweep then completes any settlement interrupted midway.
- **Re-drive on the idempotent path.** In the `status === 'SUCCEEDED'` branch,
  re-run steps 2–3 (they must each be idempotent — ledger already dedupes on the
  intent; make `projectDonation` idempotent, e.g. keyed on `donationIntentId`, so
  a re-drive can't double-count). This is the smaller change but needs the
  projection made provably idempotent first.
- **Wrap gate + ledger in a Mongo transaction** (requires a replica set / Atlas)
  so the state flip and the journal commit or roll back together.

**Tests to add:** simulate a throw after the gate but before projection; assert a
second `execute` call completes the ledger + projection and leaves the campaign
total correct (exactly once, not doubled).

---

## 2. LOW — Donation idempotency key is matched globally, not per-donor

**File:** `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`
(`execute` line ~85; `createIntent` duplicate-key branch lines ~219–230)

**What happens.** The intent is looked up (and the unique index enforced) by
`idempotencyKey` **alone** — not scoped to the donor. If two different donors
submit the same idempotency key, donor B's request resolves to donor A's
existing intent (line 88 returns A's intent to B).

**Why it's LOW.** In practice keys are server-resolved UUIDs, so collisions are
vanishingly unlikely. It becomes real only if a client supplies a
non-unique/guessable `Idempotency-Key` (or a guest path emits a predictable one),
which could misroute or leak another donor's intent.

**Recommended fix.** Scope idempotency to the donor: make the lookup
`findByIdempotencyKey(donorUserId, key)` and change the unique index to the
compound `(donorUserId, idempotencyKey)`. For guests (`donorUserId === null`),
guarantee a server-generated unique key so two guests can never collide. Update
the duplicate-key race branch (lines 219–230) to resolve on the same compound
key.

**Tests to add:** two donors, same client-supplied idempotency key → two distinct
intents; same donor, same key, repeated submit → one intent (no double charge).

---

_Status: documented for a tested follow-up. Not scheduled — surface to the team
before the first real-money launch (finding 1 especially)._
