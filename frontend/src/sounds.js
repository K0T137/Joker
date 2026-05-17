// Synthetic sound effects via Web Audio API — no external files needed.
// All sounds use short oscillator bursts to avoid layout/network overhead.

let ctx = null

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tone(freq, type, startTime, duration, gainPeak, ac) {
  const osc  = ac.createOscillator()
  const gain = ac.createGain()
  osc.type      = type
  osc.frequency.setValueAtTime(freq, startTime)
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.start(startTime)
  osc.stop(startTime + duration)
}

export function playCardPlayed() {
  try {
    const ac = getCtx()
    const t  = ac.currentTime
    tone(200, 'triangle', t,       0.08, 0.12, ac)
    tone(140, 'sine',     t + 0.04, 0.06, 0.06, ac)
  } catch (_) {}
}

export function playBidPlaced() {
  try {
    const ac = getCtx()
    const t  = ac.currentTime
    tone(440, 'sine', t,      0.07, 0.07, ac)
    tone(550, 'sine', t + 0.06, 0.05, 0.04, ac)
  } catch (_) {}
}

export function playTrickWon() {
  try {
    const ac = getCtx()
    const t  = ac.currentTime
    ;[0, 0.08, 0.16].forEach((dt, i) => {
      tone(330 + i * 110, 'sine', t + dt, 0.12, 0.1, ac)
    })
  } catch (_) {}
}

export function playHisht() {
  try {
    const ac = getCtx()
    const t  = ac.currentTime
    tone(200, 'sawtooth', t,       0.15, 0.12, ac)
    tone(160, 'sawtooth', t + 0.1, 0.18, 0.10, ac)
  } catch (_) {}
}

export function playGameOver() {
  try {
    const ac = getCtx()
    const t  = ac.currentTime
    ;[0, 0.12, 0.24, 0.38].forEach((dt, i) => {
      tone(262 + [0, 130, 196, 330][i], 'sine', t + dt, 0.22, 0.14, ac)
    })
  } catch (_) {}
}
