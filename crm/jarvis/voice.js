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
    // event.error est une string (ex: "not-allowed", "no-speech", "network") — pas une Error
    const msg = event.error || 'Erreur reconnaissance vocale';
    onError && onError(new Error(String(msg)));
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

  // Chrome bug : getVoices() peut retourner [] si la liste n'est pas encore chargée.
  // On tente d'assigner la voix FR maintenant, et si elle n'est pas dispo on laisse
  // la voix par défaut (utter.voice = undefined = comportement correct).
  const trySetVoice = () => {
    const voices = speechSynth.getVoices();
    if (voices.length) {
      const fr = voices.find((v) => v.lang.startsWith('fr')) || null;
      if (fr) utter.voice = fr;
    }
  };
  trySetVoice();
  if (!utter.voice && speechSynth.onvoiceschanged !== undefined) {
    // Voix pas encore chargées — attendre l'événement, puis parler
    const prev = speechSynth.onvoiceschanged;
    speechSynth.onvoiceschanged = () => {
      speechSynth.onvoiceschanged = prev;
      trySetVoice();
      speechSynth.speak(utter);
    };
    return;
  }
  speechSynth.speak(utter);
}

function stripHtml(s) {
  return String(s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
