/**
 * UltraBlock Scriptlet: nowebrtc
 * Based on: AdGuard Scriptlets / uBlock Origin
 * Replaces RTCPeerConnection and related constructors with dummy
 * implementations that do nothing, preventing WebRTC IP leaks.
 *
 * @param {Object} [args] - No arguments needed
 */
function nowebrtc(args) {
  'use strict';

  function DummyRTCPeerConnection(config) {
    this._config = config;
    this._localDescription = null;
    this._remoteDescription = null;
    this._signalingState = 'stable';
    this._iceConnectionState = 'new';
    this._iceGatheringState = 'new';
    this._connectionState = 'new';
    this.onicecandidate = null;
    this.oniceconnectionstatechange = null;
    this.onicegatheringstatechange = null;
    this.onsignalingstatechange = null;
    this.onconnectionstatechange = null;
    this.ondatachannel = null;
    this.ontrack = null;
    this.onnegotiationneeded = null;
  }

  DummyRTCPeerConnection.prototype = {
    get localDescription() { return this._localDescription; },
    get remoteDescription() { return this._remoteDescription; },
    get signalingState() { return this._signalingState; },
    get iceConnectionState() { return this._iceConnectionState; },
    get iceGatheringState() { return this._iceGatheringState; },
    get connectionState() { return this._connectionState; },
    createOffer: function() { return Promise.resolve({ type: 'offer', sdp: '' }); },
    createAnswer: function() { return Promise.resolve({ type: 'answer', sdp: '' }); },
    setLocalDescription: function(desc) {
      this._localDescription = desc;
      return Promise.resolve();
    },
    setRemoteDescription: function(desc) {
      this._remoteDescription = desc;
      return Promise.resolve();
    },
    addIceCandidate: function() { return Promise.resolve(); },
    addTrack: function() { return { track: null, streams: [] }; },
    removeTrack: function() {},
    addStream: function() {},
    removeStream: function() {},
    createDataChannel: function(label) {
      return {
        label: label || '',
        readyState: 'closed',
        send: function() {},
        close: function() {},
        onopen: null,
        onclose: null,
        onmessage: null,
        onerror: null
      };
    },
    getStats: function() { return Promise.resolve(new Map()); },
    getSenders: function() { return []; },
    getReceivers: function() { return []; },
    getTransceivers: function() { return []; },
    getConfiguration: function() { return this._config || {}; },
    setConfiguration: function() {},
    close: function() {
      this._signalingState = 'closed';
      this._iceConnectionState = 'closed';
      this._connectionState = 'closed';
    },
    addEventListener: function() {},
    removeEventListener: function() {},
    dispatchEvent: function() { return true; },
    toString: function() { return '[object RTCPeerConnection]'; }
  };

  DummyRTCPeerConnection.generateCertificate = function() {
    return Promise.resolve({ expires: Date.now() + 2592000000, getFingerprints: function() { return []; } });
  };

  // Override all known WebRTC constructors
  try {
    Object.defineProperty(window, 'RTCPeerConnection', {
      value: DummyRTCPeerConnection,
      writable: false,
      configurable: false,
      enumerable: true
    });
  } catch (e) {
    window.RTCPeerConnection = DummyRTCPeerConnection;
  }

  try {
    Object.defineProperty(window, 'webkitRTCPeerConnection', {
      value: DummyRTCPeerConnection,
      writable: false,
      configurable: false,
      enumerable: true
    });
  } catch (e) {
    window.webkitRTCPeerConnection = DummyRTCPeerConnection;
  }

  try {
    Object.defineProperty(window, 'mozRTCPeerConnection', {
      value: DummyRTCPeerConnection,
      writable: false,
      configurable: false,
      enumerable: true
    });
  } catch (e) {}

  // Also neuter RTCSessionDescription
  function DummyRTCSessionDescription(init) {
    this.type = (init && init.type) || '';
    this.sdp = (init && init.sdp) || '';
  }
  DummyRTCSessionDescription.prototype.toJSON = function() {
    return { type: this.type, sdp: this.sdp };
  };

  try {
    Object.defineProperty(window, 'RTCSessionDescription', {
      value: DummyRTCSessionDescription,
      writable: false,
      configurable: false
    });
  } catch (e) {}

  // Neuter RTCIceCandidate
  function DummyRTCIceCandidate(init) {
    this.candidate = (init && init.candidate) || '';
    this.sdpMLineIndex = (init && init.sdpMLineIndex) || 0;
    this.sdpMid = (init && init.sdpMid) || '';
  }
  DummyRTCIceCandidate.prototype.toJSON = function() {
    return { candidate: this.candidate, sdpMLineIndex: this.sdpMLineIndex, sdpMid: this.sdpMid };
  };

  try {
    Object.defineProperty(window, 'RTCIceCandidate', {
      value: DummyRTCIceCandidate,
      writable: false,
      configurable: false
    });
  } catch (e) {}
}
