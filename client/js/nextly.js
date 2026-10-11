/**
 * Nextly - nextly.js
 * Core Controller: WebRTC 1-on-1 PeerConnection, Socket.io Signaling,
 * Track replacement with Canvas pipeline, DataChannel, and UI State Machine.
 */

(function () {
  'use strict';

  // Config
  const SIGNALING_URL = window.NEXTLY_SIGNALING_URL || (window.location.port === '3000' ? window.location.origin : 'http://localhost:3000');
  const RTC_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  // State
  let socket = null;
  let peerConnection = null;
  let dataChannel = null;
  let localRawStream = null;
  let localProcessedStream = null;
  let remoteStream = null;
  let currentPartnerId = null;
  let isInitiator = false;
  let isConnecting = false;
  let isConnected = false;
  let isSimulatedDemo = false;
  let simulatedTimer = null;

  // Hardware states & Camera Flip
  let isMicMuted = false;
  let currentFacingMode = 'user'; // 'user' (depan) | 'environment' (belakang)
  let isMirrored = true;
  let availableVideoDevices = [];
  let currentDeviceIndex = 0;

  // Live Text Chat States
  let isChatOpen = false;
  let unreadChatCount = 0;
  let simulatedChatTimer = null;

  // Helpers
  let callTimer = null;
  let localVisualizer = null;
  let remoteVisualizer = null;

  // DOM Elements
  const elements = {
    // Top bar
    streamStatusText: document.getElementById('streamStatusText'),
    latencyDisplay: document.getElementById('latencyDisplay'),
    p2pPulse: document.getElementById('p2pPulse'),
    p2pDot: document.getElementById('p2pDot'),
    onlineCountBadges: document.querySelectorAll('.online-counter-val'),

    // Remote pane
    remoteVideoContainer: document.getElementById('remoteVideoContainer'),
    remoteVideo: document.getElementById('remoteVideo'),
    remoteStreamCover: document.getElementById('remoteStreamCover'),
    matchingOverlay: document.getElementById('matchingOverlay'),
    partnerIdText: document.getElementById('partnerIdText'),
    talkTimer: document.getElementById('talkTimer'),
    flagReportBtn: document.getElementById('flagReportBtn'),
    remoteAudioBars: document.querySelectorAll('#remoteAudioBars .audio-bar'),

    // Local pane
    localVideoContainer: document.getElementById('localVideoContainer'),
    localVideo: document.getElementById('localVideo'),
    localStreamCover: document.getElementById('localStreamCover'),
    cameraRequiredOverlay: document.getElementById('cameraRequiredOverlay'),
    reconnectCamBtn: document.getElementById('reconnectCamBtn'),
    cameraActiveBadge: document.getElementById('cameraActiveBadge'),
    activeFilterBadge: document.getElementById('activeFilterBadge'),
    activeFilterName: document.getElementById('activeFilterName'),
    toggleMicBtn: document.getElementById('toggleMicBtn'),
    micIcon: document.getElementById('micIcon'),
    flipCameraBtn: document.getElementById('flipCameraBtn'),
    flipCamIcon: document.getElementById('flipCamIcon'),
    toggleMirrorBtn: document.getElementById('toggleMirrorBtn'),
    mirrorStatusText: document.getElementById('mirrorStatusText'),
    localAudioBars: document.querySelectorAll('#localAudioBars .audio-bar'),

    // Main action buttons
    startBtn: document.getElementById('startBtn'),
    nextBtn: document.getElementById('nextBtn'),
    stopBtn: document.getElementById('stopBtn'),
    reportModalTrigger: document.getElementById('reportModalTrigger'),

    // Live chat section & controls
    chatDrawer: document.getElementById('chatDrawer'),
    chatToggleBtn: document.getElementById('chatToggleBtn'),
    chatToggleNavBtn: document.getElementById('chatToggleNavBtn'),
    chatBadge: document.getElementById('chatBadge'),
    chatNavBadge: document.getElementById('chatNavBadge'),
    clearChatBtn: document.getElementById('clearChatBtn'),
    closeChatBtn: document.getElementById('closeChatBtn'),
    chatPartnerTag: document.getElementById('chatPartnerTag'),
    chatMessagesList: document.getElementById('chatMessagesList'),
    chatEmptyState: document.getElementById('chatEmptyState'),
    chatForm: document.getElementById('chatForm'),
    chatInput: document.getElementById('chatInput'),
    sendChatBtn: document.getElementById('sendChatBtn'),

    // Effects drawer
    effectsToggleBtn: document.getElementById('effectsToggleBtn'),
    effectsDrawer: document.getElementById('effectsDrawer'),
    closeEffectsBtn: document.getElementById('closeEffectsBtn'),

    // Modals
    reportModal: document.getElementById('reportModal'),
    closeReportBtn: document.getElementById('closeReportBtn'),
    cancelReportBtn: document.getElementById('cancelReportBtn'),
    reportForm: document.getElementById('reportForm')
  };

  /**
   * Initialize Application
   */
  async function init() {
    // Setup Reactions
    if (window.NextlyReactions) {
      window.NextlyReactions.init('emojiCanvasStage');
    }

    // Setup Call Timer
    if (window.NextlyCommon && elements.talkTimer) {
      callTimer = new window.NextlyCommon.CallTimer(elements.talkTimer);
    }

    // Bind UI Event Listeners
    bindUIEvents();

    // Setup Hotkeys (Space: Next, Esc: Stop)
    if (window.NextlyCommon) {
      window.NextlyCommon.setupKeyboardShortcuts({
        onNext: handleNext,
        onStop: handleStop
      });
    }

    // Try connecting to Signaling Server
    initSignaling();
  }

  /**
   * Connect to Socket.io Signaling Server
   */
  function initSignaling() {
    if (typeof io === 'undefined') {
      console.warn('Socket.io client library not loaded. Enabling standalone simulated mode.');
      isSimulatedDemo = true;
      return;
    }

    try {
      socket = io(SIGNALING_URL, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        timeout: 4000
      });

      socket.on('connect', () => {
        console.log('Connected to Nextly signaling server:', socket.id);
        isSimulatedDemo = false;
        if (window.NextlyCommon) {
          window.NextlyCommon.showToast('Terhubung ke signaling server', 'success');
        }
      });

      socket.on('connect_error', () => {
        if (!isSimulatedDemo) {
          console.warn('Signaling server unreachable. Switched to responsive demo mode.');
          isSimulatedDemo = true;
        }
      });

      // Signaling Events
      socket.on('online-count', (count) => {
        elements.onlineCountBadges.forEach(el => {
          el.textContent = `${count.toLocaleString('id-ID')} online`;
        });
      });

      socket.on('matched', handlePeerMatched);
      socket.on('offer', handleReceiveOffer);
      socket.on('answer', handleReceiveAnswer);
      socket.on('ice-candidate', handleReceiveIceCandidate);
      socket.on('peer-disconnected', handlePeerDisconnected);
      socket.on('banned', (reason) => {
        alert(`Akses Anda ditangguhkan: ${reason}`);
        handleStop();
      });

    } catch (err) {
      console.warn('Socket initialization failed, using demo mode:', err);
      isSimulatedDemo = true;
    }
  }

  /**
   * Ensure Local Media Stream is Ready (Mandatory Camera Policy & Multi-Camera Support)
   */
  async function ensureLocalMedia(forceRefresh = false) {
    if (localRawStream && !forceRefresh) {
      const activeVideoTrack = localRawStream.getVideoTracks().find(t => t.readyState === 'live');
      if (activeVideoTrack) {
        if (elements.cameraRequiredOverlay) elements.cameraRequiredOverlay.classList.add('hidden');
        return true;
      }
    }

    try {
      // Query list of video devices if supported
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          availableVideoDevices = devices.filter(d => d.kind === 'videoinput');
        } catch (e) {}
      }

      const videoConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 }
      };

      if (availableVideoDevices.length > 1 && availableVideoDevices[currentDeviceIndex]) {
        videoConstraints.deviceId = { exact: availableVideoDevices[currentDeviceIndex].deviceId };
      } else {
        videoConstraints.facingMode = currentFacingMode;
      }

      const stream = await window.NextlyCommon.requestUserMedia({
        video: videoConstraints,
        audio: true
      });

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('Perangkat kamera video tidak terdeteksi.');
      }

      // Mandatory camera enforcement: listen for camera disconnection/mute
      videoTrack.onended = () => handleCameraLost('Sinyal kamera terputus.');
      videoTrack.onmute = () => handleCameraLost('Kamera dinonaktifkan oleh sistem.');

      localRawStream = stream;

      // Pass raw stream to Canvas Effects Pipeline
      if (window.NextlyEffects) {
        localProcessedStream = await window.NextlyEffects.setRawStream(stream);
      } else {
        localProcessedStream = stream;
      }

      // Render local preview video
      if (elements.localVideo) {
        elements.localVideo.srcObject = localProcessedStream;
        elements.localVideo.play().catch(() => {});
        if (elements.localStreamCover) {
          elements.localStreamCover.style.display = 'none';
        }
      }

      if (elements.cameraRequiredOverlay) {
        elements.cameraRequiredOverlay.classList.add('hidden');
      }

      // Apply current mirror state to local view
      setMirrorMode(isMirrored);

      // Attach audio visualizer to local microphone
      if (window.NextlyCommon && elements.localAudioBars.length > 0) {
        if (localVisualizer) localVisualizer.stop();
        localVisualizer = window.NextlyCommon.attachAudioVisualizer(localRawStream, elements.localAudioBars);
      }

      return true;
    } catch (err) {
      console.error('Camera/mic access error:', err);
      handleCameraLost(err.message || 'Kamera tidak terdeteksi.');
      return false;
    }
  }

  /**
   * Flip Camera Facing / Switch Video Input Device
   */
  async function handleFlipCamera() {
    if (window.NextlyCommon) {
      window.NextlyCommon.playSound('next');
    }

    // If multiple camera devices detected, cycle them
    if (availableVideoDevices.length > 1) {
      currentDeviceIndex = (currentDeviceIndex + 1) % availableVideoDevices.length;
      const nextDevice = availableVideoDevices[currentDeviceIndex];
      const label = nextDevice.label || `Kamera #${currentDeviceIndex + 1}`;
      
      const isRear = label.toLowerCase().includes('back') || label.toLowerCase().includes('rear') || label.toLowerCase().includes('environment');
      if (isRear) {
        currentFacingMode = 'environment';
        setMirrorMode(false);
      } else {
        currentFacingMode = 'user';
        setMirrorMode(true);
      }
      if (window.NextlyCommon) {
        window.NextlyCommon.showToast(`Beralih ke: ${label}`, 'info');
      }
    } else {
      // Toggle facingMode between user and environment
      currentFacingMode = (currentFacingMode === 'user' ? 'environment' : 'user');
      if (currentFacingMode === 'environment') {
        setMirrorMode(false);
        if (window.NextlyCommon) {
          window.NextlyCommon.showToast('Beralih ke Kamera Belakang', 'info');
        }
      } else {
        setMirrorMode(true);
        if (window.NextlyCommon) {
          window.NextlyCommon.showToast('Beralih ke Kamera Depan', 'info');
        }
      }
    }

    // Stop old video track cleanly before switching
    if (localRawStream) {
      localRawStream.getVideoTracks().forEach(t => t.stop());
    }

    // Re-acquire camera stream with new constraints
    const ok = await ensureLocalMedia(true);
    if (ok) {
      // Smoothly update track in WebRTC connection for the peer
      updateActiveVideoTrack();
    }
  }

  /**
   * Set Mirror Mode (Horizontal Flip)
   */
  function setMirrorMode(enable) {
    isMirrored = enable;
    if (elements.localVideo) {
      elements.localVideo.classList.toggle('unmirrored', !isMirrored);
    }
    if (elements.localStreamCover) {
      elements.localStreamCover.classList.toggle('unmirrored', !isMirrored);
    }
    if (elements.toggleMirrorBtn) {
      elements.toggleMirrorBtn.classList.toggle('text-secondary', isMirrored);
      elements.toggleMirrorBtn.classList.toggle('text-on-surface-variant', !isMirrored);
    }
    if (elements.mirrorStatusText) {
      elements.mirrorStatusText.textContent = isMirrored ? 'Self-View: Mirror' : 'Self-View: Asli (Non-Mirror)';
    }
  }

  /**
   * Toggle Mirror Mode
   */
  function handleToggleMirror() {
    setMirrorMode(!isMirrored);
    if (window.NextlyCommon) {
      window.NextlyCommon.playSound('pop');
      window.NextlyCommon.showToast(isMirrored ? 'Mode Cermin Aktif (Mirror)' : 'Mode Asli Aktif (Tidak Dicermin)', 'info');
    }
  }

  /**
   * Handle Camera Lost or Disconnected
   */
  function handleCameraLost(reason = '') {
    console.warn('Camera lost/unavailable:', reason);
    if (elements.cameraRequiredOverlay) {
      elements.cameraRequiredOverlay.classList.remove('hidden');
    }
    if (window.NextlyCommon) {
      window.NextlyCommon.showToast('Kamera wajib aktif! Obrolan dijeda.', 'error', 4000);
    }
    handleStop();
  }

  /**
   * Action: Start Session
   */
  async function handleStart() {
    if (isConnected || isConnecting) return;

    const mediaOk = await ensureLocalMedia();
    if (!mediaOk) return;

    isConnecting = true;
    setUIStateSearching();

    if (window.NextlyCommon) {
      window.NextlyCommon.playSound('connect');
    }

    if (isSimulatedDemo || !socket || !socket.connected) {
      runSimulatedMatching();
      return;
    }

    // Send Join event to server
    socket.emit('join');
  }

  /**
   * Action: Next (Skip to next peer)
   */
  async function handleNext() {
    if (window.NextlyCommon) {
      window.NextlyCommon.playSound('next');
    }

    // Clean current peer
    closeCurrentPeer();

    // Ensure camera is still active
    const mediaOk = await ensureLocalMedia();
    if (!mediaOk) return;

    isConnecting = true;
    setUIStateSearching();

    if (isSimulatedDemo || !socket || !socket.connected) {
      runSimulatedMatching();
      return;
    }

    socket.emit('next');
  }

  /**
   * Action: Stop Session
   */
  function handleStop() {
    if (window.NextlyCommon) {
      window.NextlyCommon.playSound('stop');
    }

    closeCurrentPeer();

    if (socket && socket.connected) {
      socket.emit('stop');
    }

    setUIStateDisconnected();
  }

  /**
   * Close Peer Connection
   */
  function closeCurrentPeer() {
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    if (dataChannel) {
      dataChannel.close();
      dataChannel = null;
    }
    if (window.NextlyReactions) {
      window.NextlyReactions.unbindDataChannel();
    }
    if (callTimer) {
      callTimer.stop();
    }
    if (remoteVisualizer) {
      remoteVisualizer.stop();
      remoteVisualizer = null;
    }
    if (elements.remoteVideo) {
      elements.remoteVideo.srcObject = null;
    }

    clearChat();

    isConnected = false;
    isConnecting = false;
  }

  /**
   * Create RTCPeerConnection and bind tracks
   */
  function createPeerConnection() {
    peerConnection = new RTCPeerConnection(RTC_CONFIG);

    // Add local tracks (canvas processed video + raw microphone audio)
    if (localProcessedStream && localRawStream) {
      const videoTrack = localProcessedStream.getVideoTracks()[0];
      const audioTrack = localRawStream.getAudioTracks()[0];

      if (videoTrack) peerConnection.addTrack(videoTrack, localProcessedStream);
      if (audioTrack) peerConnection.addTrack(audioTrack, localRawStream);
    }

    // Remote Track Listener
    peerConnection.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      remoteStream = event.streams[0] || new MediaStream([event.track]);
      if (elements.remoteVideo) {
        elements.remoteVideo.srcObject = remoteStream;
        elements.remoteVideo.play().catch(() => {});
        if (elements.remoteStreamCover) {
          elements.remoteStreamCover.style.display = 'none';
        }
      }

      // Attach audio visualizer to remote peer
      if (window.NextlyCommon && elements.remoteAudioBars.length > 0) {
        remoteVisualizer = window.NextlyCommon.attachAudioVisualizer(remoteStream, elements.remoteAudioBars);
      }
    };

    // ICE Candidate Listener
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socket && socket.connected) {
        socket.emit('ice-candidate', {
          target: currentPartnerId,
          candidate: event.candidate
        });
      }
    };

    // Connection State Change
    peerConnection.onconnectionstatechange = () => {
      console.log('ICE Connection state:', peerConnection.connectionState);
      if (peerConnection.connectionState === 'connected') {
        setUIStateConnected();
      } else if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
        handlePeerDisconnected();
      }
    };

    return peerConnection;
  }

  /**
   * Handle 'matched' event from server
   */
  async function handlePeerMatched(data) {
    currentPartnerId = data.partnerId;
    isInitiator = data.isInitiator;
    console.log(`Matched with ${currentPartnerId}, initiator: ${isInitiator}`);

    createPeerConnection();

    if (isInitiator) {
      // Create DataChannel
      dataChannel = peerConnection.createDataChannel('nextly_channel', { ordered: true });
      setupDataChannel(dataChannel);

      // Create Offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      socket.emit('offer', {
        target: currentPartnerId,
        sdp: peerConnection.localDescription
      });
    } else {
      // Receiver listens for DataChannel
      peerConnection.ondatachannel = (event) => {
        dataChannel = event.channel;
        setupDataChannel(dataChannel);
      };
    }
  }

  /**
   * Handle incoming WebRTC Offer
   */
  async function handleReceiveOffer(data) {
    if (!peerConnection) createPeerConnection();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('answer', {
      target: data.senderId,
      sdp: peerConnection.localDescription
    });
  }

  /**
   * Handle incoming WebRTC Answer
   */
  async function handleReceiveAnswer(data) {
    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    }
  }

  /**
   * Handle incoming ICE Candidate
   */
  async function handleReceiveIceCandidate(data) {
    if (peerConnection && data.candidate) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.warn('Error adding ICE candidate:', err);
      }
    }
  }

  /**
   * Handle Peer Disconnection
   */
  function handlePeerDisconnected() {
    if (window.NextlyCommon) {
      window.NextlyCommon.showToast('Teman bicara meninggalkan obrolan.', 'info');
    }
    closeCurrentPeer();
    handleNext();
  }

  /**
   * Setup WebRTC DataChannel
   */
  function setupDataChannel(channel) {
    channel.onopen = () => {
      console.log('WebRTC DataChannel connected.');
      if (window.NextlyReactions) {
        window.NextlyReactions.bindDataChannel(channel);
      }
    };
    channel.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'chat' && data.text) {
          receiveChatMessage(data);
        }
      } catch (err) {
        // Not a chat payload
      }
    });
    channel.onclose = () => {
      console.log('WebRTC DataChannel closed.');
    };
  }

  /**
   * Dynamic Filter Track Replacement (pipeline: sender.replaceTrack)
   */
  async function updateActiveVideoTrack() {
    if (!peerConnection || !window.NextlyEffects) return;

    const newVideoTrack = window.NextlyEffects.getProcessedVideoTrack();
    if (!newVideoTrack) return;

    const senders = peerConnection.getSenders();
    const videoSender = senders.find(s => s.track && s.track.kind === 'video');

    if (videoSender) {
      try {
        await videoSender.replaceTrack(newVideoTrack);
        console.log('Video track smoothly replaced via replaceTrack().');
      } catch (err) {
        console.warn('replaceTrack error:', err);
      }
    }
  }

  // =========================================================================
  // LIVE TEXT CHAT (WebRTC DataChannel P2P Text Messaging - Embedded In-Page)
  // =========================================================================

  function focusChat() {
    if (elements.chatDrawer) {
      elements.chatDrawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    resetUnreadChat();
    if (elements.chatInput) {
      elements.chatInput.focus();
    }
    scrollChatToBottom();
  }

  function openChat() {
    focusChat();
  }

  function closeChat() {
    if (elements.chatInput) {
      elements.chatInput.blur();
    }
  }

  function toggleChat() {
    focusChat();
  }

  function resetUnreadChat() {
    unreadChatCount = 0;
    if (elements.chatBadge) {
      elements.chatBadge.classList.add('hidden');
      elements.chatBadge.textContent = '0';
    }
    if (elements.chatNavBadge) {
      elements.chatNavBadge.classList.add('hidden');
      elements.chatNavBadge.textContent = '0';
    }
  }

  function incrementUnreadChat() {
    unreadChatCount++;
    const displayCount = unreadChatCount > 9 ? '9+' : String(unreadChatCount);
    if (elements.chatBadge) {
      elements.chatBadge.classList.remove('hidden');
      elements.chatBadge.textContent = displayCount;
    }
    if (elements.chatNavBadge) {
      elements.chatNavBadge.classList.remove('hidden');
      elements.chatNavBadge.textContent = displayCount;
    }
  }

  function scrollChatToBottom() {
    if (elements.chatMessagesList) {
      elements.chatMessagesList.scrollTop = elements.chatMessagesList.scrollHeight;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function appendChatMessage({ text, isMe, timestamp, senderName }) {
    if (!elements.chatMessagesList) return;

    if (elements.chatEmptyState) {
      elements.chatEmptyState.style.display = 'none';
    }

    const timeStr = new Date(timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgWrapper = document.createElement('div');
    msgWrapper.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-2.5`;

    const bubble = document.createElement('div');
    bubble.className = `${isMe ? 'chat-bubble-local' : 'chat-bubble-remote'} max-w-[85%] text-xs px-3.5 py-2 break-words leading-relaxed`;
    bubble.innerHTML = escapeHtml(text);

    const meta = document.createElement('span');
    meta.className = `text-[9px] text-on-surface-variant/75 mt-0.5 ${isMe ? 'mr-1' : 'ml-1'} font-mono`;
    meta.textContent = `${timeStr} · ${isMe ? 'Anda' : (senderName || 'Partner')}`;

    msgWrapper.appendChild(bubble);
    msgWrapper.appendChild(meta);
    elements.chatMessagesList.appendChild(msgWrapper);

    scrollChatToBottom();
  }

  function appendSystemChatMessage(text) {
    if (!elements.chatMessagesList) return;

    if (elements.chatEmptyState) {
      elements.chatEmptyState.style.display = 'none';
    }

    const sysEl = document.createElement('div');
    sysEl.className = 'text-center my-2';
    sysEl.innerHTML = `<span class="chat-bubble-system text-[10px] text-on-surface-variant/80 px-2.5 py-0.5 rounded-full inline-block border border-white/5">${escapeHtml(text)}</span>`;
    elements.chatMessagesList.appendChild(sysEl);
    scrollChatToBottom();
  }

  function clearChat() {
    if (elements.chatMessagesList) {
      elements.chatMessagesList.innerHTML = '';
      if (elements.chatEmptyState) {
        elements.chatEmptyState.style.display = 'block';
        elements.chatMessagesList.appendChild(elements.chatEmptyState);
      }
    }
    resetUnreadChat();
    if (simulatedChatTimer) {
      clearTimeout(simulatedChatTimer);
      simulatedChatTimer = null;
    }
  }

  function sendChatMessage(text) {
    const cleanText = (text || '').trim();
    if (!cleanText) return;

    if (!isConnected && !isConnecting) {
      handleStart();
    }

    // Append to local message view
    appendChatMessage({
      text: cleanText,
      isMe: true,
      timestamp: Date.now()
    });

    if (window.NextlyCommon) {
      window.NextlyCommon.playSound('pop');
    }

    // Transmit over WebRTC DataChannel if live
    if (dataChannel && dataChannel.readyState === 'open') {
      try {
        dataChannel.send(JSON.stringify({
          type: 'chat',
          text: cleanText,
          timestamp: Date.now()
        }));
      } catch (err) {
        console.warn('Failed to send chat over DataChannel:', err);
      }
    }

    // If in simulated demo mode or disconnected peer, simulate partner response
    if (isSimulatedDemo || !dataChannel || dataChannel.readyState !== 'open') {
      triggerSimulatedPartnerChat(cleanText);
    }
  }

  function receiveChatMessage(data) {
    if (!data || !data.text) return;

    const isInputFocused = elements.chatInput && document.activeElement === elements.chatInput;
    if (!isInputFocused) {
      incrementUnreadChat();
      if (window.NextlyCommon) {
        window.NextlyCommon.playSound('chat');
        window.NextlyCommon.showToast(`Pesan baru dari Partner: "${data.text.slice(0, 32)}${data.text.length > 32 ? '...' : ''}"`, 'info', 3000);
      }
    } else {
      if (window.NextlyCommon) {
        window.NextlyCommon.playSound('chat');
      }
    }

    appendChatMessage({
      text: data.text,
      isMe: false,
      timestamp: data.timestamp,
      senderName: currentPartnerId || 'Partner'
    });
  }

  function triggerSimulatedPartnerChat(userPrompt = '') {
    if (simulatedChatTimer) clearTimeout(simulatedChatTimer);

    const replies = [
      'Halo juga! Salam kenal ya 😊',
      'Aku dari Bandung nih, kamu lagi di mana?',
      'Suara dan videomu jernih banget di sini 👍',
      'Haha iya bener banget, seru ya!',
      'Lagi santai aja nih malam ini sambil cobain Nextly.',
      'Keren banget fiturnya, lancar tanpa delay!'
    ];

    const randomDelay = Math.floor(1100 + Math.random() * 900);
    simulatedChatTimer = setTimeout(() => {
      const randomReply = replies[Math.floor(Math.random() * replies.length)];
      receiveChatMessage({
        text: randomReply,
        timestamp: Date.now()
      });
    }, randomDelay);
  }

  // =========================================================================
  // SIMULATED DEMO MATCHING (for instant frontend testing before backend run)
  // =========================================================================
  function runSimulatedMatching() {
    if (simulatedTimer) clearTimeout(simulatedTimer);

    // Simulate matchmaking wait time of 1.2s
    simulatedTimer = setTimeout(() => {
      isConnecting = false;
      isConnected = true;
      const demoId = Math.floor(1000 + Math.random() * 9000);
      currentPartnerId = `Partner #${demoId}`;

      setUIStateConnected(currentPartnerId);

      // Random simulated partner portrait cover
      const demoImages = [
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80'
      ];
      const randomImg = demoImages[Math.floor(Math.random() * demoImages.length)];
      if (elements.remoteStreamCover) {
        elements.remoteStreamCover.style.backgroundImage = `url('${randomImg}')`;
        elements.remoteStreamCover.style.display = 'block';
      }

      if (window.NextlyCommon) {
        window.NextlyCommon.showToast(`Terhubung ke ${currentPartnerId}`, 'success');
        window.NextlyCommon.playSound('connect');
      }
    }, 1200);
  }

  // =========================================================================
  // UI STATE MANAGEMENT
  // =========================================================================

  function setUIStateSearching() {
    if (elements.matchingOverlay) elements.matchingOverlay.classList.remove('hidden');
    if (elements.streamStatusText) elements.streamStatusText.innerHTML = '<span class="inline-block px-2 py-0.5 mr-1.5 rounded-full font-label-sm text-[11px] bg-secondary/20 text-secondary">Mencari...</span>Menghubungkan WebRTC';
    if (elements.latencyDisplay) elements.latencyDisplay.textContent = 'Mencari jalur...';
    if (elements.p2pPulse) {
      elements.p2pPulse.classList.remove('hidden');
      elements.p2pPulse.style.backgroundColor = '#4cd7f6';
    }
    if (elements.p2pDot) {
      elements.p2pDot.style.backgroundColor = '#4cd7f6';
      elements.p2pDot.style.boxShadow = '0 0 10px #4cd7f6';
    }
    if (callTimer) callTimer.stop();
  }

  function setUIStateConnected(partnerName = null) {
    if (elements.matchingOverlay) elements.matchingOverlay.classList.add('hidden');
    if (elements.streamStatusText) elements.streamStatusText.innerHTML = '<span class="inline-block px-2 py-0.5 mr-1.5 rounded-full font-label-sm text-[11px] bg-primary/20 text-primary">P2P Terhubung</span>via WebRTC';
    const randMs = Math.floor(22 + Math.random() * 26);
    if (elements.latencyDisplay) elements.latencyDisplay.textContent = `${randMs} ms (Direct P2P)`;
    
    if (elements.p2pPulse) {
      elements.p2pPulse.classList.remove('hidden');
      elements.p2pPulse.style.backgroundColor = '#4edea3';
    }
    if (elements.p2pDot) {
      elements.p2pDot.style.backgroundColor = '#4edea3';
      elements.p2pDot.style.boxShadow = '0 0 10px #4edea3';
    }
    const pName = partnerName || `Partner #${currentPartnerId || '8294'}`;
    if (elements.partnerIdText) {
      elements.partnerIdText.textContent = pName;
    }
    if (elements.chatPartnerTag) {
      elements.chatPartnerTag.textContent = pName;
    }
    appendSystemChatMessage(`Tersambung dengan ${pName}. Obrolan privat & terenkripsi P2P.`);

    if (callTimer) callTimer.start();
  }

  function setUIStateDisconnected() {
    if (elements.matchingOverlay) {
      elements.matchingOverlay.classList.remove('hidden');
      const title = elements.matchingOverlay.querySelector('span.font-headline-md');
      const desc = elements.matchingOverlay.querySelector('p');
      if (title) title.textContent = 'Panggilan Berakhir';
      if (desc) desc.textContent = 'Klik tombol "Mulai" untuk kembali ke antrean live chat.';
    }
    if (elements.streamStatusText) elements.streamStatusText.innerHTML = '<span class="inline-block px-2 py-0.5 mr-1.5 rounded-full font-label-sm text-[11px] bg-outline-variant/30 text-on-surface-variant">Terputus</span>';
    if (elements.latencyDisplay) elements.latencyDisplay.textContent = '-- ms';
    if (elements.p2pPulse) elements.p2pPulse.classList.add('hidden');
    if (elements.p2pDot) {
      elements.p2pDot.style.backgroundColor = '#86948a';
      elements.p2pDot.style.boxShadow = 'none';
    }
    if (elements.remoteStreamCover) {
      elements.remoteStreamCover.style.display = 'none';
    }
    if (callTimer) callTimer.reset();

    if (window.NextlyCommon) {
      window.NextlyCommon.showToast('Obrolan dihentikan.', 'info');
    }
  }

  // =========================================================================
  // DOM EVENT BINDINGS
  // =========================================================================

  function bindUIEvents() {
    // Action Deck
    if (elements.startBtn) elements.startBtn.addEventListener('click', handleStart);
    if (elements.nextBtn) elements.nextBtn.addEventListener('click', handleNext);
    if (elements.stopBtn) elements.stopBtn.addEventListener('click', handleStop);

    // Mic & Camera hardware controls
    if (elements.toggleMicBtn) {
      elements.toggleMicBtn.addEventListener('click', () => {
        isMicMuted = !isMicMuted;
        if (localRawStream) {
          localRawStream.getAudioTracks().forEach(t => t.enabled = !isMicMuted);
        }
        if (elements.micIcon) {
          elements.micIcon.textContent = isMicMuted ? 'mic_off' : 'mic';
        }
        elements.toggleMicBtn.classList.toggle('text-error', isMicMuted);
        if (window.NextlyCommon) {
          window.NextlyCommon.showToast(isMicMuted ? 'Mikrofon dimatikan' : 'Mikrofon aktif');
        }
      });
    }

    // Flip Camera & Mirror Toggles
    if (elements.flipCameraBtn) elements.flipCameraBtn.addEventListener('click', handleFlipCamera);
    if (elements.toggleMirrorBtn) elements.toggleMirrorBtn.addEventListener('click', handleToggleMirror);

    // Reconnect Camera Action
    if (elements.reconnectCamBtn) {
      elements.reconnectCamBtn.addEventListener('click', async () => {
        const ok = await ensureLocalMedia(true);
        if (ok) {
          if (window.NextlyCommon) {
            window.NextlyCommon.showToast('Kamera berhasil diaktifkan kembali.', 'success');
          }
          handleStart();
        }
      });
    }

    // Emoji reaction buttons
    document.querySelectorAll('.emoji-trigger').forEach(btn => {
      btn.addEventListener('click', () => {
        const emoji = btn.getAttribute('data-emoji');
        if (window.NextlyReactions && emoji) {
          window.NextlyReactions.triggerReaction(emoji);
        }
      });
    });

    // Live Text Chat Embedded Section & Form
    if (elements.chatToggleBtn) elements.chatToggleBtn.addEventListener('click', toggleChat);
    if (elements.chatToggleNavBtn) elements.chatToggleNavBtn.addEventListener('click', toggleChat);
    if (elements.closeChatBtn) elements.closeChatBtn.addEventListener('click', closeChat);
    if (elements.clearChatBtn) {
      elements.clearChatBtn.addEventListener('click', () => {
        clearChat();
        if (window.NextlyCommon) {
          window.NextlyCommon.showToast('Riwayat obrolan dibersihkan.', 'info');
        }
      });
    }

    if (elements.chatInput) {
      elements.chatInput.addEventListener('focus', resetUnreadChat);
    }

    if (elements.chatForm) {
      elements.chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (elements.chatInput) {
          const text = elements.chatInput.value;
          elements.chatInput.value = '';
          sendChatMessage(text);
          elements.chatInput.focus();
        }
      });
    }

    // Quick chat suggestion chips
    document.querySelectorAll('.quick-text-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.getAttribute('data-text');
        if (text) {
          sendChatMessage(text);
          if (elements.chatInput) elements.chatInput.focus();
        }
      });
    });

    // Effects Drawer Toggle
    if (elements.effectsToggleBtn && elements.effectsDrawer) {
      elements.effectsToggleBtn.addEventListener('click', () => {
        elements.effectsDrawer.classList.toggle('hidden');
      });
    }
    if (elements.closeEffectsBtn && elements.effectsDrawer) {
      elements.closeEffectsBtn.addEventListener('click', () => {
        elements.effectsDrawer.classList.add('hidden');
      });
    }

    // Background Filter Pills
    document.querySelectorAll('.bg-filter-pill').forEach(btn => {
      btn.addEventListener('click', async () => {
        document.querySelectorAll('.bg-filter-pill').forEach(b => {
          b.classList.remove('active', 'bg-surface-container-high', 'text-on-surface');
          b.classList.add('bg-surface-container', 'text-on-surface-variant');
        });
        btn.classList.add('active', 'bg-surface-container-high', 'text-on-surface');
        btn.classList.remove('bg-surface-container', 'text-on-surface-variant');

        const bgType = btn.getAttribute('data-bg');
        if (window.NextlyEffects) {
          await window.NextlyEffects.setBackgroundFilter(bgType);
          updateActiveVideoTrack();
        }

        if (elements.activeFilterBadge && elements.activeFilterName) {
          elements.activeFilterBadge.classList.remove('hidden');
          elements.activeFilterName.textContent = btn.textContent.trim();
        }

        if (window.NextlyCommon) {
          window.NextlyCommon.showToast(`Latar: ${btn.textContent.trim()} diterapkan.`);
        }
      });
    });

    // Tone LUT Pills
    document.querySelectorAll('.tone-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tone-pill').forEach(b => {
          b.classList.remove('active', 'bg-surface-container-high', 'text-on-surface');
          b.classList.add('bg-surface-container', 'text-on-surface-variant');
        });
        btn.classList.add('active', 'bg-surface-container-high', 'text-on-surface');
        btn.classList.remove('bg-surface-container', 'text-on-surface-variant');

        const tone = btn.getAttribute('data-tone');
        if (window.NextlyEffects) {
          window.NextlyEffects.setToneFilter(tone);
          updateActiveVideoTrack();
        }

        if (elements.activeFilterBadge && elements.activeFilterName) {
          elements.activeFilterBadge.classList.remove('hidden');
          elements.activeFilterName.textContent = btn.textContent.trim();
        }

        if (window.NextlyCommon) {
          window.NextlyCommon.showToast(`Grading: ${btn.textContent.trim()} aktif.`);
        }
      });
    });

    // Report Flow
    const openReportModal = () => {
      if (elements.reportModal) elements.reportModal.classList.remove('hidden');
    };
    const closeReportModal = () => {
      if (elements.reportModal) elements.reportModal.classList.add('hidden');
    };

    if (elements.flagReportBtn) elements.flagReportBtn.addEventListener('click', openReportModal);
    if (elements.reportModalTrigger) elements.reportModalTrigger.addEventListener('click', openReportModal);
    if (elements.closeReportBtn) elements.closeReportBtn.addEventListener('click', closeReportModal);
    if (elements.cancelReportBtn) elements.cancelReportBtn.addEventListener('click', closeReportModal);

    if (elements.reportForm) {
      elements.reportForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const checked = elements.reportForm.querySelector('input[name="reportReason"]:checked');
        const reason = checked ? checked.value : 'harassment';

        if (socket && socket.connected && currentPartnerId) {
          socket.emit('report', { targetId: currentPartnerId, reason: reason });
        }

        closeReportModal();

        if (window.NextlyCommon) {
          window.NextlyCommon.showToast('Laporan terkirim. Beralih ke pengguna berikutnya...', 'warning', 2500);
        }

        handleNext();
      });
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
