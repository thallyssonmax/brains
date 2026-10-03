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
 it('keeps sentence generation in the selected language and passes familiar words as data',()=>{
  const prompt=sentencePrompt(input);
  expect(prompt.system).toContain('target language');
  expect(JSON.parse(prompt.user)).toEqual({target:'awesome',language:'en-US',familiarVocabulary:['work','friend']});
 });
 it('asks for a textless image and bounds long card content to model limits',()=>{
  const prompt=imagePrompt({front:'a'.repeat(2000),back:'b'.repeat(2000)});
  expect(prompt).toContain('Absolutely no text');
  expect(prompt.length).toBeLessThan(2048);
 });
});
