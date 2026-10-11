/**
 * Nextly - effects.js
 * Real-time video processing pipeline using Canvas and MediaPipe Selfie Segmentation.
 * Pipeline:
 * Camera -> hidden <video> -> <canvas> (segmentation + background + color grading)
 *        -> captureStream(30) -> replaceTrack() to RTCPeerConnection
 */

const NextlyEffects = (function () {
  'use strict';

  let rawCameraStream = null;
  let hiddenVideo = null;
  let processingCanvas = null;
  let ctx = null;
  let outputStream = null;
  let animationFrameId = null;

  // MediaPipe
  let selfieSegmentation = null;
  let isMediaPipeLoading = false;
  let isMediaPipeReady = false;
  let lastSegmentationMask = null;

  // Background blur offscreen canvas
  let blurCanvas = null;
  let blurCtx = null;

  // State
  let activeBg = 'normal'; // 'normal', 'blur', 'dark', 'gradient', 'custom'
  let activeTone = 'original'; // 'original', 'warm', 'cyber', 'sepia', 'bw', 'pastel'
  let customBgImage = null;

  // Listeners
  let onTrackReplacedCallback = null;

  /**
   * Initialize the pipeline elements
   */
  function initElements() {
    if (!hiddenVideo) {
      hiddenVideo = document.createElement('video');
      hiddenVideo.autoplay = true;
      hiddenVideo.playsInline = true;
      hiddenVideo.muted = true;
      hiddenVideo.style.display = 'none';
      document.body.appendChild(hiddenVideo);
    }

    if (!processingCanvas) {
      processingCanvas = document.createElement('canvas');
      processingCanvas.width = 1280;
      processingCanvas.height = 720;
      ctx = processingCanvas.getContext('2d', { willReadFrequently: true });
    }

    if (!blurCanvas) {
      blurCanvas = document.createElement('canvas');
      blurCanvas.width = 640;
      blurCanvas.height = 360;
      blurCtx = blurCanvas.getContext('2d');
    }
  }

  /**
   * Load MediaPipe Selfie Segmentation from CDN asynchronously
   */
  async function loadMediaPipe() {
    if (isMediaPipeReady || isMediaPipeLoading) return;
    isMediaPipeLoading = true;

    try {
      if (!window.SelfieSegmentation) {
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js');
      }

      if (window.SelfieSegmentation) {
        selfieSegmentation = new window.SelfieSegmentation({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
        });

        selfieSegmentation.setOptions({
          modelSelection: 1 // 1 for landscape/higher accuracy
        });

        selfieSegmentation.onResults((results) => {
          lastSegmentationMask = results.segmentationMask;
        });

        isMediaPipeReady = true;
        console.log('MediaPipe Selfie Segmentation loaded successfully.');
      }
    } catch (err) {
      console.warn('MediaPipe CDN load failed, falling back to CSS/Canvas filters:', err);
    } finally {
      isMediaPipeLoading = false;
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  /**
   * Set the raw camera stream from navigator.mediaDevices.getUserMedia
   * @param {MediaStream} stream
   */
  async function setRawStream(stream) {
    initElements();
    rawCameraStream = stream;

    hiddenVideo.srcObject = stream;
    await hiddenVideo.play().catch(e => console.warn('Hidden video play error:', e));

    // Match canvas aspect ratio to video
    hiddenVideo.onloadedmetadata = () => {
      if (hiddenVideo.videoWidth && hiddenVideo.videoHeight) {
        processingCanvas.width = hiddenVideo.videoWidth;
        processingCanvas.height = hiddenVideo.videoHeight;
        blurCanvas.width = Math.floor(hiddenVideo.videoWidth / 2);
        blurCanvas.height = Math.floor(hiddenVideo.videoHeight / 2);
      }
    };

    // Capture canvas stream at 30fps
    if (!outputStream) {
      outputStream = processingCanvas.captureStream(30);
    }

    startRenderLoop();
    return outputStream;
  }

  /**
   * Get the tone filter string for canvas 2D rendering
   */
  function getToneFilterString(tone) {
    switch (tone) {
      case 'warm':
        return 'sepia(0.35) saturate(1.3) contrast(1.05)';
      case 'cyber':
        return 'hue-rotate(180deg) saturate(1.25) contrast(1.1)';
      case 'sepia':
        return 'sepia(0.85) contrast(1.1) brightness(0.95)';
      case 'bw':
        return 'grayscale(1) contrast(1.3) brightness(0.98)';
      case 'pastel':
        return 'brightness(1.08) contrast(0.92) saturate(1.2)';
      default:
        return 'none';
    }
  }

  /**
   * Main render loop for canvas pipeline
   */
  function startRenderLoop() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);

    let isProcessingMediaPipe = false;

    async function loop() {
      if (!hiddenVideo || hiddenVideo.readyState < 2) {
        animationFrameId = requestAnimationFrame(loop);
        return;
      }

      const width = processingCanvas.width;
      const height = processingCanvas.height;

      // Check if MediaPipe is needed
      const needsSegmentation = (activeBg !== 'normal') && isMediaPipeReady;

      if (needsSegmentation && selfieSegmentation && !isProcessingMediaPipe) {
        isProcessingMediaPipe = true;
        selfieSegmentation.send({ image: hiddenVideo })
          .then(() => { isProcessingMediaPipe = false; })
          .catch(() => { isProcessingMediaPipe = false; });
      }

      // Render composite frame
      renderFrame(width, height, needsSegmentation);

      animationFrameId = requestAnimationFrame(loop);
    }

    loop();
  }

  /**
   * Draw the composite frame
   */
  function renderFrame(width, height, hasSegmentation) {
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    const toneFilter = getToneFilterString(activeTone);

    // If no background modification or MediaPipe mask not ready yet
    if (activeBg === 'normal' || !hasSegmentation || !lastSegmentationMask) {
      // Direct video with tone filter
      if (toneFilter !== 'none') {
        ctx.filter = toneFilter;
      }
      ctx.drawImage(hiddenVideo, 0, 0, width, height);
      ctx.restore();
      return;
    }

    // --- PIPELINE WITH BACKGROUND REPLACEMENT ---

    // 1. Draw Background
    if (activeBg === 'blur') {
      // Draw heavily blurred background
      ctx.save();
      ctx.filter = 'blur(16px)';
      ctx.drawImage(hiddenVideo, -20, -20, width + 40, height + 40);
      ctx.restore();
    } else if (activeBg === 'dark') {
      // Studio dark background
      ctx.fillStyle = '#0a0e16';
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.drawImage(hiddenVideo, 0, 0, width, height);
      ctx.restore();
    } else if (activeBg === 'gradient') {
      // Cyber aesthetic gradient
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#0a0e16');
      grad.addColorStop(0.5, '#003824');
      grad.addColorStop(1, '#001f26');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    } else if (activeBg === 'custom' && customBgImage && customBgImage.complete) {
      ctx.drawImage(customBgImage, 0, 0, width, height);
    } else {
      ctx.drawImage(hiddenVideo, 0, 0, width, height);
    }

    // 2. Draw Person (Foreground) using Segmentation Mask
    // Use an offscreen canvas or mask clipping
    blurCanvas.width = width;
    blurCanvas.height = height;
    blurCtx.save();
    blurCtx.clearRect(0, 0, width, height);

    // Draw the person video with tone filter
    if (toneFilter !== 'none') {
      blurCtx.filter = toneFilter;
    }
    blurCtx.drawImage(hiddenVideo, 0, 0, width, height);
    blurCtx.filter = 'none';

    // Mask with MediaPipe segmentation mask
    blurCtx.globalCompositeOperation = 'destination-in';
    blurCtx.drawImage(lastSegmentationMask, 0, 0, width, height);
    blurCtx.restore();

    // 3. Composite foreground person onto background
    ctx.drawImage(blurCanvas, 0, 0, width, height);

    ctx.restore();
  }

  /**
   * Set Background Filter
   * @param {'normal'|'blur'|'dark'|'gradient'|'custom'} type
   * @param {string|null} customImgUrl
   */
  async function setBackgroundFilter(type, customImgUrl = null) {
    activeBg = type;

    if (type !== 'normal') {
      if (!isMediaPipeReady && !isMediaPipeLoading) {
        if (window.NextlyCommon) {
          window.NextlyCommon.showToast('Memuat AI Segmentasi MediaPipe...', 'info', 2000);
        }
        await loadMediaPipe();
      }
    }

    if (type === 'custom' && customImgUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = customImgUrl;
      img.onload = () => {
        customBgImage = img;
      };
    }
  }

  /**
   * Set Tone LUT Filter
   * @param {'original'|'warm'|'cyber'|'sepia'|'bw'|'pastel'} tone
   */
  function setToneFilter(tone) {
    activeTone = tone;
  }

  /**
   * Get the processed canvas stream for WebRTC
   */
  function getOutputStream() {
    return outputStream;
  }

  /**
   * Get the active video track from the canvas stream
   */
  function getProcessedVideoTrack() {
    if (outputStream && outputStream.getVideoTracks().length > 0) {
      return outputStream.getVideoTracks()[0];
    }
    return null;
  }

  /**
   * Cleanup pipeline on stop
   */
  function stop() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    if (hiddenVideo) {
      hiddenVideo.pause();
      hiddenVideo.srcObject = null;
    }
    rawCameraStream = null;
    outputStream = null;
  }

  return {
    setRawStream,
    setBackgroundFilter,
    setToneFilter,
    getOutputStream,
    getProcessedVideoTrack,
    stop,
    getActiveBg: () => activeBg,
    getActiveTone: () => activeTone
  };
})();

// Export globally
window.NextlyEffects = NextlyEffects;
