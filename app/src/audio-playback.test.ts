import {afterEach,expect,it,vi} from 'vitest';
import {speak} from './Media';
import {translator} from './i18n';
import {cancelSpeech} from './voice';
afterEach(()=>{cancelSpeech();vi.unstubAllGlobals()});
function setup(voices=[{name:'English',lang:'en-US',default:true}]){
 const synth={getVoices:()=>voices,cancel:vi.fn(),speak:vi.fn()};
 vi.stubGlobal('window',{speechSynthesis:synth});
 vi.stubGlobal('SpeechSynthesisUtterance',class{constructor(public text:string){}});
 return synth;
}
it.each([1/3,.5,1,2,3])('passes speed %s to reference speech while keeping the requested language',rate=>{
 const synth=setup(),error=vi.fn(),finish=vi.fn();
 speak('Awesome','en-US',translator('pt'),error,rate,finish);
 const utterance=synth.speak.mock.calls[0][0];
 expect(utterance).toMatchObject({text:'Awesome',lang:'en-US',rate});
 utterance.onend();expect(finish).toHaveBeenCalledOnce();
});
it('ends playback with a useful error when the requested voice is unavailable',()=>{
 const synth=setup(),error=vi.fn(),finish=vi.fn();
 speak('Olá','pt-BR',translator('pt'),error,.5,finish);
 expect(synth.speak).not.toHaveBeenCalled();expect(error).toHaveBeenLastCalledWith(translator('pt')('voiceUnavailable'));expect(finish).toHaveBeenCalledOnce();
});
