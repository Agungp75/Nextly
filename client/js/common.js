/**
 * Nextly - common.js
 * Core utilities: Media permissions, Web Audio API visualizer, Sound effects,
 * Hotkeys, Timers, and Notification Toasts.
 */

const NextlyCommon = (function () {
  'use strict';

  // Audio Context for visualizer and synth sounds
  let audioCtx = null;

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  /**
   * Request user media with graceful error handling
   */
  async function requestUserMedia(constraints = { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: true }) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Browser Anda tidak mendukung akses kamera/mikrofon WebRTC.');
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return stream;
    } catch (err) {
      console.warn('Fallback standard constraints due to:', err);
      // Fallback to basic audio/video if specific constraints failed
      try {
        return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (fallbackErr) {
        throw fallbackErr;
      }
    }
  }

  /**
   * Attach an audio visualizer to an audio track or stream
   * @param {MediaStream} stream
   * @param {HTMLElement[]|NodeList} barElements
   * @returns {{ stop: () => void }}
   */
  function attachAudioVisualizer(stream, barElements) {
    if (!stream || !barElements || barElements.length === 0) return { stop: () => {} };
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return { stop: () => {} };

    try {
      const ctx = getAudioContext();
      if (!ctx) return { stop: () => {} };

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let animationFrameId = null;

      function renderFrame() {
        analyser.getByteFrequencyData(dataArray);

        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;

        // Animate individual bars with dynamic heights
        const numBars = barElements.length;
        for (let i = 0; i < numBars; i++) {
          const bar = barElements[i];
          const freqVal = dataArray[i % bufferLength] || 0;
          // Scale from min 4px to max 18px based on volume
          const height = Math.max(4, Math.min(20, (freqVal / 255) * 20));
          bar.style.height = `${height}px`;
          if (avg > 10) {
            bar.style.opacity = '1';
          } else {
            bar.style.opacity = '0.5';
          }
        }

        animationFrameId = requestAnimationFrame(renderFrame);
      }

      renderFrame();

      return {
        stop: () => {
          if (animationFrameId) cancelAnimationFrame(animationFrameId);
          try {
            source.disconnect();
          } catch (e) {}
        }
      };
    } catch (e) {
      console.warn('Audio visualizer error:', e);
      return { stop: () => {} };
    }
  }

  /**
   * Synthesize sound effects using Web Audio API (Zero external MP3 dependencies)
   */
  function playSound(type = 'connect') {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'connect') {
        // High melodic double chime (emerald success)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.36);
      } else if (type === 'next') {
        // Crisp switch click
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.11);
      } else if (type === 'pop') {
        // Bubble pop sound for reactions
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'stop') {
        // Low warm drop
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.18);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.21);
      } else if (type === 'chat') {
        // Soft crystal notification chime for live chat messages
        osc.type = 'sine';
        osc.frequency.setValueAtTime(784, now); // G5
        osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.08); // C6
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.19);
      }
    } catch (err) {
      // Audio playback restrictions or user hasn't interacted yet
    }
  }

  /**
   * Floating Toast Notification
   */
  function showToast(message, type = 'info', duration = 2500) {
    let toast = document.getElementById('toastNotification');
    let toastMsg = document.getElementById('toastMsg');

    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toastNotification';
      toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-surface-container-highest text-on-surface font-label-md text-label-md shadow-2xl flex items-center gap-2 pointer-events-none transition-all duration-300 opacity-0 translate-y-4';
      toast.innerHTML = `<span class="material-symbols-outlined text-primary text-[18px]" id="toastIcon">info</span><span id="toastMsg"></span>`;
      document.body.appendChild(toast);
      toastMsg = document.getElementById('toastMsg');
    }

    const toastIcon = document.getElementById('toastIcon');
    if (toastIcon) {
      if (type === 'success') {
        toastIcon.textContent = 'check_circle';
        toastIcon.className = 'material-symbols-outlined text-primary text-[18px]';
      } else if (type === 'warning' || type === 'error') {
        toastIcon.textContent = 'warning';
        toastIcon.className = 'material-symbols-outlined text-error text-[18px]';
      } else {
        toastIcon.textContent = 'info';
        toastIcon.className = 'material-symbols-outlined text-secondary text-[18px]';
      }
    }

    if (toastMsg) toastMsg.textContent = message;

    toast.classList.remove('opacity-0', 'translate-y-4');
    toast.classList.add('opacity-100', 'translate-y-0');

    if (toast._timer) clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('opacity-100', 'translate-y-0');
      toast.classList.add('opacity-0', 'translate-y-4');
    }, duration);
  }

  /**
   * Call Timer Class
   */
  class CallTimer {
    constructor(displayElement) {
      this.displayEl = displayElement;
      this.seconds = 0;
      this.interval = null;
    }

    start() {
      this.reset();
      this.interval = setInterval(() => {
        this.seconds++;
        this.render();
      }, 1000);
      this.render();
    }

    stop() {
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = null;
      }
    }

    reset() {
      this.stop();
      this.seconds = 0;
      this.render();
    }

    render() {
      if (!this.displayEl) return;
      const mins = String(Math.floor(this.seconds / 60)).padStart(2, '0');
      const secs = String(this.seconds % 60).padStart(2, '0');
      this.displayEl.textContent = `${mins}:${secs}`;
    }
  }

  /**
   * Setup hotkeys for instant desktop controls:
   * Space: Next
   * Esc: Stop / Close Modal
   */
  function setupKeyboardShortcuts({ onNext, onStop, onToggleModal }) {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (typeof onNext === 'function') onNext();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        if (typeof onStop === 'function') onStop();
      }
    });
  }

  return {
    requestUserMedia,
    attachAudioVisualizer,
    playSound,
    showToast,
    CallTimer,
    setupKeyboardShortcuts,
    getAudioContext
  };
})();

// Export globally
window.NextlyCommon = NextlyCommon;
