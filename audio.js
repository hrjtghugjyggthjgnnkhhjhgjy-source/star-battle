export let audioCtx = null;

export function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

export function playShootSound() {
  if (!audioCtx) initAudio();
  const osc = audioCtx.createOscillator(); 
  const gain = audioCtx.createGain();
  osc.type = 'square'; 
  osc.frequency.setValueAtTime(800, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
  osc.connect(gain); 
  gain.connect(audioCtx.destination); 
  osc.start(); 
  osc.stop(audioCtx.currentTime + 0.1);
}‌
