/**
 * Nextly - reactions.js
 * Real-time floating emoji reaction system over WebRTC DataChannel.
 * Includes rate-limiting/anti-spam protection and organic particle floating physics.
 */

const NextlyReactions = (function () {
  'use strict';

  let stageElement = null;
  let activeDataChannel = null;

  // Anti-spam rate limiting
  const MAX_CLICKS_PER_WINDOW = 5;
  const RATE_WINDOW_MS = 1000;
  let clickTimestamps = [];

  function isRateLimited() {
    const now = Date.now();
    clickTimestamps = clickTimestamps.filter(t => now - t < RATE_WINDOW_MS);
    if (clickTimestamps.length >= MAX_CLICKS_PER_WINDOW) {
      return true;
    }
    clickTimestamps.push(now);
    return false;
  }

  /**
   * Initialize reaction stage
   * @param {HTMLElement|string} stageEl
   */
  function init(stageEl = 'emojiCanvasStage') {
    if (typeof stageEl === 'string') {
      stageElement = document.getElementById(stageEl);
    } else {
      stageElement = stageEl;
    }
  }

  /**
   * Spawn a floating emoji particle
   * @param {string} emoji
   * @param {boolean} isRemote - whether triggered by remote peer
   */
  function spawnFloatingEmoji(emoji, isRemote = false) {
    if (!stageElement) {
      stageElement = document.getElementById('emojiCanvasStage');
      if (!stageElement) return;
    }

    const bubble = document.createElement('div');
    bubble.textContent = emoji;
    bubble.className = 'absolute text-4xl select-none pointer-events-none will-change-transform';
    
    // Randomized lateral starting position
    const randomLeft = Math.floor(15 + Math.random() * 70);
    const randomRotation = (Math.random() - 0.5) * 45;
    const randomScale = 0.85 + Math.random() * 0.45;
    const randomDrift = (Math.random() - 0.5) * 80;

    bubble.style.left = `${randomLeft}%`;
    bubble.style.bottom = '8%';
    bubble.style.opacity = '1';
    bubble.style.transform = `translateY(0) scale(0.7) rotate(0deg)`;
    bubble.style.transition = 'transform 1.35s cubic-bezier(0.2, 0.8, 0.25, 1), opacity 1.35s ease-out';
    bubble.style.zIndex = '45';

    stageElement.appendChild(bubble);

    // Audio cue
    if (window.NextlyCommon) {
      window.NextlyCommon.playSound('pop');
    }

    // Trigger frame animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bubble.style.transform = `translate(${randomDrift}px, -340px) scale(${randomScale * 1.3}) rotate(${randomRotation}deg)`;
        bubble.style.opacity = '0';
      });
    });

    // Cleanup node after animation
    setTimeout(() => {
      if (bubble.parentNode) {
        bubble.parentNode.removeChild(bubble);
      }
    }, 1450);
  }

  /**
   * Trigger reaction when clicked by local user
   * @param {string} emoji
   */
  function triggerReaction(emoji) {
    if (isRateLimited()) {
      if (window.NextlyCommon) {
        window.NextlyCommon.showToast('Reaksi terlalu cepat! Tunggu sebentar...', 'warning', 1200);
      }
      return;
    }

    // Spawn locally
    spawnFloatingEmoji(emoji, false);

    // Broadcast through WebRTC DataChannel if connected
    if (activeDataChannel && activeDataChannel.readyState === 'open') {
      try {
        activeDataChannel.send(JSON.stringify({
          type: 'reaction',
          emoji: emoji,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('Failed to send emoji via DataChannel:', e);
      }
    }
  }

  /**
   * Bind to an open RTCDataChannel
   * @param {RTCDataChannel} channel
   */
  function bindDataChannel(channel) {
    activeDataChannel = channel;
    if (!channel) return;

    channel.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'reaction' && data.emoji) {
          spawnFloatingEmoji(data.emoji, true);
        }
      } catch (err) {
        // Not JSON or other message type
      }
    });
  }

  /**
   * Unbind DataChannel on disconnect
   */
  function unbindDataChannel() {
    activeDataChannel = null;
  }

  return {
    init,
    triggerReaction,
    spawnFloatingEmoji,
    bindDataChannel,
    unbindDataChannel
  };
})();

// Export globally
window.NextlyReactions = NextlyReactions;
