import {afterEach,expect,it,vi} from 'vitest';
import {approvedTestRecipient,dailyPilotCandidates,engagementSendingEnabled} from './engagement-cron.js';

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

it('selects no more than one daily message per pilot account',()=>{
 vi.stubEnv('ENGAGEMENT_TEST_RECIPIENT','heeybrains@gmail.com');
 const candidates=[
  {email:'heeybrains@gmail.com',campaign:'welcome'},
  {email:'heeybrains@gmail.com',campaign:'review_pending'},
  {email:'thallyssondesigner@gmail.com',campaign:'reactivation'},
  {email:'someone@example.com',campaign:'welcome'},
 ];
 expect(dailyPilotCandidates(candidates)).toEqual([candidates[0],candidates[2]]);
});
