/**
 * Zero-dependency, 120fps Gesture & Tactile Feedback Utilities
 */

/**
 * Triggers hardware haptic vibration feedback on supported devices (Mobile Chrome, Android, iOS PWA)
 * @param {'light' | 'medium' | 'success' | 'warning' | 'error'} type 
 */
export function triggerHaptic(type = 'light') {
  if (typeof window === 'undefined' || !navigator.vibrate) return

  try {
    switch (type) {
      case 'light':
        navigator.vibrate(8)
        break
      case 'medium':
        navigator.vibrate(18)
        break
      case 'success':
        navigator.vibrate([12, 40, 16])
        break
      case 'warning':
        navigator.vibrate([20, 60, 20])
        break
      case 'error':
        navigator.vibrate([40, 50, 40, 50, 40])
        break
      default:
        navigator.vibrate(10)
    }
  } catch (e) {}
}

/**
 * Audio tick synthesizer for rich tactile sound feedback
 */
let audioCtx = null
export function playHapticTick(pitch = 800, duration = 0.03) {
  if (typeof window === 'undefined') return
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    if (!audioCtx) audioCtx = new AudioContext()
    if (audioCtx.state === 'suspended') audioCtx.resume()

    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(pitch, audioCtx.currentTime)
    gain.gain.setValueAtTime(0.04, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration)

    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start()
    osc.stop(audioCtx.currentTime + duration)
  } catch (e) {}
}
