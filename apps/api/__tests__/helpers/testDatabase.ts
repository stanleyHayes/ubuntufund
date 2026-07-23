import mongoose from 'mongoose';

export async function connectTestDatabase(): Promise<void> {
  const uri = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/ubuntufund_test';
  await mongoose.connect(uri);
}

export async function clearTestDatabase(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

export async function disconnectTestDatabase(): Promise<void> {
  await mongoose.disconnect();
}
