import {afterEach,expect,it,vi} from 'vitest';
import {withLoadedVoices} from './voice';
afterEach(()=>vi.useRealTimers());
function source(){const events=new EventTarget();let voices:SpeechSynthesisVoice[]=[];return {synth:{getVoices:()=>voices,addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events)} as unknown as SpeechSynthesis,load(){voices=[{name:'Natural',lang:'en-US'} as SpeechSynthesisVoice];events.dispatchEvent(new Event('voiceschanged'))}}}
it('delivers voices after asynchronous loading only once',()=>{vi.useFakeTimers();const s=source(),ready=vi.fn();withLoadedVoices(s.synth,ready);expect(ready).not.toHaveBeenCalled();s.load();vi.runAllTimers();expect(ready).toHaveBeenCalledTimes(1);expect(ready.mock.calls[0][0][0].lang).toBe('en-US')});
it('cancels a pending request so leaving a screen cannot start audio',()=>{vi.useFakeTimers();const s=source(),ready=vi.fn();const cancel=withLoadedVoices(s.synth,ready);cancel();s.load();vi.runAllTimers();expect(ready).not.toHaveBeenCalled()});
it('finishes after a bounded wait when the device has no voices',()=>{vi.useFakeTimers();const s=source(),ready=vi.fn();withLoadedVoices(s.synth,ready);vi.advanceTimersByTime(3000);expect(ready).toHaveBeenCalledWith([]);s.load();expect(ready).toHaveBeenCalledTimes(1)});
