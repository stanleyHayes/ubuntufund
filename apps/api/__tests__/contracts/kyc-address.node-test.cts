const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const request = require('supertest');
const { createKYCRoutes } = require('../../src/infrastructure/adapters/inbound/http/routes/kycRoutes.ts');
const { KYCVerificationModel } = require('../../src/infrastructure/database/models/KYCVerificationModel.ts');

test('address proof alternatives validate at the API and GPS survives model serialization', async () => {
  const app = express();
  app.use(express.json());
  const stub = (req: any, res: any) => res.json(req.body);
  const pass = (_req: any, _res: any, next: any) => next();
  app.use('/kyc', createKYCRoutes({ submitIdentity: stub, getStatus: stub, getStats: stub, listPending: stub, approve: stub, reject: stub }, pass, pass));
  app.use((error: any, _req: any, res: any, _next: any) => res.status(error.statusCode ?? 500).json({ message: error.message }));
  const address = { country: 'Ghana', city: 'Accra', proofMethod: 'ghana_post_gps', gpsAddress: 'GA-183-8164' };
  const submit = (value: any, documents: any[] = []) => request(app).post('/kyc/identity').send({ personalInfo: { address: value }, documents });
  await submit(address).expect(200);
  await submit({ ...address, gpsAddress: 'bad' }).expect(400);
  await submit({ ...address, gpsAddress: undefined }).expect(400);
  await submit({ ...address, country: 'Canada' }).expect(400);
  await submit({ country: 'Canada', city: 'Toronto', street: '1 Main St', proofMethod: 'document' }).expect(400);
  await submit({ country: 'Canada', city: 'Toronto', street: '1 Main St', proofMethod: 'document' }, [{ type: 'bank_statement', url: 'https://example.com/proof.pdf' }]).expect(200);
  const model = new KYCVerificationModel({ personalInfo: { address } });
  assert.equal(model.toObject().personalInfo.address.gpsAddress, address.gpsAddress);
  assert.equal(model.toObject().personalInfo.address.proofMethod, address.proofMethod);
});
