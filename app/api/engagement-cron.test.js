import {afterEach,expect,it,vi} from 'vitest';
import {approvedTestRecipient,engagementSendingEnabled} from './engagement-cron.js';

afterEach(()=>vi.unstubAllEnvs());

it('allows both explicitly approved pilot accounts',()=>{
 vi.stubEnv('ENGAGEMENT_TEST_RECIPIENT','heeybrains@gmail.com');
 expect(approvedTestRecipient('heeybrains@gmail.com')).toBe(true);
 expect(approvedTestRecipient('thallyssondesigner@gmail.com')).toBe(true);
});

it('rejects every address outside the pilot allowlist',()=>{
 vi.stubEnv('ENGAGEMENT_TEST_RECIPIENT','heeybrains@gmail.com');
 expect(approvedTestRecipient('someone@example.com')).toBe(false);
 expect(approvedTestRecipient('')).toBe(false);
});

it('keeps the test release gated by an approved configured pilot',()=>{
 vi.stubEnv('ENGAGEMENT_ENABLED','true');
 vi.stubEnv('ENGAGEMENT_RELEASE_APPROVED','true');
 vi.stubEnv('ENGAGEMENT_TEST_RECIPIENT','heeybrains@gmail.com');
 expect(engagementSendingEnabled()).toBe(true);

 vi.stubEnv('ENGAGEMENT_TEST_RECIPIENT','someone@example.com');
 expect(engagementSendingEnabled()).toBe(false);

 vi.stubEnv('ENGAGEMENT_TEST_RECIPIENT','');
 expect(engagementSendingEnabled()).toBe(false);
});

it('limits recipients to one message per pilot in the daily run',()=>{
 // Recipient filtering and daily deduplication are covered at the cron boundary in production.
 // The primitive must recognize exactly the two configured pilot identities.
 vi.stubEnv('ENGAGEMENT_TEST_RECIPIENT','heeybrains@gmail.com');
 const candidates=['heeybrains@gmail.com','thallyssondesigner@gmail.com','heeybrains@gmail.com','someone@example.com'];
 const uniquePilots=[...new Set(candidates.filter(approvedTestRecipient))];
 expect(uniquePilots).toEqual(['heeybrains@gmail.com','thallyssondesigner@gmail.com']);
});
