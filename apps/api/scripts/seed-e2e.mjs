// Seed minimal data for the Playwright e2e suite: one verified creator and
// one active ZAR campaign to donate to. Used by CI (fresh database) and safe
// to re-run — it upserts by email/title.
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:28017/ubuntu-fund'
await mongoose.connect(uri)
const db = mongoose.connection.db

const now = new Date()
const passwordHash = await bcrypt.hash('SeededCreator123!', 12)

await db.collection('users').updateOne(
  { email: 'seed-creator@ubuntufund.dev' },
  {
    $setOnInsert: {
      email: 'seed-creator@ubuntufund.dev',
      name: 'Seeded Creator',
      passwordHash,
      role: 'user',
      trustScore: 80,
      emailVerified: true,
      country: 'South Africa',
      createdAt: now,
      updatedAt: now,
    },
    $set: { verificationLevel: 3 },
  },
  { upsert: true }
)
const creator = await db.collection('users').findOne({ email: 'seed-creator@ubuntufund.dev' })

await db.collection('campaigns').updateOne(
  { title: 'Seeded Water Project' },
  {
    $setOnInsert: {
      title: 'Seeded Water Project',
      description:
        'Seed campaign for automated end-to-end tests: clean water infrastructure for rural schools.',
      goalAmount: 100000,
      raisedAmount: 0,
      currency: 'ZAR',
      category: 'community',
      priority: 'normal',
      creatorId: creator._id.toString(),
      beneficiaries: ['Seeded Beneficiary'],
      imageUrls: [],
      startDate: now,
      endDate: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    },
    $set: { status: 'active' },
  },
  { upsert: true }
)

console.log('e2e seed complete')
await mongoose.disconnect()
