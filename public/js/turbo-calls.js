/**
 * TurboNetwork TurboCalls Engine
 * WebRTC P2P Voice & Video Calls for Staff + Customer Remote Video-Support Rooms
 */

(function (window) {
  'use strict';

  // Configuración STUN pública de Google
  const RTC_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  const TurboCalls = {
    options: {
      getUserId: () => '',
      getUserName: () => 'Usuario',
      getUserAvatar: () => '',
      getTenantId: () => 'turbonetwork',
    },

    // Getters con recuperación en cascada (options -> window.currentUser -> localStorage)
    getUserId() {
      if (typeof this.options.getUserId === 'function') {
        const id = this.options.getUserId();
        if (id) return String(id);
      }
      if (typeof window.currentUser !== 'undefined' && window.currentUser && (window.currentUser.id || window.currentUser.username)) {
        return String(window.currentUser.id || window.currentUser.username);
      }
      try {
        const sess = localStorage.getItem('turbonetwork_session') || localStorage.getItem('turbonetwork_active_user');
        if (sess) {
          const parsed = JSON.parse(sess);
          if (parsed && (parsed.id || parsed.username)) return String(parsed.id || parsed.username);
        }
      } catch (_) {}
      return '';
    },

    getUserName() {
      if (typeof this.options.getUserName === 'function') {
        const name = this.options.getUserName();
        if (name && name !== 'Usuario') return name;
      }
      if (typeof window.currentUser !== 'undefined' && window.currentUser && window.currentUser.name) {
        return window.currentUser.name;
      }
      try {
        const sess = localStorage.getItem('turbonetwork_session');
        if (sess) {
          const parsed = JSON.parse(sess);
          if (parsed && parsed.name) return parsed.name;
        }
      } catch (_) {}
      return 'Usuario';
    },

    getUserAvatar() {
      if (typeof this.options.getUserAvatar === 'function') {
        const av = this.options.getUserAvatar();
        if (av) return av;
      }
      if (typeof window.currentUser !== 'undefined' && window.currentUser && (window.currentUser.avatarUrl || window.currentUser.avatar)) {
        return window.currentUser.avatarUrl || window.currentUser.avatar;
      }
      return '';
    },

    getTenantId() {
      if (typeof this.options.getTenantId === 'function') {
        const t = this.options.getTenantId();
        if (t && t !== 'default') return t;
      }
      if (typeof window.activeTenantId !== 'undefined' && window.activeTenantId) {
        return window.activeTenantId;
      }
      const ls = localStorage.getItem('turbonetwork_active_tenant');
      if (ls) return ls;
      return 'turbonetwork';
    },

    // Estado de la llamada
    state: {
      activeCallId: null,
      callType: 'audio', // 'audio' | 'video'
      targetUserId: null,
      targetName: '',
      targetAvatar: '',
      isCaller: false,
      callStatus: 'idle', // 'idle' | 'calling' | 'incoming' | 'connected' | 'ended'
      isMuted: false,
      isVideoDisabled: false,
      isMinimized: false,
      callSeconds: 0,
      callTimer: null,
      facingMode: 'user',
    },

    // WebRTC & Streams
    peerConnection: null,
    localStream: null,
    remoteStream: null,
    ringtoneOscillators: [],
    ringtoneInterval: null,
    _titleBlinkTimer: null,
    _originalTitle: null,
    _activeDesktopNotif: null,

    init(opts = {}) {
      this.options = Object.assign(this.options, opts);
      this.injectUI();
      this.bindGlobalEvents();
      console.log('⚡ [TurboCalls] Módulo de llamadas WebRTC inicializado (Usuario ID: ' + this.getUserId() + ')');
    },

    // ==========================================
    // NOTIFICACIONES Y ALERTA VISUAL / AUDITIVA
    // ==========================================
    startTitleBlink(text) {
      this.stopTitleBlink();
      this._originalTitle = document.title;
      let toggle = false;
      this._titleBlinkTimer = setInterval(() => {
        document.title = toggle ? text : '🔔 ' + (this._originalTitle || 'TurboNetwork');
        toggle = !toggle;
      }, 900);
    },

    stopTitleBlink() {
      if (this._titleBlinkTimer) {
        clearInterval(this._titleBlinkTimer);
        this._titleBlinkTimer = null;
      }
      if (this._originalTitle) {
        document.title = this._originalTitle;
        this._originalTitle = null;
      }
    },

    closeDesktopNotification() {
      if (this._activeDesktopNotif) {
        try { this._activeDesktopNotif.close(); } catch (_) {}
        this._activeDesktopNotif = null;
      }
    },

    triggerIncomingNotification(name, type, avatar) {
      const typeLabel = type === 'video' ? 'videollamada' : 'llamada de voz';
      this.startTitleBlink(`📞 LLAMADA DE ${name.toUpperCase()}...`);

      try {
        if ('vibrate' in navigator) {
          navigator.vibrate([400, 200, 400, 200, 600]);
        }
      } catch (_) {}

      try {
        if ('Notification' in window) {
          if (Notification.permission === 'granted') {
            const notif = new Notification(`Llamada entrante • TurboNetwork`, {
              body: `${name} te está realizando una ${typeLabel}. Haz clic aquí para responder.`,
              icon: avatar || '/icons/icon-192.png',
              tag: 'turbonetwork-incoming-call',
              requireInteraction: true
            });
            notif.onclick = () => {
              window.focus();
              notif.close();
            };
            this._activeDesktopNotif = notif;
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission();
          }
        }
      } catch (_) {}
    },

    // ==========================================
    // SINTETIZADOR DE TONOS (Web Audio API)
    // ==========================================
    getAudioContext() {
      try {
        if (!this._audioCtx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) this._audioCtx = new AudioCtx();
        }
        if (this._audioCtx && this._audioCtx.state === 'suspended') {
          this._audioCtx.resume().catch(() => {});
        }
        return this._audioCtx;
      } catch (_) {
        return null;
      }
    },

    playRingtone() {
      this.stopRingtone();
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const playPulse = () => {
        try {
          if (ctx.state === 'suspended') ctx.resume();
          const now = ctx.currentTime;
          // Melodía armónica suave para timbre entrante
          [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.12);
            gain.gain.setValueAtTime(0.18, now + idx * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + idx * 0.12);
            osc.stop(now + idx * 0.12 + 0.35);
          });
        } catch (_) {}
      };

      playPulse();
      this.ringtoneInterval = setInterval(playPulse, 2400);
    },

    playRingbackTone() {
      this.stopRingtone();
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const playBeep = () => {
        try {
          if (ctx.state === 'suspended') ctx.resume();
          const now = ctx.currentTime;
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          osc1.type = 'sine';
          osc2.type = 'sine';
          osc1.frequency.setValueAtTime(440, now);
          osc2.frequency.setValueAtTime(480, now);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);
          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 1.2);
          osc2.stop(now + 1.2);
        } catch (_) {}
      };

      playBeep();
      this.ringtoneInterval = setInterval(playBeep, 3500);
    },

    stopRingtone() {
      if (this.ringtoneInterval) {
        clearInterval(this.ringtoneInterval);
        this.ringtoneInterval = null;
      }
    },

    // ==========================================
    // LLAMADAS DIRECTAS DE PERSONAL (P2P WebRTC)
    // ==========================================
    async acquireLocalMedia(hasVideo = false) {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        console.warn('⚠️ [TurboCalls] navigator.mediaDevices no está disponible en este origen (requiere HTTPS o localhost en móviles/PWA)');
        const warnEl = document.getElementById('tc-media-warning');
        if (warnEl) {
          warnEl.textContent = 'Aviso: En dispositivos móviles el audio y video requieren conexión segura HTTPS.';
          warnEl.classList.remove('hidden');
        }
        return null;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: hasVideo ? { facingMode: this.state.facingMode, width: { ideal: 1280 }, height: { ideal: 720 } } : false
        });
        this.localStream = stream;

        // Si hay vista local PIP de video, activarla
        const localVid = document.getElementById('tc-local-video');
        if (localVid && hasVideo) {
          localVid.srcObject = stream;
        }

        // Si ya hay una peerConnection creada, registrar las pistas
        if (this.peerConnection) {
          const senders = this.peerConnection.getSenders();
          stream.getTracks().forEach(track => {
            const exists = senders.some(s => s.track && s.track.kind === track.kind);
            if (!exists) {
              this.peerConnection.addTrack(track, stream);
            }
          });
        }

        const warnEl = document.getElementById('tc-media-warning');
        if (warnEl) warnEl.classList.add('hidden');
        return stream;
      } catch (err) {
        console.warn('⚠️ [TurboCalls] Permiso de micrófono o cámara denegado o no disponible:', err);
        const warnEl = document.getElementById('tc-media-warning');
        if (warnEl) {
          warnEl.textContent = hasVideo 
            ? 'Cámara o micrófono no accesibles. Verifica los permisos del navegador.' 
            : 'Micrófono no accesible. Verifica los permisos del navegador.';
          warnEl.classList.remove('hidden');
        }
        return null;
      }
    },

    async switchCameraFacing() {
      if (this.state.callType !== 'video') return;
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') return;

      this.state.facingMode = this.state.facingMode === 'user' ? 'environment' : 'user';

      try {
        if (this.localStream) {
          const oldVideoTrack = this.localStream.getVideoTracks()[0];
          if (oldVideoTrack) {
            oldVideoTrack.stop();
            this.localStream.removeTrack(oldVideoTrack);
          }
        }

        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: this.state.facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        const newVideoTrack = newStream.getVideoTracks()[0];

        if (this.localStream) {
          this.localStream.addTrack(newVideoTrack);
        } else {
          this.localStream = newStream;
        }

        const localVid = document.getElementById('tc-local-video');
        if (localVid) {
          localVid.srcObject = this.localStream;
          localVid.style.transform = this.state.facingMode === 'user' ? 'scaleX(-1)' : 'none';
        }

        if (this.peerConnection) {
          const sender = this.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            await sender.replaceTrack(newVideoTrack);
          }
        }
      } catch (err) {
        console.warn('⚠️ [TurboCalls] Error cambiando de cámara:', err);
      }
    },

    async startPersonalCall(type, targetUser) {
      if (!targetUser || !targetUser.id) {
        alert('Selecciona un usuario válido para llamar.');
        return;
      }

      const myId = this.getUserId();
      if (myId && String(myId) === String(targetUser.id)) {
        alert('No es posible realizar una llamada contigo mismo.');
        return;
      }

      this.state.activeCallId = 'call_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      this.state.callType = type || 'audio';
      this.state.targetUserId = String(targetUser.id);
      this.state.targetName = targetUser.name || 'Personal';
      this.state.targetAvatar = targetUser.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(targetUser.name || 'Personal');
      this.state.isCaller = true;
      this.state.callStatus = 'calling';
      this.state.isMuted = false;
      this.state.isVideoDisabled = false;
      this.state.isMinimized = false;

      // 1. Mostrar interfaz de llamada activa de INMEDIATO (0ms) en móvil y escritorio
      this.showActiveCallUI();
      this.playRingbackTone();

      // 2. Enviar solicitud de llamada al destinatario mediante la API
      this.sendCallSignal('call_request', {
        callType: this.state.callType,
        callerId: myId,
        callerName: this.getUserName(),
        callerAvatar: this.getUserAvatar(),
      });

      // 3. Adquirir medios locales de forma no bloqueante y segura
      await this.acquireLocalMedia(type === 'video');
    },

    async handleCallSignal(event) {
      const myId = String(this.getUserId() || '');
      if (!event || !event.action) return;

      const action = event.action;
      const callId = event.callId;

      switch (action) {
        case 'call_request':
          // Alguien nos está llamando
          if (myId && String(event.callerId) === myId) {
            console.log('⚡ [TurboCalls] Ignorando señal propia de llamada');
            return;
          }
          if (this.state.callStatus !== 'idle') {
            // Ya estamos en llamada, rechazar ocupado
            this.sendCallSignal('call_rejected', {
              callId,
              targetUserId: event.callerId,
              reason: 'busy'
            });
            return;
          }

          this.state.activeCallId = callId;
          this.state.callType = event.callType || 'audio';
          this.state.targetUserId = String(event.callerId);
          this.state.targetName = event.callerName || 'Compañero';
          this.state.targetAvatar = event.callerAvatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(event.callerName || 'user');
          this.state.isCaller = false;
          this.state.callStatus = 'incoming';

          this.showIncomingCallUI();
          this.playRingtone();
          this.triggerIncomingNotification(this.state.targetName, this.state.callType, this.state.targetAvatar);
          break;

        case 'call_accepted':
          this.stopTitleBlink();
          this.closeDesktopNotification();
          if (this.state.activeCallId === callId && this.state.isCaller) {
            this.stopRingtone();
            this.state.callStatus = 'connected';
            this.updateActiveCallHeader('Conectado');
            this.startCallTimer();
            // Iniciar PeerConnection y crear Oferta SDP
            await this.initiatePeerConnection();
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            await this.sendCallSignal('webrtc_offer', { sdp: offer });
          }
          break;

        case 'webrtc_offer':
          if (this.state.activeCallId === callId && !this.state.isCaller) {
            this.state.callStatus = 'connected';
            this.updateActiveCallHeader('Conectado');
            this.startCallTimer();
            await this.initiatePeerConnection();
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(event.sdp));
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            await this.sendCallSignal('webrtc_answer', { sdp: answer });
          }
          break;

        case 'webrtc_answer':
          if (this.state.activeCallId === callId && this.peerConnection) {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(event.sdp));
          }
          break;

        case 'webrtc_candidate':
          if (this.state.activeCallId === callId && this.peerConnection && event.candidate) {
            try {
              await this.peerConnection.addIceCandidate(new RTCIceCandidate(event.candidate));
            } catch (e) {
              console.warn('[TurboCalls] Error agregando ICE Candidate:', e);
            }
          }
          break;

        case 'call_rejected':
          this.stopTitleBlink();
          this.closeDesktopNotification();
          if (this.state.activeCallId === callId) {
            this.stopRingtone();
            const reason = event.reason === 'busy' ? 'Usuario ocupado en otra llamada' : 'Llamada rechazada';
            this.updateActiveCallHeader(reason);
            setTimeout(() => this.cleanupCall(), 1500);
          }
          break;

        case 'call_ended':
          this.stopTitleBlink();
          this.closeDesktopNotification();
          if (this.state.activeCallId === callId) {
            this.cleanupCall();
          }
          break;
      }
    },

    async acceptIncomingCall() {
      this.stopRingtone();
      this.stopTitleBlink();
      this.closeDesktopNotification();
      this.hideIncomingCallUI();

      this.state.isCaller = false;
      this.state.callStatus = 'connecting';
      this.state.isMinimized = false;

      // 1. Mostrar interfaz de llamada activa de INMEDIATO
      this.showActiveCallUI();
      this.updateActiveCallHeader('Conectando...');

      // 2. Enviar señal de aceptación inmediatamente
      await this.sendCallSignal('call_accepted', {});

      // 3. Adquirir medios locales de forma segura
      await this.acquireLocalMedia(this.state.callType === 'video');
    },

    rejectIncomingCall() {
      this.stopRingtone();
      this.stopTitleBlink();
      this.closeDesktopNotification();
      this.hideIncomingCallUI();
      this.sendCallSignal('call_rejected', { reason: 'declined' });
      this.cleanupCall();
    },

    async endCall() {
      if (this.state.activeCallId) {
        await this.sendCallSignal('call_ended', {});
      }
      this.cleanupCall();
    },

    cleanupCall() {
      this.stopRingtone();
      this.stopTitleBlink();
      this.closeDesktopNotification();
      if (this.state.callTimer) {
        clearInterval(this.state.callTimer);
        this.state.callTimer = null;
      }
      if (this.localStream) {
        this.localStream.getTracks().forEach(t => t.stop());
        this.localStream = null;
      }
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }
      this.state.activeCallId = null;
      this.state.callStatus = 'idle';
      this.state.targetUserId = null;
      this.state.isCaller = false;
      this.state.callSeconds = 0;
      this.hideActiveCallUI();
      this.hideIncomingCallUI();
    },

    async initiatePeerConnection() {
      if (this.peerConnection) return;
      this.peerConnection = new RTCPeerConnection(RTC_CONFIG);

      // Agregar pistas locales
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          this.peerConnection.addTrack(track, this.localStream);
        });
      }

      // Enviar candidatos ICE
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendCallSignal('webrtc_candidate', { candidate: event.candidate });
        }
      };

      // Recibir pistas remotas
      this.peerConnection.ontrack = (event) => {
        const stream = event.streams[0];
        this.remoteStream = stream;
        const remoteVideo = document.getElementById('tc-remote-video');
        const remoteAudio = document.getElementById('tc-remote-audio');
        if (this.state.callType === 'video' && remoteVideo) {
          remoteVideo.srcObject = stream;
          remoteVideo.classList.remove('hidden');
          const avatarPh = document.getElementById('tc-avatar-placeholder');
          if (avatarPh) avatarPh.classList.add('hidden');
        } else if (remoteAudio) {
          remoteAudio.srcObject = stream;
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        const cs = this.peerConnection?.connectionState;
        if (cs === 'connected') {
          this.updateActiveCallHeader('En llamada');
        } else if (cs === 'disconnected' || cs === 'failed') {
          this.updateActiveCallHeader('Reconectando...');
        } else if (cs === 'closed') {
          this.cleanupCall();
        }
      };
    },

    async sendCallSignal(action, extraData = {}) {
      try {
        const myId = this.getUserId();
        const payload = Object.assign({
          action,
          callId: this.state.activeCallId,
          callType: this.state.callType,
          targetUserId: this.state.targetUserId,
          callerId: myId
        }, extraData);

        await fetch('/api/messages/calls/signal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': String(myId),
            'x-tenant-id': String(this.getTenantId())
          },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        console.error('[TurboCalls] Error emitiendo señal:', err);
      }
    },

    // ==========================================
    // SALA DE SOPORTE TÉCNICO EN VIVO (CLIENTES)
    // ==========================================
    openCustomerSupportModal(customerInfo = {}, convId = '') {
      const modal = document.getElementById('tc-support-room-modal');
      if (!modal) return;

      const custName = customerInfo.name || customerInfo.fullName || 'Cliente';
      const custPhone = customerInfo.phone || '';

      document.getElementById('tc-sup-cust-name').textContent = custName;
      document.getElementById('tc-sup-cust-phone').textContent = custPhone || 'Sin teléfono registrado';
      document.getElementById('tc-sup-conv-id').value = convId || '';
      document.getElementById('tc-sup-input-name').value = custName;
      document.getElementById('tc-sup-input-phone').value = custPhone;

      const waCheckbox = document.getElementById('tc-sup-send-wa');
      if (waCheckbox) {
        waCheckbox.checked = Boolean(custPhone);
        waCheckbox.disabled = !custPhone;
      }

      document.getElementById('tc-sup-link-box').classList.add('hidden');
      document.getElementById('tc-sup-create-btn').classList.remove('hidden');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    },

    closeCustomerSupportModal() {
      const modal = document.getElementById('tc-support-room-modal');
      if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      }
    },

    async createSupportRoom() {
      const convId = document.getElementById('tc-sup-conv-id').value;
      const custName = document.getElementById('tc-sup-input-name').value;
      const custPhone = document.getElementById('tc-sup-input-phone').value;
      const sendWa = document.getElementById('tc-sup-send-wa')?.checked || false;

      const myId = this.options.getUserId();
      const myName = this.options.getUserName();

      const btn = document.getElementById('tc-sup-create-btn');
      if (btn) btn.innerHTML = '<span>Generando sala...</span>';

      try {
        const res = await fetch('/api/messages/calls/support-room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: convId,
            customerName: custName,
            customerPhone: custPhone,
            agentId: myId,
            agentName: myName,
            sendWhatsApp: sendWa
          })
        });

        const data = await res.json();
        if (data.success && data.url) {
          document.getElementById('tc-sup-link-input').value = data.url;
          document.getElementById('tc-sup-link-box').classList.remove('hidden');
          if (btn) btn.classList.add('hidden');

          // Botón para entrar el agente como técnico
          const joinBtn = document.getElementById('tc-sup-join-agent-btn');
          if (joinBtn) {
            joinBtn.onclick = () => {
              window.open(`${data.url}?role=agent`, '_blank', 'width=1000,height=700');
              this.closeCustomerSupportModal();
            };
          }
        } else {
          alert('Error creando sala: ' + (data.message || 'desconocido'));
          if (btn) btn.innerHTML = '<span>Crear Sala de Soporte</span>';
        }
      } catch (err) {
        console.error('[TurboCalls] Error solicitando sala:', err);
        alert('Error de conexión al generar la sala.');
        if (btn) btn.innerHTML = '<span>Crear Sala de Soporte</span>';
      }
    },

    copySupportLink() {
      const input = document.getElementById('tc-sup-link-input');
      if (input) {
        input.select();
        navigator.clipboard.writeText(input.value).then(() => {
          const btn = document.getElementById('tc-sup-copy-btn');
          if (btn) {
            const old = btn.textContent;
            btn.textContent = '¡Copiado!';
            setTimeout(() => btn.textContent = old, 1800);
          }
        });
      }
    },

    callCustomerViaWhatsApp(phone) {
      if (!phone) {
        alert('Este contacto no tiene número de teléfono registrado.');
        return;
      }
      let clean = phone.replace(/[^\d]/g, '');
      if (clean.length === 9 && clean.startsWith('9')) clean = '51' + clean;
      window.open(`https://wa.me/${clean}?text=${encodeURIComponent('Hola, nos comunicamos de Soporte Técnico TurboNetwork.')}`, '_blank');
    },

    callCustomerViaPhone(phone) {
      if (!phone) {
        alert('Este contacto no tiene número de teléfono registrado.');
        return;
      }
      window.location.href = `tel:${phone}`;
    },

    // ==========================================
    // INTERFAZ DE USUARIO Y CONTROLES RESPONSIVOS (MÓVIL, PWA Y ESCRITORIO)
    // ==========================================
    injectUI() {
      if (document.getElementById('turbocalls-wrapper')) return;

      const container = document.createElement('div');
      container.id = 'turbocalls-wrapper';
      container.innerHTML = `
        <!-- AUDIO ELEMENT REMOTO -->
        <audio id="tc-remote-audio" autoplay class="hidden"></audio>

        <!-- 1. MODAL LLAMADA ENTRANTE (CENTRAL / TOP DRAWER RESPONSIVO) -->
        <div id="tc-incoming-modal" class="hidden fixed inset-0 z-[999999] bg-black/85 backdrop-blur-xl items-center justify-center p-4 select-none">
          <div class="w-full max-w-sm rounded-3xl bg-[#0b101b] border border-white/20 p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            <div class="relative mb-6 flex items-center justify-center">
              <div class="absolute -inset-4 rounded-full bg-emerald-500/25 animate-ping"></div>
              <div class="absolute -inset-2 rounded-full bg-emerald-500/35 animate-pulse"></div>
              <div class="w-24 h-24 rounded-full border-4 border-emerald-400/50 p-1 shadow-2xl bg-slate-900 relative">
                <img id="tc-inc-avatar" src="https://api.dicebear.com/7.x/bottts/svg?seed=User" class="w-full h-full rounded-full object-cover bg-slate-800" alt="Avatar">
              </div>
              <span class="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-emerald-500 border-2 border-[#0b101b] flex items-center justify-center text-white shadow-md">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/></svg>
              </span>
            </div>

            <h3 id="tc-inc-name" class="text-xl font-bold text-white mb-1.5 tracking-wide">Nombre</h3>
            <p id="tc-inc-type" class="text-xs text-emerald-400 font-semibold mb-8 flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              Llamada de voz entrante...
            </p>

            <div class="flex items-center justify-center space-x-10 w-full">
              <!-- Rechazar -->
              <div class="flex flex-col items-center space-y-2">
                <button type="button" onclick="TurboCalls.rejectIncomingCall()" class="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-90 text-white flex items-center justify-center transition shadow-xl shadow-rose-600/40 cursor-pointer">
                  <svg class="w-7 h-7 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.24 1.01l-2.2 2.2z"/></svg>
                </button>
                <span class="text-[11px] font-medium text-slate-400">Rechazar</span>
              </div>

              <!-- Aceptar -->
              <div class="flex flex-col items-center space-y-2">
                <button type="button" onclick="TurboCalls.acceptIncomingCall()" class="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-90 text-white flex items-center justify-center transition shadow-xl shadow-emerald-500/50 cursor-pointer animate-bounce">
                  <svg class="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.24 1.01l-2.2 2.2z"/></svg>
                </button>
                <span class="text-[11px] font-medium text-emerald-400 font-semibold">Contestar</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. VENTANA DE LLAMADA ACTIVA (FULLSCREEN EN MÓVIL / PWA - PIP FLOTANTE EN ESCRITORIO) -->
        <div id="tc-active-modal" class="hidden fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 w-full h-[100dvh] sm:w-96 sm:h-[520px] sm:max-h-[85vh] z-[99999] bg-[#070b14] sm:bg-[#0b101b]/95 border-0 sm:border border-white/20 sm:rounded-3xl shadow-2xl backdrop-blur-2xl flex flex-col justify-between overflow-hidden select-none transition-all">

          <!-- VISTA COMPLETA DE LLAMADA -->
          <div id="tc-active-full" class="w-full h-full flex flex-col justify-between">
            <!-- Barra Superior / Header -->
            <div class="px-4 py-3 sm:py-2.5 border-b border-white/10 flex items-center justify-between bg-white/[0.04] backdrop-blur-md z-20">
              <div class="flex items-center space-x-2">
                <button type="button" onclick="TurboCalls.toggleMinimize()" title="Minimizar llamada" class="p-2 sm:p-1.5 rounded-full sm:rounded-xl bg-white/10 text-slate-300 hover:text-white hover:bg-white/20 transition flex items-center justify-center cursor-pointer">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
                </button>
                <div class="flex items-center space-x-2 min-w-0">
                  <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span id="tc-act-status" class="text-xs sm:text-[13px] font-semibold text-slate-200 truncate">Llamando...</span>
                  <span id="tc-act-timer" class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/10 text-emerald-400">00:00</span>
                </div>
              </div>
              <div class="flex items-center space-x-1.5">
                <span id="tc-act-type-badge" class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">Voz HD</span>
              </div>
            </div>

            <!-- Cuerpo Central: Video Remoto o Avatar con Animación -->
            <div id="tc-act-body" class="relative flex-1 w-full bg-gradient-to-b from-[#0a0f1d] to-[#04070e] flex flex-col items-center justify-center overflow-hidden">
              <!-- Video Remoto (Full-bleed en videollamadas) -->
              <video id="tc-remote-video" autoplay playsinline class="hidden absolute inset-0 w-full h-full object-cover"></video>

              <!-- Placeholder Central con Avatar (Llamadas de voz o esperando conexión) -->
              <div id="tc-avatar-placeholder" class="flex flex-col items-center justify-center p-6 text-center z-10">
                <div class="relative mb-5 flex items-center justify-center">
                  <div class="absolute -inset-4 rounded-full bg-emerald-500/20 animate-ping"></div>
                  <div class="absolute -inset-2 rounded-full bg-emerald-500/30 animate-pulse"></div>
                  <div class="w-28 h-28 sm:w-24 sm:h-24 rounded-full border-4 border-emerald-400/40 p-1 shadow-2xl bg-slate-900 overflow-hidden relative">
                    <img id="tc-act-avatar" src="https://api.dicebear.com/7.x/bottts/svg?seed=User" class="w-full h-full rounded-full object-cover bg-slate-800" alt="Avatar">
                  </div>
                </div>
                <h3 id="tc-act-name" class="text-xl sm:text-lg font-bold text-white mb-1 tracking-wide">Nombre</h3>
                <p class="text-xs text-emerald-400 font-mono flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>TurboNetwork WebRTC HD</span>
                </p>
                <div id="tc-media-warning" class="hidden mt-4 max-w-xs px-3.5 py-1.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-[11px] text-amber-300 font-medium leading-tight text-center"></div>
              </div>

              <!-- Miniatura Local PIP (Solo videollamadas) -->
              <div id="tc-local-pip" class="hidden absolute top-4 right-4 w-24 h-36 sm:w-24 sm:h-32 rounded-2xl overflow-hidden border-2 border-white/40 shadow-2xl bg-slate-950 z-20">
                <video id="tc-local-video" autoplay playsinline muted class="w-full h-full object-cover" style="transform: scaleX(-1);"></video>
              </div>
            </div>

            <!-- Barra de Controles Inferior -->
            <div id="tc-act-controls" class="p-4 sm:p-3 pb-8 sm:pb-3 border-t border-white/10 flex items-center justify-center space-x-4 sm:space-x-3 bg-black/40 backdrop-blur-md z-20" style="padding-bottom: max(1.75rem, env(safe-area-inset-bottom));">
              <!-- Mute Audio -->
              <button type="button" id="tc-btn-mute" onclick="TurboCalls.toggleLocalAudio()" class="w-13 h-13 sm:w-11 sm:h-11 rounded-2xl sm:rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition border border-white/10 cursor-pointer" title="Silenciar Micrófono">
                <svg id="tc-icon-mic-on" class="w-5 h-5 sm:w-4 sm:h-4 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 1.5a3 3 0 00-3 3v4.5a3 3 0 006 0V4.5a3 3 0 00-3-3z"/></svg>
                <svg id="tc-icon-mic-off" class="w-5 h-5 sm:w-4 sm:h-4 text-rose-500 hidden" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
              </button>

              <!-- Toggle Cámara (en video call) -->
              <button type="button" id="tc-btn-cam" onclick="TurboCalls.toggleLocalVideo()" class="hidden w-13 h-13 sm:w-11 sm:h-11 rounded-2xl sm:rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white items-center justify-center transition border border-white/10 cursor-pointer" title="Apagar Cámara">
                <svg id="tc-icon-cam-on" class="w-5 h-5 sm:w-4 sm:h-4 text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"/></svg>
                <svg id="tc-icon-cam-off" class="w-5 h-5 sm:w-4 sm:h-4 text-rose-500 hidden" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 01-2.25-2.25V9m8.25-3.75h4.5A2.25 2.25 0 0117.25 7.5v3.75M3 3l18 18"/></svg>
              </button>

              <!-- Girar Cámara Frontal / Trasera (en móvil) -->
              <button type="button" id="tc-btn-flip" onclick="TurboCalls.switchCameraFacing()" class="hidden w-13 h-13 sm:w-11 sm:h-11 rounded-2xl sm:rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white items-center justify-center transition border border-white/10 cursor-pointer" title="Girar Cámara">
                <svg class="w-5 h-5 sm:w-4 sm:h-4 text-slate-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>
              </button>

              <!-- Finalizar Llamada -->
              <button type="button" onclick="TurboCalls.endCall()" class="w-16 h-13 sm:w-14 sm:h-11 rounded-2xl sm:rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white flex items-center justify-center transition shadow-xl shadow-rose-600/40 cursor-pointer" title="Finalizar llamada">
                <svg class="w-6 h-6 sm:w-5 sm:h-5 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.24 1.01l-2.2 2.2z"/></svg>
              </button>
            </div>
          </div>

          <!-- VISTA MINIMIZADA (PILL SUPERIOR EN MÓVIL / ESCRITORIO PARA CONTINUAR MENSAJEANDO) -->
          <div id="tc-active-minimized" class="hidden w-full flex items-center justify-between">
            <div onclick="TurboCalls.toggleMinimize()" class="flex items-center space-x-2.5 min-w-0 flex-1 cursor-pointer">
              <div class="relative w-8 h-8 rounded-full border border-emerald-400 overflow-hidden shrink-0">
                <img id="tc-min-avatar" src="https://api.dicebear.com/7.x/bottts/svg?seed=User" class="w-full h-full object-cover">
                <span class="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              </div>
              <div class="min-w-0">
                <div id="tc-min-name" class="text-xs font-bold text-white truncate max-w-[140px] sm:max-w-[160px]">Nombre</div>
                <div id="tc-min-timer" class="text-[11px] font-mono text-emerald-400 font-semibold">00:00 • En llamada</div>
              </div>
            </div>
            <div class="flex items-center space-x-1.5 shrink-0">
              <button type="button" onclick="TurboCalls.toggleMinimize()" class="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10" title="Expandir llamada">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"/></svg>
              </button>
              <button type="button" onclick="TurboCalls.endCall()" class="w-8 h-8 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition shadow-md" title="Colgar">
                <svg class="w-4 h-4 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.24 1.01l-2.2 2.2z"/></svg>
              </button>
            </div>
          </div>

        </div>

        <!-- 3. MODAL DE CREACIÓN DE SALA DE VIDEO-SOPORTE PARA CLIENTE -->
        <div id="tc-support-room-modal" class="hidden fixed inset-0 z-[9995] bg-black/70 backdrop-blur-xs items-center justify-center p-4 select-none">
          <div class="w-full max-w-md rounded-3xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 p-5 sm:p-6 shadow-2xl text-slate-800 dark:text-slate-100 animate-in zoom-in-95 duration-200">
            <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10 mb-4">
              <div class="flex items-center space-x-2.5">
                <div class="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"/></svg>
                </div>
                <h3 class="text-sm font-bold">Videollamada de Soporte Técnico</h3>
              </div>
              <button type="button" onclick="TurboCalls.closeCustomerSupportModal()" class="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <p class="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              Genera una sala temporal segura para que el cliente active su cámara desde el celular e inspecciones los conectores de fibra o LEDs de la ONT en vivo.
            </p>

            <div class="p-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2 mb-4 text-xs">
              <div class="flex justify-between">
                <span class="text-slate-500">Cliente:</span>
                <span id="tc-sup-cust-name" class="font-bold">Cliente</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Teléfono:</span>
                <span id="tc-sup-cust-phone" class="font-mono font-medium">987654321</span>
              </div>
            </div>

            <input type="hidden" id="tc-sup-conv-id" value="">
            <input type="hidden" id="tc-sup-input-name" value="">
            <input type="hidden" id="tc-sup-input-phone" value="">

            <div class="space-y-2 mb-5">
              <label class="flex items-center space-x-2 text-xs font-semibold cursor-pointer">
                <input type="checkbox" id="tc-sup-send-chat" checked disabled class="rounded border-slate-300 text-blue-600 focus:ring-blue-500">
                <span>Enviar enlace automáticamente a este chat</span>
              </label>
              <label class="flex items-center space-x-2 text-xs font-semibold cursor-pointer">
                <input type="checkbox" id="tc-sup-send-wa" class="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500">
                <span>Enviar también por WhatsApp directo al cliente</span>
              </label>
            </div>

            <!-- Botón Generar -->
            <button type="button" id="tc-sup-create-btn" onclick="TurboCalls.createSupportRoom()" class="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
              <span>Crear Sala de Soporte y Generar Enlace</span>
            </button>

            <!-- Caja con Enlace Generado -->
            <div id="tc-sup-link-box" class="hidden space-y-3 pt-2">
              <div class="relative">
                <input type="text" id="tc-sup-link-input" readonly class="w-full pl-3 pr-20 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-mono text-purple-600 dark:text-purple-400 focus:outline-none">
                <button type="button" id="tc-sup-copy-btn" onclick="TurboCalls.copySupportLink()" class="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-semibold transition">
                  Copiar
                </button>
              </div>

              <button type="button" id="tc-sup-join-agent-btn" class="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"/></svg>
                <span>Entrar a la Sala como Técnico</span>
              </button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(container);
    },

    showIncomingCallUI() {
      if (!document.getElementById('tc-incoming-modal')) {
        this.injectUI();
      }
      const modal = document.getElementById('tc-incoming-modal');
      if (!modal) return;
      const nameEl = document.getElementById('tc-inc-name');
      const avEl = document.getElementById('tc-inc-avatar');
      const typeEl = document.getElementById('tc-inc-type');

      if (nameEl) nameEl.textContent = this.state.targetName || 'Compañero';
      if (avEl) avEl.src = this.state.targetAvatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=User';
      if (typeEl) {
        typeEl.innerHTML = `
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
          ${this.state.callType === 'video' ? 'Videollamada entrante...' : 'Llamada de voz entrante...'}
        `;
      }
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    },

    hideIncomingCallUI() {
      const modal = document.getElementById('tc-incoming-modal');
      if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      }
    },

    showActiveCallUI() {
      if (!document.getElementById('tc-active-modal')) {
        this.injectUI();
      }
      const modal = document.getElementById('tc-active-modal');
      if (!modal) return;

      // Restablecer modo vista completa
      this.state.isMinimized = false;
      const fullView = document.getElementById('tc-active-full');
      const minView = document.getElementById('tc-active-minimized');
      if (fullView) fullView.classList.remove('hidden');
      if (minView) minView.classList.add('hidden');

      modal.className = 'fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 w-full h-[100dvh] sm:w-96 sm:h-[520px] sm:max-h-[85vh] z-[99999] bg-[#070b14] sm:bg-[#0b101b]/95 border-0 sm:border border-white/20 sm:rounded-3xl shadow-2xl backdrop-blur-2xl flex flex-col justify-between overflow-hidden select-none transition-all';

      const nameEl = document.getElementById('tc-act-name');
      const avEl = document.getElementById('tc-act-avatar');
      const statEl = document.getElementById('tc-act-status');
      const timerEl = document.getElementById('tc-act-timer');
      const badgeEl = document.getElementById('tc-act-type-badge');

      if (nameEl) nameEl.textContent = this.state.targetName || 'Personal';
      if (avEl) avEl.src = this.state.targetAvatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=User';
      if (statEl) statEl.textContent = this.state.isCaller ? 'Llamando...' : 'Conectando...';
      if (timerEl) timerEl.textContent = '00:00';

      const isVideo = this.state.callType === 'video';
      if (badgeEl) {
        badgeEl.textContent = isVideo ? 'Video HD' : 'Voz HD';
      }

      const btnCam = document.getElementById('tc-btn-cam');
      const btnFlip = document.getElementById('tc-btn-flip');
      const pip = document.getElementById('tc-local-pip');
      const remoteVideo = document.getElementById('tc-remote-video');
      const avatarPh = document.getElementById('tc-avatar-placeholder');

      if (isVideo) {
        if (btnCam) { btnCam.classList.remove('hidden'); btnCam.classList.add('flex'); }
        if (btnFlip) { btnFlip.classList.remove('hidden'); btnFlip.classList.add('flex'); }
        if (pip) {
          pip.classList.remove('hidden');
          const localVid = document.getElementById('tc-local-video');
          if (localVid && this.localStream) localVid.srcObject = this.localStream;
        }
      } else {
        if (btnCam) btnCam.classList.add('hidden');
        if (btnFlip) btnFlip.classList.add('hidden');
        if (pip) pip.classList.add('hidden');
        if (remoteVideo) remoteVideo.classList.add('hidden');
        if (avatarPh) avatarPh.classList.remove('hidden');
      }

      modal.classList.remove('hidden');
      modal.classList.add('flex');
    },

    hideActiveCallUI() {
      const modal = document.getElementById('tc-active-modal');
      if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      }
      const remoteVideo = document.getElementById('tc-remote-video');
      const localVid = document.getElementById('tc-local-video');
      if (remoteVideo) remoteVideo.srcObject = null;
      if (localVid) localVid.srcObject = null;
    },

    updateActiveCallHeader(text) {
      const el = document.getElementById('tc-act-status');
      if (el) el.textContent = text;
    },

    startCallTimer() {
      if (this.state.callTimer) return;
      this.state.callSeconds = 0;
      const timerEl = document.getElementById('tc-act-timer');
      const minTimerEl = document.getElementById('tc-min-timer');
      this.state.callTimer = setInterval(() => {
        this.state.callSeconds++;
        const mins = String(Math.floor(this.state.callSeconds / 60)).padStart(2, '0');
        const secs = String(this.state.callSeconds % 60).padStart(2, '0');
        const timeStr = `${mins}:${secs}`;
        if (timerEl) timerEl.textContent = timeStr;
        if (minTimerEl) minTimerEl.textContent = `${timeStr} • En llamada`;
      }, 1000);
    },

    toggleLocalAudio() {
      if (!this.localStream) return;
      const track = this.localStream.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        this.state.isMuted = !track.enabled;
        document.getElementById('tc-icon-mic-on').classList.toggle('hidden', this.state.isMuted);
        document.getElementById('tc-icon-mic-off').classList.toggle('hidden', !this.state.isMuted);
      }
    },

    toggleLocalVideo() {
      if (!this.localStream) return;
      const track = this.localStream.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        this.state.isVideoDisabled = !track.enabled;
        document.getElementById('tc-icon-cam-on').classList.toggle('hidden', this.state.isVideoDisabled);
        document.getElementById('tc-icon-cam-off').classList.toggle('hidden', !this.state.isVideoDisabled);
      }
    },

    toggleMinimize() {
      this.state.isMinimized = !this.state.isMinimized;
      const modal = document.getElementById('tc-active-modal');
      const fullView = document.getElementById('tc-active-full');
      const minView = document.getElementById('tc-active-minimized');
      if (!modal || !fullView || !minView) return;

      if (this.state.isMinimized) {
        fullView.classList.add('hidden');
        minView.classList.remove('hidden');

        // Actualizar datos del pill minimizado
        const minName = document.getElementById('tc-min-name');
        const minAv = document.getElementById('tc-min-avatar');
        const minTimer = document.getElementById('tc-min-timer');
        if (minName) minName.textContent = this.state.targetName || 'Personal';
        if (minAv) minAv.src = this.state.targetAvatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=User';
        const mins = String(Math.floor(this.state.callSeconds / 60)).padStart(2, '0');
        const secs = String(this.state.callSeconds % 60).padStart(2, '0');
        if (minTimer) minTimer.textContent = `${mins}:${secs} • En llamada`;

        modal.className = 'fixed top-3 left-3 right-3 sm:left-auto sm:top-auto sm:bottom-6 sm:right-6 sm:w-80 z-[99999] rounded-2xl bg-[#0b101b]/95 border border-emerald-500/50 shadow-2xl backdrop-blur-2xl p-2.5 px-3.5 flex items-center justify-between select-none transition-all';
      } else {
        minView.classList.add('hidden');
        fullView.classList.remove('hidden');
        modal.className = 'fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 w-full h-[100dvh] sm:w-96 sm:h-[520px] sm:max-h-[85vh] z-[99999] bg-[#070b14] sm:bg-[#0b101b]/95 border-0 sm:border border-white/20 sm:rounded-3xl shadow-2xl backdrop-blur-2xl flex flex-col justify-between overflow-hidden select-none transition-all';
      }
    },

    bindGlobalEvents() {
      // Manejar cierre o refresh de ventana
      window.addEventListener('beforeunload', () => {
        if (this.state.activeCallId) {
          this.endCall();
        }
      });

      // Desbloquear AudioContext en la primera interacción del usuario
      const unlockAudio = () => {
        if (this._audioCtx && this._audioCtx.state === 'suspended') {
          this._audioCtx.resume().catch(() => {});
        }
      };
      ['click', 'touchstart', 'keydown'].forEach(ev => {
        window.addEventListener(ev, unlockAudio, { once: true, passive: true });
      });
    }
  };

  window.TurboCalls = TurboCalls;

  // Auto-inyectar interfaz en cuanto el DOM esté listo
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => TurboCalls.injectUI());
    } else {
      TurboCalls.injectUI();
    }
  }
})(window);
