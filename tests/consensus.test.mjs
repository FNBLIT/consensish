import test from 'node:test'; import assert from 'node:assert/strict';
import { reviewDays, defaultDeadline, validateResponse, canAgree } from '../server/domain/consensus.mjs';
test('budget thresholds and policy changes preserve the promised review windows', () => {
  for (const [budget,type,days] of [[0,'Event',7],[1000,'Project',7],[1000.01,'Project',14],[5000,'Project',14],[5000.01,'Project',28],[0,'Policy change',28]]) assert.equal(reviewDays(budget,type),days);
  assert.equal(defaultDeadline(0,'Event',new Date('2026-12-28T12:00:00Z')),'2027-01-04T12:00:00.000Z');
});
test('a block always prevents agreement, and silence alone never establishes agreement', () => {
  assert.equal(canAgree([]),false); assert.equal(canAgree([{position:'STAND ASIDE'}]),false);
  assert.equal(canAgree([{position:'APPROVE'},{position:'BLOCK'}]),false);
  assert.equal(canAgree([{position:'APPROVE'},{position:'EXPRESS CONCERN'}]),true);
});
test('consequential responses require an explanation', () => {
  for(const position of ['BLOCK','EXPRESS CONCERN','SUGGEST MODIFICATION']) assert.throws(()=>validateResponse(position,'  '));
  assert.throws(()=>validateResponse('VOTE YES','yes')); assert.doesNotThrow(()=>validateResponse('APPROVE',''));
});
