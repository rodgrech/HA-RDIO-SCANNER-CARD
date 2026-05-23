class RdioScannerCard extends HTMLElement {
  static STORAGE_KEY = "rdio-scanner-card-access-code";

  static getStubConfig() {
    return {
      type: "custom:rdio-scanner-card",
      mode: "native",
      title: "Rdio Scanner",
      url: "http://rdio.local:3000",
      ws_url: "",
      access_code: "",
      status_entity: "sensor.rdio_scanner_status",
      systems_entity: "sensor.rdio_scanner_systems",
      talkgroups_entity: "sensor.rdio_scanner_talkgroups",
      height: 640,
      show_header: true,
      live_header: false,
      auto_start: true,
      show_recordings: true,
      auto_load_recordings: false,
      recordings_limit: 20,
      audio_mode: "auto",
      allow_mixed_ws: false,
    };
  }

  setConfig(config) {
    this.config = {
      ...RdioScannerCard.getStubConfig(),
      ...config,
    };
    this._rendered = false;
    this._iframeUrl = undefined;
    this._headerInitialized = false;
    this._ws = undefined;
    this._audioContext = undefined;
    this._audioSource = undefined;
    this._htmlAudio = undefined;
    this._audioObjectUrl = undefined;
    this._htmlAudioPlaying = false;
    this._call = undefined;
    this._queue = [];
    this._configData = undefined;
    this._live = false;
    this._linked = false;
    this._connectionStatus = "Stopped";
    this._authRequired = false;
    this._manualStop = false;
    this._reconnectTimer = undefined;
    this._recordings = [];
    this._recordingsLoading = false;
    this._storageKey = `${RdioScannerCard.STORAGE_KEY}:${this.getUrl()}`;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) {
      this.render();
    } else if (this.config.mode !== "native" && (!this._headerInitialized || this.config.live_header)) {
      this.updateIframeHeader();
    }
  }

  getCardSize() {
    if (this.config?.mode === "native") return 4;
    return Math.max(4, Math.ceil((Number(this.config?.height) || 640) / 150));
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    this.stopNative({ reconnect: false });
  }

  getUrl() {
    const entityUrl = this.value(this.config.url_entity, "");
    return entityUrl || this.config.url || "http://rdio.local:3000";
  }

  getWsUrl() {
    if (this.config.ws_url) return this.config.ws_url;
    return this.getUrl().replace(/^http/i, "ws");
  }

  value(entityId, fallback = "--") {
    const state = entityId && this._hass?.states[entityId]?.state;
    return !state || state === "unknown" || state === "unavailable" ? fallback : state;
  }

  render() {
    if (!this.config) return;
    if (this.config.mode === "native") {
      this.renderNative();
    } else {
      this.renderIframe();
    }
  }

  renderNative() {
    if (this._rendered) {
      this.updateNativeUi();
      return;
    }

    this.innerHTML = `
      <ha-card>
        <style>
          ha-card{overflow:hidden;border-radius:8px;background:#101316;color:var(--primary-text-color);font-family:var(--paper-font-body1_-_font-family,Arial,Helvetica,sans-serif)}
          .native{min-height:280px;display:grid;grid-template-rows:auto 1fr auto;background:#101316}
          .top{display:${this.config.show_header === false ? "none" : "grid"};grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px;background:#1b2026;border-bottom:1px solid rgba(255,255,255,.08)}
          .title{min-width:0;display:grid;gap:4px}.name{font-size:15px;font-weight:800;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.meta{display:flex;flex-wrap:wrap;gap:8px;color:var(--secondary-text-color);font-size:12px;line-height:1.2}.dot{width:8px;height:8px;border-radius:50%;display:inline-block;background:#ff453a;box-shadow:0 0 8px rgba(255,69,58,.65)}.dot.on{background:#34c759;box-shadow:0 0 8px rgba(52,199,89,.8)}.status{display:inline-flex;align-items:center;gap:6px}
          .actions{display:inline-flex;gap:4px}.actions button,.unlock button,.controls button{height:36px;border:0;border-radius:18px;cursor:pointer;color:var(--primary-text-color);background:rgba(255,255,255,.1);padding:0 12px;font-weight:700}.actions button{width:36px;padding:0}.actions button:hover,.unlock button:hover,.controls button:hover{background:rgba(255,255,255,.16)}
          .screen{display:grid;grid-template-rows:auto 1fr auto;gap:12px;padding:14px;background:radial-gradient(circle at 78% 12%,rgba(37,99,235,.18),transparent 28%),#101316}
          .lcd{min-height:142px;display:grid;gap:10px;align-content:center;padding:18px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:#07130d;color:#b7f56f;box-shadow:inset 0 0 28px rgba(89,255,120,.08);font-family:"Courier New",Consolas,monospace}
          .channel{font-size:clamp(26px,7vw,46px);font-weight:900;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.caller{font-size:clamp(16px,4vw,26px);font-weight:800;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.detail{display:flex;flex-wrap:wrap;gap:10px;font-size:12px;color:#7fbd62}
          .unlock{display:none;grid-template-columns:minmax(0,1fr) auto auto;gap:8px}.unlock.show{display:grid}.unlock input{min-width:0;height:36px;padding:0 11px;border-radius:18px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:var(--primary-text-color)}
          .controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.controls .primary{background:#2276d2}.controls .danger{background:#7f2a2a}.queue{margin-left:auto;color:var(--secondary-text-color);font-size:12px}
          .recordings{display:${this.config.show_recordings === false ? "none" : "grid"};gap:8px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:rgba(0,0,0,.18);padding:10px}
          .recordings-head{display:flex;align-items:center;gap:8px}.recordings-title{font-size:13px;font-weight:800}.recordings-head button{margin-left:auto;height:32px;border:0;border-radius:16px;cursor:pointer;color:var(--primary-text-color);background:rgba(255,255,255,.1);padding:0 11px;font-weight:700}
          .recordings-list{display:grid;gap:6px;max-height:220px;overflow:auto}.recording{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:6px;align-items:center;padding:7px 8px;border-radius:6px;background:rgba(255,255,255,.06)}.recording-main{min-width:0;display:grid;gap:2px}.recording-title{font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.recording-sub{font-size:11px;color:var(--secondary-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.recording button{width:32px;height:32px;border:0;border-radius:50%;cursor:pointer;color:var(--primary-text-color);background:rgba(255,255,255,.1);padding:0}
          .foot{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid rgba(255,255,255,.08);background:#181d22}.metric{padding:10px 12px;border-right:1px solid rgba(255,255,255,.08)}.metric:last-child{border-right:0}.label{color:var(--secondary-text-color);font-size:11px;text-transform:uppercase}.value{margin-top:3px;font-size:14px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          audio.rdio-audio{display:none}
          ha-icon{--mdc-icon-size:20px;width:20px;height:20px;vertical-align:middle}
        </style>
        <div class="native">
          <div class="top">
            <div class="title">
              <div class="name">${this.escape(this.config.title)}</div>
              <div class="meta">
                <span class="status"><span class="dot"></span><span class="native-status">Stopped</span></span>
                <span><span class="system-count">--</span> systems</span>
                <span><span class="talkgroup-count">--</span> talkgroups</span>
              </div>
            </div>
            <div class="actions">
              <button type="button" class="native-reconnect" title="Reconnect"><ha-icon icon="mdi:reload"></ha-icon></button>
              <button type="button" class="native-open" title="Open Rdio Scanner"><ha-icon icon="mdi:open-in-new"></ha-icon></button>
            </div>
          </div>
          <div class="screen">
            <div class="unlock">
              <input class="access-code" type="password" autocomplete="current-password" placeholder="Unlock code">
              <button type="button" class="unlock-button">Unlock</button>
              <button type="button" class="clear-code">Clear saved</button>
            </div>
            <div class="lcd">
              <div class="channel">LIVE FEED</div>
              <div class="caller">Waiting for traffic</div>
              <div class="detail"><span class="system-label">System --</span><span class="talkgroup-label">Talkgroup --</span><span class="call-time">--</span></div>
            </div>
            <div class="controls">
              <button type="button" class="native-start primary">Start Live</button>
              <button type="button" class="native-stop danger">Stop</button>
              <button type="button" class="native-skip">Skip</button>
              <span class="queue">Queue: <span class="queue-count">0</span></span>
            </div>
            <div class="recordings">
              <div class="recordings-head">
                <span class="recordings-title">Recordings</span>
                <button type="button" class="recordings-refresh">Load recent</button>
              </div>
              <div class="recordings-list">
                <div class="recording-empty">No recordings loaded</div>
              </div>
            </div>
          </div>
          <div class="foot">
            <div class="metric"><div class="label">Link</div><div class="value link-value">Offline</div></div>
            <div class="metric"><div class="label">Mode</div><div class="value mode-value">Native</div></div>
            <div class="metric"><div class="label">Audio</div><div class="value audio-value">Idle</div></div>
          </div>
          <audio class="rdio-audio" playsinline preload="auto"></audio>
        </div>
      </ha-card>
    `;

    this.querySelector(".native-start")?.addEventListener("click", () => this.startNative({ userGesture: true }));
    this.querySelector(".native-stop")?.addEventListener("click", () => this.stopNative({ reconnect: false, manual: true }));
    this.querySelector(".native-skip")?.addEventListener("click", () => this.skipCall());
    this.querySelector(".native-reconnect")?.addEventListener("click", () => this.startNative({ reconnect: true, userGesture: true }));
    this.querySelector(".native-open")?.addEventListener("click", () => window.open(this.getUrl(), "_blank", "noopener,noreferrer"));
    this.querySelector(".recordings-refresh")?.addEventListener("click", () => this.loadRecordings());
    this.querySelector(".unlock-button")?.addEventListener("click", () => this.sendAccessCode());
    this.querySelector(".clear-code")?.addEventListener("click", () => this.clearAccessCode());
    this.querySelector(".access-code")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") this.sendAccessCode();
    });
    this._htmlAudio = this.querySelector(".rdio-audio");

    this._rendered = true;
    this.updateNativeUi();
    if (this.config.auto_start) this.startNative();
  }

  renderIframe() {
    const url = this.getUrl();
    const height = Math.max(320, Number(this.config.height) || 640);

    if (this._rendered && this._iframeUrl === url) {
      this.updateIframeHeader();
      return;
    }

    this.innerHTML = `
      <ha-card>
        <style>
          ha-card{overflow:hidden;border-radius:8px;background:#121417;color:var(--primary-text-color)}
          .rdio-header{display:${this.config.show_header === false ? "none" : "grid"};grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 12px;background:#1b2026;border-bottom:1px solid rgba(255,255,255,.08)}
          .rdio-title{min-width:0;display:grid;gap:4px}.rdio-name{min-width:0;font-size:15px;font-weight:700;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rdio-meta{display:flex;flex-wrap:wrap;gap:8px;color:var(--secondary-text-color);font-size:12px;line-height:1.2}
          .rdio-dot{width:8px;height:8px;border-radius:50%;display:inline-block;background:#ff453a;box-shadow:0 0 8px rgba(255,69,58,.65)}.rdio-dot.connected{background:#34c759;box-shadow:0 0 8px rgba(52,199,89,.8)}
          .rdio-status{display:inline-flex;align-items:center;gap:6px}.rdio-actions{display:inline-flex;gap:4px;align-items:center}.rdio-actions button{width:36px;height:36px;padding:0;border:0;border-radius:50%;cursor:pointer;color:var(--primary-text-color);background:rgba(255,255,255,.08)}.rdio-actions button:hover{background:rgba(255,255,255,.14)}
          ha-icon{--mdc-icon-size:20px;width:20px;height:20px;vertical-align:middle}
          iframe{width:100%;height:${height}px;display:block;border:0;background:#0b0d0f}
        </style>
        <div class="rdio-header">
          <div class="rdio-title">
            <div class="rdio-name">${this.escape(this.config.title)}</div>
            <div class="rdio-meta">
              <span class="rdio-status"><span class="rdio-dot"></span><span class="rdio-status-text">Unknown</span></span>
              <span><span class="rdio-systems">--</span> systems</span>
              <span><span class="rdio-talkgroups">--</span> talkgroups</span>
            </div>
          </div>
          <div class="rdio-actions">
            <button type="button" class="rdio-reload" title="Reload scanner"><ha-icon icon="mdi:reload"></ha-icon></button>
            <button type="button" class="rdio-open" title="Open scanner"><ha-icon icon="mdi:open-in-new"></ha-icon></button>
          </div>
        </div>
        <iframe src="${this.escape(url)}" allow="autoplay; fullscreen" title="${this.escape(this.config.title)}"></iframe>
      </ha-card>
    `;

    this.querySelector(".rdio-reload")?.addEventListener("click", () => {
      const iframe = this.querySelector("iframe");
      iframe.src = iframe.src;
    });
    this.querySelector(".rdio-open")?.addEventListener("click", () => window.open(url, "_blank", "noopener,noreferrer"));

    this._rendered = true;
    this._iframeUrl = url;
    this.updateIframeHeader();
  }

  startNative(options = {}) {
    if (options.reconnect) this.stopNative({ reconnect: false });
    this._manualStop = false;
    if (options.userGesture) {
      this.primeAudio();
    } else {
      this.ensureAudio();
    }
    if (this._ws && this._ws.readyState <= 1) return;

    if (!this.config.allow_mixed_ws && window.location.protocol === "https:" && this.getWsUrl().startsWith("ws://")) {
      this._connectionStatus = "Blocked: use WSS";
      this.updateNativeUi();
      return;
    }

    this._connectionStatus = "Connecting";
    this.setNativeStatus(this._connectionStatus);
    try {
      this._ws = new WebSocket(this.getWsUrl());
    } catch (error) {
      this._connectionStatus = error?.message || "WebSocket failed";
      this.updateNativeUi();
      return;
    }
    this._ws.onopen = () => {
      this._linked = true;
      this._connectionStatus = "Connected";
      this.sendWs("VER");
      this.sendWs("CFG");
      this.updateNativeUi();
    };
    this._ws.onmessage = (event) => this.handleWsMessage(event.data);
    this._ws.onerror = () => {
      this._connectionStatus = "Connection error";
      this.setNativeStatus(this._connectionStatus);
      this.updateNativeUi();
    };
    this._ws.onclose = (event) => {
      this._linked = false;
      this._live = false;
      this._connectionStatus = this.closeStatus(event);
      this.updateNativeUi();
      if (!this._manualStop && this._connectionStatus !== "Blocked: use WSS") {
        window.clearTimeout(this._reconnectTimer);
        this._reconnectTimer = window.setTimeout(() => this.startNative(), 2500);
      }
    };
  }

  stopNative(options = {}) {
    this._manualStop = Boolean(options.manual);
    window.clearTimeout(this._reconnectTimer);
    this._queue = [];
    this.stopAudio();
    if (this._ws) {
      this._ws.onclose = null;
      this._ws.onerror = null;
      this._ws.onmessage = null;
      this._ws.onopen = null;
      this._ws.close();
      this._ws = undefined;
    }
    this._linked = false;
    this._live = false;
    this._connectionStatus = "Stopped";
    this.updateNativeUi();
    if (options.reconnect) this.startNative();
  }

  handleWsMessage(raw) {
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (!Array.isArray(message)) return;

    const [command, payload, flag] = message;
    if (command === "PIN") {
      this._authRequired = true;
      this._connectionStatus = "Unlock required";
      this.updateNativeUi();
      const savedCode = this.getAccessCode();
      if (savedCode) this.sendAccessCode(savedCode, { save: false });
    } else if (command === "CFG") {
      this._authRequired = false;
      this._connectionStatus = "Connected";
      this._configData = payload;
      this.subscribeAllTalkgroups();
      if (this.config.auto_load_recordings) this.loadRecordings();
      this.updateNativeUi();
    } else if (command === "LFM") {
      this._live = Boolean(payload);
      if (this._live) this._connectionStatus = "Live feed on";
      this.updateNativeUi();
    } else if (command === "CAL" && payload) {
      const call = this.decorateCall(payload);
      if (flag === "d") {
        this.downloadCall(call);
      } else {
        this.queueCall(call, { priority: flag === "p" });
      }
    } else if (command === "LCL" && payload) {
      this._recordingsLoading = false;
      this._recordings = Array.isArray(payload.results) ? payload.results.map((call) => this.decorateCall(call)) : [];
      this.updateRecordingsUi();
    } else if (command === "XPR") {
      this._authRequired = true;
      this._connectionStatus = "Access expired";
      this.setNativeStatus(this._connectionStatus);
    } else if (command === "MAX") {
      this._connectionStatus = "Too many listeners";
      this.setNativeStatus(this._connectionStatus);
    }
  }

  sendAccessCode(code = undefined, options = {}) {
    const value = code ?? this.querySelector(".access-code")?.value ?? "";
    if (!value) return;
    this.sendWs("PIN", window.btoa(value));
    if (options.save !== false) this.saveAccessCode(value);
    const input = this.querySelector(".access-code");
    if (input) input.value = "";
  }

  getAccessCode() {
    if (this.config.access_code) return this.config.access_code;

    try {
      return window.localStorage.getItem(this._storageKey) || "";
    } catch {
      return "";
    }
  }

  saveAccessCode(code) {
    if (this.config.access_code) return;

    try {
      window.localStorage.setItem(this._storageKey, code);
    } catch {
      this.setNativeStatus("Unable to save unlock code");
    }
  }

  clearAccessCode() {
    try {
      window.localStorage.removeItem(this._storageKey);
      const input = this.querySelector(".access-code");
      if (input) input.value = "";
      this.setNativeStatus("Saved code cleared");
    } catch {
      this.setNativeStatus("Unable to clear code");
    }
  }

  subscribeAllTalkgroups() {
    const systems = Array.isArray(this._configData?.systems) ? this._configData.systems : [];
    const map = {};
    systems.forEach((system) => {
      if (!system || !Array.isArray(system.talkgroups)) return;
      map[system.id] = {};
      system.talkgroups.forEach((talkgroup) => {
        map[system.id][talkgroup.id] = true;
      });
    });
    this.sendWs("LFM", map);
  }

  sendWs(command, payload = undefined, flag = undefined) {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
    const message = [command];
    if (payload !== undefined && payload !== null && payload !== "") message.push(payload);
    if (flag !== undefined && flag !== null && flag !== "") message.push(flag);
    this._ws.send(JSON.stringify(message));
  }

  loadRecordings() {
    this._recordingsLoading = true;
    this.updateRecordingsUi();
    this.sendWs("LCL", {
      limit: Math.max(1, Math.min(500, Number(this.config.recordings_limit) || 20)),
      offset: 0,
      sort: -1,
    });
  }

  playRecording(id) {
    this.primeAudio();
    this.sendWs("CAL", `${id}`, "p");
  }

  requestDownload(id) {
    this.sendWs("CAL", `${id}`, "d");
  }

  decorateCall(call) {
    const systems = Array.isArray(this._configData?.systems) ? this._configData.systems : [];
    call.systemData = systems.find((system) => system.id === call.system);
    call.talkgroupData = call.systemData?.talkgroups?.find((talkgroup) => talkgroup.id === call.talkgroup);
    if (call.talkgroupData?.frequency) call.frequency = call.talkgroupData.frequency;
    return call;
  }

  queueCall(call, options = {}) {
    if (!call?.audio?.data) return;
    if (options.priority) {
      this._queue.unshift(call);
    } else {
      this._queue.push(call);
    }
    this.updateNativeUi();
    if (!this._call && !this.isAudioPlaying()) this.playNext();
  }

  async downloadCall(call) {
    if (!call?.audio?.data) return;

    const bytes = new Uint8Array(call.audio.data);
    const blob = new Blob([bytes], { type: call.audioType || "audio/*" });
    const filename = call.audioName || `rdio-call-${call.id || Date.now()}.wav`;
    if (await this.shareFile(blob, filename)) return;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), opened ? 30000 : 5000);
  }

  async playNext() {
    if (this.isAudioPlaying() || this._call) return;
    const call = this._queue.shift();
    if (!call) {
      this.updateNativeUi();
      return;
    }
    this._call = call;
    this.updateNativeUi();

    const played = await this.playCallAudio(call);
    if (!played) {
      this._audioSource = undefined;
      this._call = undefined;
      this._htmlAudioPlaying = false;
      this.updateNativeUi();
      window.setTimeout(() => this.playNext(), 250);
    }
  }

  async playCallAudio(call) {
    if (this.shouldUseHtmlAudio()) {
      const htmlPlayed = await this.playWithHtmlAudio(call);
      if (htmlPlayed) return true;
    }

    const webAudioPlayed = await this.playWithWebAudio(call);
    if (webAudioPlayed) return true;

    if (!this.shouldUseHtmlAudio()) {
      return this.playWithHtmlAudio(call);
    }

    return false;
  }

  async playWithWebAudio(call) {
    const audioContext = this.ensureAudio();
    if (!audioContext) return false;

    try {
      if (audioContext.state === "suspended") await audioContext.resume();
      const bytes = new Uint8Array(call.audio.data);
      const buffer = await audioContext.decodeAudioData(bytes.buffer.slice(0));
      this._audioSource = audioContext.createBufferSource();
      this._audioSource.buffer = buffer;
      this._audioSource.connect(audioContext.destination);
      this._audioSource.onended = () => {
        this._audioSource = undefined;
        this._call = undefined;
        this.updateNativeUi();
        window.setTimeout(() => this.playNext(), 250);
      };
      this._audioSource.start();
      return true;
    } catch {
      this.setNativeStatus("WebAudio failed");
      return false;
    }
  }

  async playWithHtmlAudio(call) {
    const audio = this.ensureHtmlAudio();
    if (!audio) return false;

    try {
      this.revokeAudioObjectUrl();
      const bytes = new Uint8Array(call.audio.data);
      const blob = new Blob([bytes], { type: call.audioType || "audio/wav" });
      this._audioObjectUrl = URL.createObjectURL(blob);
      audio.onended = () => {
        this._htmlAudioPlaying = false;
        this._call = undefined;
        this.revokeAudioObjectUrl();
        this.updateNativeUi();
        window.setTimeout(() => this.playNext(), 250);
      };
      audio.onerror = () => {
        this._htmlAudioPlaying = false;
        this.setNativeStatus("HTML audio failed");
        this.updateNativeUi();
      };
      audio.src = this._audioObjectUrl;
      audio.volume = 1;
      audio.muted = false;
      this._htmlAudioPlaying = true;
      await audio.play();
      return true;
    } catch {
      this._htmlAudioPlaying = false;
      this.setNativeStatus("Tap Start for audio");
      this.updateNativeUi();
      return false;
    }
  }

  ensureAudio(userGesture = false) {
    if (!this._audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return undefined;
      this._audioContext = new AudioContextClass();
    }
    if (userGesture) this._audioContext.resume();
    return this._audioContext;
  }

  async primeAudio() {
    const audioContext = this.ensureAudio(true);
    const htmlAudio = this.ensureHtmlAudio();

    try {
      if (audioContext) {
        if (audioContext.state === "suspended") await audioContext.resume();
        const buffer = audioContext.createBuffer(1, 1, audioContext.sampleRate);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start();
      }
      if (htmlAudio) {
        htmlAudio.muted = true;
        htmlAudio.volume = 0;
        htmlAudio.src = this.silentWavDataUri();
        await htmlAudio.play();
        htmlAudio.pause();
        htmlAudio.currentTime = 0;
        htmlAudio.muted = false;
        htmlAudio.volume = 1;
      }
    } catch {
      this.setNativeStatus("Tap Start for audio");
    }
  }

  stopAudio() {
    if (this._audioSource) {
      this._audioSource.onended = null;
      this._audioSource.stop();
      this._audioSource.disconnect();
      this._audioSource = undefined;
    }
    if (this._htmlAudio) {
      this._htmlAudio.pause();
      this._htmlAudio.removeAttribute("src");
      this._htmlAudio.load();
      this._htmlAudioPlaying = false;
      this.revokeAudioObjectUrl();
    }
    this._call = undefined;
  }

  skipCall() {
    this.stopAudio();
    this.updateNativeUi();
    this.playNext();
  }

  setNativeStatus(status) {
    const statusText = this.querySelector(".native-status");
    if (statusText) statusText.textContent = status;
  }

  updateNativeUi() {
    if (!this._rendered) return;

    const systems = Array.isArray(this._configData?.systems) ? this._configData.systems : undefined;
    const talkgroupCount = systems?.reduce((count, system) => count + (Array.isArray(system.talkgroups) ? system.talkgroups.length : 0), 0);
    const status = this._authRequired ? "Unlock required" : this._live ? "Live feed on" : this._linked ? "Connected" : this._connectionStatus;
    const call = this._call;
    const talkgroup = call?.talkgroupData;
    const system = call?.systemData;

    this.querySelector(".dot")?.classList.toggle("on", this._linked && !this._authRequired);
    this.setNativeStatus(status);
    this.setText(".system-count", systems ? systems.length : this.value(this.config.systems_entity, "--"));
    this.setText(".talkgroup-count", talkgroupCount ?? this.value(this.config.talkgroups_entity, "--"));
    this.setText(".channel", talkgroup?.label || talkgroup?.name || (call?.talkgroup ? `TG ${call.talkgroup}` : "LIVE FEED"));
    this.setText(".caller", this.formatCaller(call));
    this.setText(".system-label", system?.label || (call?.system ? `System ${call.system}` : "System --"));
    this.setText(".talkgroup-label", talkgroup?.name || (call?.talkgroup ? `Talkgroup ${call.talkgroup}` : "Talkgroup --"));
    this.setText(".call-time", call?.dateTime ? new Date(call.dateTime).toLocaleTimeString() : "--");
    this.setText(".queue-count", this._queue.length);
    this.setText(".link-value", this._linked ? "Online" : "Offline");
    this.setText(".audio-value", this.isAudioPlaying() ? "Playing" : this._queue.length ? "Queued" : "Idle");
    this.querySelector(".unlock")?.classList.toggle("show", this._authRequired && !this.config.access_code);
  }

  updateRecordingsUi() {
    const list = this.querySelector(".recordings-list");
    if (!list) return;

    if (this._recordingsLoading) {
      list.innerHTML = `<div class="recording-empty">Loading recordings...</div>`;
      return;
    }

    if (!this._recordings.length) {
      list.innerHTML = `<div class="recording-empty">No recordings loaded</div>`;
      return;
    }

    list.innerHTML = this._recordings.map((call) => `
      <div class="recording">
        <div class="recording-main">
          <div class="recording-title">${this.escape(this.recordingTitle(call))}</div>
          <div class="recording-sub">${this.escape(this.recordingSubtitle(call))}</div>
        </div>
        <button type="button" class="recording-play" data-id="${this.escape(call.id)}" title="Play"><ha-icon icon="mdi:play"></ha-icon></button>
        <button type="button" class="recording-download" data-id="${this.escape(call.id)}" title="Download"><ha-icon icon="mdi:download"></ha-icon></button>
      </div>
    `).join("");

    list.querySelectorAll(".recording-play").forEach((button) => {
      button.addEventListener("click", () => this.playRecording(button.dataset.id));
    });
    list.querySelectorAll(".recording-download").forEach((button) => {
      button.addEventListener("click", () => this.requestDownload(button.dataset.id));
    });
  }

  updateIframeHeader() {
    if (!this._rendered || !this._hass) return;

    const status = this.value(this.config.status_entity, "Unknown");
    const connected = status.toLowerCase() === "connected";
    const systems = this.value(this.config.systems_entity, "--");
    const talkgroups = this.value(this.config.talkgroups_entity, "--");

    this.querySelector(".rdio-dot")?.classList.toggle("connected", connected);
    this.setText(".rdio-status-text", status);
    this.setText(".rdio-systems", systems);
    this.setText(".rdio-talkgroups", talkgroups);
    this._headerInitialized = true;
  }

  formatCaller(call) {
    if (!call) return "Waiting for traffic";
    if (Array.isArray(call.sources) && call.sources.length > 0) {
      return call.sources.map((source) => source.src).filter(Boolean).join(", ") || "Unknown unit";
    }
    return call.source ? `Unit ${call.source}` : "Unknown unit";
  }

  recordingTitle(call) {
    return call?.talkgroupData?.label || call?.talkgroupData?.name || (call?.talkgroup ? `TG ${call.talkgroup}` : `Call ${call?.id || "--"}`);
  }

  recordingSubtitle(call) {
    const parts = [
      call?.systemData?.label || (call?.system ? `System ${call.system}` : ""),
      call?.dateTime ? new Date(call.dateTime).toLocaleString() : "",
      this.formatCaller(call),
    ].filter(Boolean);
    return parts.join(" - ");
  }

  closeStatus(event) {
    if (!event) return "Connection closed";
    if (event.code === 1006 && window.location.protocol === "https:" && this.getWsUrl().startsWith("ws://")) {
      return "Blocked: use WSS";
    }
    return event.code ? `Closed ${event.code}` : "Connection closed";
  }

  async shareFile(blob, filename) {
    try {
      if (!navigator.canShare || !navigator.share || typeof File === "undefined") return false;
      const file = new File([blob], filename, { type: blob.type || "audio/wav" });
      if (!navigator.canShare({ files: [file] })) return false;
      await navigator.share({ files: [file], title: filename });
      return true;
    } catch {
      return false;
    }
  }

  setText(selector, value) {
    const element = this.querySelector(selector);
    if (element) element.textContent = value ?? "--";
  }

  isAudioPlaying() {
    return Boolean(this._audioSource || this._htmlAudioPlaying);
  }

  ensureHtmlAudio() {
    if (!this._htmlAudio) this._htmlAudio = this.querySelector(".rdio-audio");
    return this._htmlAudio;
  }

  shouldUseHtmlAudio() {
    if (this.config.audio_mode === "html5") return true;
    if (this.config.audio_mode === "webaudio") return false;
    return /Android|iPhone|iPad|iPod|Mobile|wv|Fully/i.test(navigator.userAgent || "");
  }

  revokeAudioObjectUrl() {
    if (this._audioObjectUrl) {
      URL.revokeObjectURL(this._audioObjectUrl);
      this._audioObjectUrl = undefined;
    }
  }

  silentWavDataUri() {
    return "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
  }

  escape(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
}

customElements.define("rdio-scanner-card", RdioScannerCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "rdio-scanner-card",
  name: "Rdio Scanner Card",
  description: "Native Rdio Scanner live-feed card with optional iframe fallback.",
});
