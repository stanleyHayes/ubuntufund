import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { LEGAL_ENTITY } from '@ubuntu-fund/types/src/legal';
import { ResendActivityEmails } from '../../src/infrastructure/adapters/outbound/ResendActivityEmails.js';

/**
 * Every transactional email prints `Support: <REPLY_TO_EMAIL>`. The Blueprint
 * set both sender and reply-to to info@ (the general inbox) while the legal
 * pack, help pages and the code default all name support@ for support and
 * no-reply@ as the only transactional sender.
 */
// Vitest runs with apps/api as the cwd.
const blueprint = readFileSync(resolve(process.cwd(), '../../render.yaml'), 'utf8');
const envValue = (key: string) => new RegExp(`- key: ${key}\\n(?:\\s+#.*\\n)*\\s+value: (\\S+)`).exec(blueprint)?.[1];

it('sends from no-reply@ and routes replies to the support mailbox the legal pack names', () => {
  expect(envValue('FROM_EMAIL')).toBe('no-reply@ujimora.com');
  expect(envValue('REPLY_TO_EMAIL')).toBe(LEGAL_ENTITY.emails.support);
  expect(new ResendActivityEmails('key', 'no-reply@ujimora.com', 'https://app.ujimora.com').replyTo).toBe(LEGAL_ENTITY.emails.support);
});
