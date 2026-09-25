import { describe, expect, it } from 'vitest';
import type { SiteContentRecord, SiteContentRepositoryPort } from '../../src/domain/ports/outbound/SiteContentRepositoryPort.js';
import { FAQ_REFRESH_ACTOR, refreshSupersededFaqDefaults } from '../../src/infrastructure/database/seedSiteContent.js';
import { SUPERSEDED_FAQ_DEFAULTS } from '../../src/infrastructure/database/supersededFaqDefaults.js';
import siteContentDefaults from '../../src/infrastructure/database/siteContentDefaults.json';

interface FaqItem { category: string; question: string; answer: string }

const currentFaq = (siteContentDefaults as { key: string; data: { items?: FaqItem[] } }[]).find((block) => block.key === 'faq')!.data.items!;

/** In-memory SiteContentRepositoryPort with the same optimistic-concurrency rule as Mongo. */
class MemoryContent implements SiteContentRepositoryPort {
  records = new Map<string, SiteContentRecord>();
  writes = 0;
  private clock = 1_000;
  async getByKey(key: string) {
    const record = this.records.get(key);
    return record ? structuredClone(record) : null;
  }
  async list() {
    return [...this.records.values()].map((record) => structuredClone(record));
  }
  async upsert(key: string, type: string, data: unknown, updatedBy?: string) {
    this.writes += 1;
    const record = { key, type, data: structuredClone(data), updatedAt: new Date((this.clock += 1)), updatedBy };
    this.records.set(key, record);
    return structuredClone(record);
  }
  async replaceIfUnchanged(key: string, type: string, data: unknown, expectedUpdatedAt: Date, updatedBy?: string) {
    const record = this.records.get(key);
    if (!record || record.updatedAt.getTime() !== expectedUpdatedAt.getTime()) return null;
    return this.upsert(key, type, data, updatedBy);
  }
  async count() {
    return this.records.size;
  }
}

async function storeFaq(items: unknown[], updatedBy = 'admin-1') {
  const repo = new MemoryContent();
  await repo.upsert('faq', 'faq', { items }, updatedBy);
  repo.writes = 0;
  return repo;
}

const stored = async (repo: MemoryContent) => ((await repo.getByKey('faq'))!.data as { items: FaqItem[] }).items;

/** The text an earlier release seeded for a question (the most recent one when there were several). */
function earlierDefault(question: string, pick: (answer: string) => boolean = () => true): FaqItem {
  const entry = [...SUPERSEDED_FAQ_DEFAULTS].reverse().find((item) => item.question === question && pick(item.answer));
  if (!entry) throw new Error(`no earlier default for ${question}`);
  const category = currentFaq.find((item) => item.question === (entry.current ?? question))?.category ?? 'Trust & safety';
  return { category, question: entry.question, answer: entry.answer };
}

