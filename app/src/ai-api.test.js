import {describe,it,expect} from 'vitest';
import {validateInput,sentencePrompt,imagePlanningPrompt,imagePrompt} from '../api/ai.js';

const input={cardId:'5820477a-5b9a-44eb-aeab-5713b69d9b8e',kind:'sentence',front:'awesome',language:'en-US',vocabulary:['work','friend']};

describe('AI card generation boundary',()=>{
 it('accepts a card request with area language and familiar vocabulary',()=>expect(validateInput(input)).toBe(true));
 it('rejects unsupported action, oversized vocabulary and invalid card id',()=>{
  expect(validateInput({...input,kind:'erase'})).toBe(false);
  expect(validateInput({...input,cardId:'invalid'})).toBe(false);
  expect(validateInput({...input,vocabulary:Array(41).fill('word')})).toBe(false);
 });
 it('requires both front and back content for image generation',()=>{
  expect(validateInput({...input,kind:'image',back:'A truly awesome day.'})).toBe(true);
  expect(validateInput({...input,kind:'image',back:'   '})).toBe(false);
  expect(validateInput({...input,kind:'image'})).toBe(false);
 });
 it('keeps sentence generation in the selected language and passes familiar words as data',()=>{
  const prompt=sentencePrompt(input);
  expect(prompt.system).toContain('target language');
  expect(JSON.parse(prompt.user)).toEqual({target:'awesome',language:'en-US',familiarVocabulary:['work','friend']});
 });
 it('separates semantic planning from the scene-only image prompt',()=>{
  const planning=imagePlanningPrompt({front:'need',back:'I need to put on my shirt.'});
  expect(planning.system).toContain('pista visual forte');
  expect(planning.system).toContain('Não mencione o processo de aprendizagem');
  expect(planning.user).toContain('CARD_FRONT: "need"');
  expect(planning.user).toContain('CARD_BACK: "I need to put on my shirt."');
  const prompt=imagePrompt('A hurried person in pajamas reaches for a clean shirt before leaving home.');
  expect(prompt).toContain('Full-bleed square 1:1 editorial illustration');
  expect(prompt).toContain('scene fills the entire canvas edge to edge');
  expect(prompt.toLowerCase()).not.toContain('flashcard');
  expect(imagePrompt('a'.repeat(2000)).length).toBeLessThanOrEqual(2048);
 });
});
