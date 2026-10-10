import {describe,it,expect} from 'vitest';
import {validateInput,sentencePrompt,imagePrompt} from '../api/ai.js';

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
 it('builds the pedagogical image prompt with front, back and square text-light guidance',()=>{
  const prompt=imagePrompt({front:'awesome',back:'The view from the mountain was awesome.'});
  expect(prompt).toContain('pista visual forte');
  expect(prompt).toContain('formato 1:1 quadrado');
  expect(prompt).toContain('Por padrão, não inclua texto');
  expect(prompt).toContain('CARD_FRONT: awesome');
  expect(prompt).toContain('CARD_BACK: The view from the mountain was awesome.');
  expect(imagePrompt({front:'a'.repeat(2000),back:'b'.repeat(2000)}).length).toBeLessThanOrEqual(2048);
 });
});