describe('refreshSupersededFaqDefaults', () => {
  it('only names replacements that exist, and never lists a current default as superseded', () => {
    const current = new Set(currentFaq.map((item) => `${item.question}\n${item.answer}`));
    for (const entry of SUPERSEDED_FAQ_DEFAULTS) {
      expect(current.has(`${entry.question}\n${entry.answer}`), entry.question).toBe(false);
      if (entry.current !== null) expect(currentFaq.map((item) => item.question)).toContain(entry.current);
    }
  });

  it('turns a FAQ seeded by the previous release into the current defaults and drops the trust-score entry', async () => {
    // The previous release's FAQ is the current one with its since-corrected answers.
    const previous = [
      ...currentFaq.map((item) => {
        const earlier = SUPERSEDED_FAQ_DEFAULTS.filter((entry) => entry.question === item.question);
        return earlier.length ? { ...item, answer: earlier[earlier.length - 1].answer } : item;
      }),
      earlierDefault('How does the trust score work?'),
    ];
    expect(previous.some((item) => /24-48 hours|extend once|reviews every campaign|funds are frozen/.test(item.answer))).toBe(true);
    const repo = await storeFaq(previous, undefined);

    expect(await refreshSupersededFaqDefaults(repo)).toEqual({ replaced: expect.any(Number), removed: 1 });
    expect(await stored(repo)).toEqual(currentFaq);
    expect((await repo.getByKey('faq'))!.updatedBy).toBe(FAQ_REFRESH_ACTOR);
  });

  it('replaces every earlier default, including renamed questions, without duplicating a question', async () => {
    const repo = await storeFaq(SUPERSEDED_FAQ_DEFAULTS.map((entry) => ({ category: 'Old', question: entry.question, answer: entry.answer })));
    await refreshSupersededFaqDefaults(repo);
    const items = await stored(repo);
    const currentAnswers = new Map(currentFaq.map((item) => [item.question, item.answer]));
    expect(items.map((item) => item.question)).toEqual([...new Set(items.map((item) => item.question))]);
    for (const item of items) expect(item.answer).toBe(currentAnswers.get(item.question));
    expect(items.some((item) => /UbuntuFund|trust score/i.test(`${item.question} ${item.answer}`))).toBe(false);
    // Each entry keeps its own category and place; only the text is replaced.
    expect(items.every((item) => item.category === 'Old')).toBe(true);
  });

  it('never changes an answer an admin edited, added or moved, and does not duplicate a question they answered', async () => {
    const edited = { ...earlierDefault('How long can my campaign run?'), answer: 'Our own answer about campaign length.' };
    const added = { category: 'Local', question: 'Where is your office?', answer: 'Accra.' };
    const moved = { ...earlierDefault('Can I edit my campaign after it\'s live?'), category: 'Moved by admin' };
    const staleRename = earlierDefault('Is UbuntuFund available in my country?');
    const answeredByAdmin = { category: 'Getting started', question: 'Is Ujimora available in my country?', answer: 'Admin wording.' };
    const repo = await storeFaq([edited, added, moved, staleRename, answeredByAdmin, 'not an item']);

    expect(await refreshSupersededFaqDefaults(repo)).toEqual({ replaced: 1, removed: 1 });
    const current = currentFaq.find((item) => item.question === 'Can I edit my campaign after it\'s live?')!;
    expect(await stored(repo)).toEqual([edited, added, { ...moved, answer: current.answer }, answeredByAdmin, 'not an item']);
  });

  it('is idempotent: a second run finds nothing and writes nothing', async () => {
    const repo = await storeFaq([earlierDefault('How do I start a fundraising campaign?'), earlierDefault('How does Ujimora verify campaigns?', (answer) => /every campaign/.test(answer))]);
    expect(await refreshSupersededFaqDefaults(repo)).toEqual({ replaced: 2, removed: 0 });
    expect(repo.writes).toBe(1);
    const afterFirst = await repo.getByKey('faq');
    expect(await refreshSupersededFaqDefaults(repo)).toEqual({ replaced: 0, removed: 0 });
    expect(repo.writes).toBe(1);
    expect(await repo.getByKey('faq')).toEqual(afterFirst);
  });

  it('leaves the FAQ alone when an admin saves it while the refresh runs', async () => {
    const repo = await storeFaq([earlierDefault('How long can my campaign run?')]);
    const read = repo.getByKey.bind(repo);
    repo.getByKey = async (key: string) => {
      const record = await read(key);
      await repo.upsert('faq', 'faq', { items: [{ category: 'Campaigns', question: 'How long can my campaign run?', answer: 'Saved by an admin just now.' }] }, 'admin-2');
      return record;
    };
    expect(await refreshSupersededFaqDefaults(repo)).toEqual({ replaced: 0, removed: 0 });
    expect((await stored(repo))[0].answer).toBe('Saved by an admin just now.');
  });

  it('does nothing when there is no FAQ block or it has an unexpected shape', async () => {
    const empty = new MemoryContent();
    expect(await refreshSupersededFaqDefaults(empty)).toEqual({ replaced: 0, removed: 0 });
    expect(empty.writes).toBe(0);
    const odd = new MemoryContent();
    await odd.upsert('faq', 'faq', { questions: [] });
    expect(await refreshSupersededFaqDefaults(odd)).toEqual({ replaced: 0, removed: 0 });
    expect(odd.writes).toBe(1);
  });
});
