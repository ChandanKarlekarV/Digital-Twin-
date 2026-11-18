/**
 * End-to-end voice assistant checks: recogniser results -> wake word -> parser -> answer.
 * Browser speech APIs are absent in Node, so this exercises the logic around them.
 * Run: npx tsx src/test/voiceAssistant.test.ts
 */
import { varunaVoiceCommander } from '../voice/VarunaVoiceCommander';
import { varunaVoice } from '../voice/VarunaVoiceSynthesizer';
import { useRigStore } from '../store/useRigStore';

let fail = 0;
const check = (ok: boolean, label: string, got: unknown) => {
  if (!ok) fail++;
  console.log(ok ? 'ok  ' : 'FAIL', label.padEnd(52), '->', got);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const engine = varunaVoiceCommander as any;

/** A Web Speech "result" event with one final utterance */
const heard = (text: string, isFinal = true) => {
  const result: any = [{ transcript: text }];
  result.isFinal = isFinal;
  return { resultIndex: 0, results: [result] };
};
const reply = () => useRigStore.getState().voiceStatus.lastMessage;
const asleep = () => useRigStore.setState({ isVarunaAwake: false, varunaWakeExpiry: 0, voiceTranscript: null });

(async () => {
  // 1. Asleep: ordinary speech is ignored
  asleep();
  useRigStore.getState().setVoiceStatus({ isSpeaking: false, lastMessage: 'start' });
  engine.handleResult(heard('is there a leak'));
  await sleep(150);
  check(reply() === 'start', 'asleep: no wake word, no reply', reply());

  // 2. Wake word and question in one breath
  engine.resetDebounce();
  engine.handleResult(heard('Varuna is there a leak'));
  await sleep(150);
  check(/leak|balance/i.test(reply()), '"Varuna is there a leak" is answered', reply());

  // 3. Regression: a stuck "speaking" flag (speech dropped by the browser) must not deafen VARUNA
  asleep();
  engine.resetDebounce();
  useRigStore.getState().setVoiceStatus({ isSpeaking: true, lastMessage: 'stuck' });
  engine.handleResult(heard('Varuna what is the tide'));
  await sleep(150);
  check(reply() !== 'stuck', 'stuck speaking flag no longer blocks listening', reply());

  // 4. Wake button, then a question without the wake word
  asleep();
  engine.resetDebounce();
  varunaVoiceCommander.wake();
  check(useRigStore.getState().isVarunaAwake, 'Wake button opens the listening window', useRigStore.getState().isVarunaAwake);
  useRigStore.getState().setVoiceStatus({ isSpeaking: false, lastMessage: 'before' });
  engine.handleResult(heard('is there a leak'));
  await sleep(150);
  check(/leak|balance/i.test(reply()), 'after Wake, "is there a leak" is answered', reply());

  // 5. Typed question works with no microphone at all
  asleep();
  useRigStore.getState().setVoiceStatus({ isSpeaking: false, lastMessage: 'before' });
  varunaVoiceCommander.ask('what is the manifold pressure');
  await sleep(150);
  check(reply() !== 'before', 'typed question is answered', reply());

  // 6. Speech watchdog: the speaking flag always clears
  await varunaVoice.speakCustom('Testing the watchdog.');
  await sleep(200);
  check(!useRigStore.getState().voiceStatus.isSpeaking, 'speaking flag clears after speech', useRigStore.getState().voiceStatus.isSpeaking);

  console.log(fail ? `${fail} failures` : 'all passed');
  process.exit(fail ? 1 : 0);
})();
