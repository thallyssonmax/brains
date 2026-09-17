import {it,expect} from 'vitest';
import {detectTextLanguage} from './language';
it.each([['This is a beautiful day.','en'],['Esta é uma resposta em português.','pt'],['Hola, cómo estás?','es'],['Bonjour tout le monde','fr'],['こんにちは世界','ja']])('detects %s independent of saved language',(text,language)=>{expect(detectTextLanguage(text,'de')).toEqual({language,reliable:true})});
it('does not claim certainty for an ambiguous word',()=>{expect(detectTextLanguage('gift','pt-BR')).toEqual({language:'pt-BR',reliable:false})});
it('does not guess numbers or empty cards',()=>{expect(detectTextLanguage('12345','en-US').reliable).toBe(false);expect(detectTextLanguage('','en-US').reliable).toBe(false)});
