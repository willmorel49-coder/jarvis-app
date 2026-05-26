// JARVIS · voice.js
// Mode voix via Web Speech API (reconnaissance + synthèse).
// Gratuit, natif navigateur (Chrome, Safari).

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const speechSynth = window.speechSynthesis;

let recognition = null;
let listening = false;

export function isVoiceSupported() {
  return !!SpeechRecognition && !!speechSynth;
}

export function startListening({ onResult, onEnd, onError }) {
  if (!SpeechRecognition) {
    onError && onError(new Error('Reconnaissance vocale non supportée par ce navigateur.'));
    return;
  }
  if (listening) return;

  recognition = new SpeechRecognition();
  recognition.lang = 'fr-FR';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    onResult && onResult(transcript);
  };
  recognition.onerror = (event) => {
    listening = false;
    onError && onError(event.error || new Error('Erreur reconnaissance vocale'));
  };
  recognition.onend = () => {
    listening = false;
    onEnd && onEnd();
  };

  listening = true;
  recognition.start();
}

export function stopListening() {
  if (recognition && listening) {
    recognition.stop();
    listening = false;
  }
}

export function speak(text, opts = {}) {
  if (!speechSynth) return;
  speechSynth.cancel();
  const utter = new SpeechSynthesisUtterance(stripHtml(text));
  utter.lang = 'fr-FR';
  utter.rate = opts.rate || 1.05;
  utter.pitch = opts.pitch || 1.0;
  utter.volume = opts.volume ?? 1.0;
  // Prefer french voice if available
  const voices = speechSynth.getVoices();
  const fr = voices.find((v) => v.lang.startsWith('fr')) || voices[0];
  if (fr) utter.voice = fr;
  speechSynth.speak(utter);
}

function stripHtml(s) {
  return String(s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
