# Campaign writing assistant

The campaign creation form includes a writing assistant on the Story step. Creators can draft from notes, improve clarity, fix grammar, summarize, expand, change tone, or translate. Suggestions appear separately and require an explicit Apply action. A suggestion cannot overwrite a story edited since its request started.

The API also supports generating a title or donor email through the shared action contract. Those two actions are not separate controls in the campaign form.

## Enable on Render

On **ujimora-api → Environment**, set:

| Variable | Value |
| --- | --- |
| `OPENAI_API_KEY` | Your server-side OpenAI API key |
| `AI_WRITING_ENABLED` | `true` |
| `AI_WRITING_MODEL` | `gpt-4.1-mini` |
| `AI_WRITING_DAILY_LIMIT` | `20` per user |
| `AI_WRITING_GLOBAL_DAILY_LIMIT` | `500` across the platform |

These variables are declared in `render.yaml`. Existing services may require manually adding the new secret variable before redeploying. Never prefix the key with `VITE_` or put it in a frontend environment. With the feature disabled or the key absent, the form remains usable and explains that the assistant is unavailable.

The adapter calls the OpenAI Responses API with `store: false`, a 30-second timeout and a maximum of 1,600 output tokens. The model is configurable. Provider failures return an error, never mock writing. No automatic paid-request retry is performed.

## Usage and privacy

Authenticated creators use `GET /api/v1/ai-writing/config` and `POST /api/v1/ai-writing`. Only administrators can access `/stats` and `/usage`. The admin AI Usage page displays platform totals, UTC day/month counts, failed attempts, actual returned token counts, and paginated request metadata.

Ujimora stores user ID, action, timestamp, character counts, status, model and returned token counts. It does **not** store submitted text or generated text in usage logs. The UI discloses that submitted text goes to OpenAI. Applied text becomes part of the creator's campaign draft under the normal campaign-save flow.

Atomic MongoDB counters enforce both quotas across API instances. Accepted attempts, including provider failures, consume allowance; rejected validation and unconfigured requests do not. A globally rejected reservation restores the user's allowance. Quotas reset at midnight UTC; expired quota documents are removed by TTL. A process interrupted after reserving quota may conservatively consume a request and leave a pending usage record. Token totals reflect completed responses with returned usage, not guaranteed provider invoices for interrupted/failed requests. Limits cap requests, not an exact currency spend.

## Verification

Automated tests cover provider response parsing, no response storage, token tracking, concurrent quota caps, global limits, failure accounting, validation, real application authentication/admin authorization, explicit Apply, stale-edit protection, and paginated admin usage/retry.

Live OpenAI credentials and a production generation have not been verified. After setting the key and deploying, request one suggestion from a test campaign draft and confirm its usage record in admin before general release.
