// Rich local-dev seed: realistic Ghana campaigns, creators, and donations so
// the running apps show clean Ghana data. Wipes campaigns + donations, keeps
// existing users, and ensures a demo donor + Ghanaian creators exist.
// Run: cd apps/api && MONGODB_URI=mongodb://127.0.0.1:28017/ubuntu-fund node scripts/seed-dev.mjs
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:28017/ubuntu-fund'
await mongoose.connect(uri)
const db = mongoose.connection.db
const now = new Date()
const days = (n) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000)

async function ensureUser({ email, name, password, country, role = 'user', trustScore = 75, level = 2 }) {
  const passwordHash = await bcrypt.hash(password, 12)
  await db.collection('users').updateOne(
    { email },
    {
      $setOnInsert: {
        email, name, passwordHash, role,
        trustScore, emailVerified: true, country,
        createdAt: now, updatedAt: now,
      },
      $set: { verificationLevel: level },
    },
    { upsert: true }
  )
  return db.collection('users').findOne({ email })
}

// --- Creators (Ghanaian) + demo donor the login card uses ---
const ama = await ensureUser({ email: 'seed-creator@ubuntufund.dev', name: 'Ama Mensah', password: 'SeededCreator123!', country: 'Ghana', trustScore: 88, level: 3 })
const kwame = await ensureUser({ email: 'kwame.boateng@ubuntufund.dev', name: 'Kwame Boateng', password: 'SeededCreator123!', country: 'Ghana', trustScore: 82, level: 3 })
const efua = await ensureUser({ email: 'efua.asante@ubuntufund.dev', name: 'Efua Asante', password: 'SeededCreator123!', country: 'Ghana', trustScore: 79, level: 2 })
const amara = await ensureUser({ email: 'amara2@ubuntufund.com', name: 'Amara Osei', password: 'ubuntu2026!', country: 'Ghana', trustScore: 70, level: 1 })
const kojo = await ensureUser({ email: 'kojo.antwi@ubuntufund.dev', name: 'Kojo Antwi', password: 'SeededCreator123!', country: 'Ghana', trustScore: 65, level: 1 })
const abena = await ensureUser({ email: 'abena.sarpong@ubuntufund.dev', name: 'Abena Sarpong', password: 'SeededCreator123!', country: 'Ghana', trustScore: 60, level: 1 })

// --- Fresh campaigns (Ghana) ---
await db.collection('campaigns').deleteMany({})
await db.collection('donations').deleteMany({})

const campaigns = [
  {
    title: 'Clean Water for Tamale Schools',
    description: 'Install borehole water systems and storage tanks across five basic schools in the Tamale metropolis so 3,200 pupils have safe drinking water through the dry season.',
    goalAmount: 120000, raisedAmount: 84500, category: 'community', priority: 'normal',
    creatorId: ama._id.toString(), beneficiaries: ['Tamale Basic Schools'], region: 'Northern Region',
    startDate: days(-30), endDate: days(150),
  },
  {
    title: 'Solar Power for Kumasi Rural Clinic',
    description: 'Fund solar panels and battery storage for the Ejisu community clinic near Kumasi so vaccines stay refrigerated through frequent power cuts and night deliveries are safe.',
    goalAmount: 85000, raisedAmount: 61200, category: 'medical', priority: 'critical',
    creatorId: kwame._id.toString(), beneficiaries: ['Ejisu Community Clinic'], region: 'Ashanti Region',
    startDate: days(-20), endDate: days(40),
  },
  {
    title: 'Books for Accra Street Libraries',
    description: 'Stock three street libraries in Accra with 2,000 books and reading tables for children in Jamestown and Nima who cannot afford school materials.',
    goalAmount: 45000, raisedAmount: 12750, category: 'education', priority: 'normal',
    creatorId: efua._id.toString(), beneficiaries: ['Jamestown & Nima children'], region: 'Greater Accra',
    startDate: days(-14), endDate: days(120),
  },
  {
    title: 'Flood Relief for Keta Fishing Families',
    description: 'Emergency food, clean water, and temporary shelter for 180 fishing families in Keta displaced by tidal flooding along the Volta estuary.',
    goalAmount: 200000, raisedAmount: 47300, category: 'emergency', priority: 'urgent',
    creatorId: kojo._id.toString(), beneficiaries: ['Keta fishing community'], region: 'Volta Region',
    startDate: days(-7), endDate: days(60),
  },
  {
    title: 'Cassava Processing Co-op in Techiman',
    description: 'Equip a womens farming cooperative in Techiman with a cassava mill and packaging line to turn harvests into gari for market and create 40 local jobs.',
    goalAmount: 90000, raisedAmount: 33900, category: 'business', priority: 'normal',
    creatorId: abena._id.toString(), beneficiaries: ['Techiman Women Farmers Co-op'], region: 'Bono East',
    startDate: days(-25), endDate: days(90),
  },
  {
    title: 'Maternity Ward Beds for Cape Coast',
    description: 'Replace worn delivery beds and add neonatal warmers at the Cape Coast Metropolitan Hospital maternity ward, serving over 400 births each month.',
    goalAmount: 150000, raisedAmount: 150000, category: 'medical', priority: 'normal',
    creatorId: kwame._id.toString(), beneficiaries: ['Cape Coast Metro Hospital'], region: 'Central Region',
    startDate: days(-90), endDate: days(-2), funded: true,
  },
]

const inserted = []
for (const c of campaigns) {
  const doc = {
    title: c.title, description: c.description,
    goalAmount: c.goalAmount, raisedAmount: c.raisedAmount, currency: 'GHS',
    category: c.category, priority: c.priority,
    creatorId: c.creatorId, beneficiaries: c.beneficiaries, region: c.region,
    imageUrls: [], status: c.funded ? 'funded' : 'active',
    startDate: c.startDate, endDate: c.endDate, createdAt: c.startDate, updatedAt: now,
  }
  const res = await db.collection('campaigns').insertOne(doc)
  inserted.push({ id: res.insertedId.toString(), ...doc })
}

// --- Donations (so leaderboard + my-donations populate) ---
const donors = [
  { user: amara, amounts: [250, 500, 100] },
  { user: kojo, amounts: [1000, 300] },
  { user: abena, amounts: [150, 750] },
  { user: efua, amounts: [2000] },
]
const messages = ['Proud to support this.', 'Ayekoo — keep it up!', 'For our community.', 'Small help, big love.', '']
let di = 0
const donationDocs = []
for (const { user, amounts } of donors) {
  amounts.forEach((amount, i) => {
    const camp = inserted[(di + i) % inserted.length]
    donationDocs.push({
      campaignId: camp.id, donorId: user._id.toString(),
      amount, currency: 'GHS',
      message: messages[(di + i) % messages.length],
      isAnonymous: i === 2,
      createdAt: days(-((di + i) % 20)), updatedAt: now,
    })
    di++
  })
}
if (donationDocs.length) await db.collection('donations').insertMany(donationDocs)

console.log(`dev seed complete: ${inserted.length} campaigns, ${donationDocs.length} donations, 6 users`)
await mongoose.disconnect()
