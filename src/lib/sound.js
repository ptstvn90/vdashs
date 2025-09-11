let audio = null;

export function ensureAudio() {
  if (!audio) {
    audio = new Audio("/sounds/alert.mp3");
    audio.loop = true;
  }
  return audio;
}

export async function playAlert() {
  const a = ensureAudio();
  try {
    await a.play();
    return true;
  } catch {
    return false; 
  }
}

export function stopAlert() {
  const a = ensureAudio();
  a.pause();
  a.currentTime = 0;
}
