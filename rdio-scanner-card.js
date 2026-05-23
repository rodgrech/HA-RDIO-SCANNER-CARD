class RdioScannerCard extends HTMLElement {
  static getStubConfig() {
    return {
      type: "custom:rdio-scanner-card",
      mode: "native",
      title: "Rdio Scanner",
      url: "http://192.168.1.49:3000",
      access_code: "",
      status_entity: "sensor.rdio_scanner_status",
      systems_entity: "sensor.rdio_scanner_systems",
      talkgroups_entity: "sensor.rdio_scanner_talkgroups",
      height: 640,
      show_header: true,
      live_header: false,
      auto_start: true,
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
    this._call = undefined;
    this._queue = [];
    this._configData = undefined;
    this._live = false;
    this._linked = false;
    this._authRequired = false;
    this._manualStop = false;
    this._reconnectTimer = undefined;
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
    return entityUrl || this.config.url || "http://192.168.1.49:3000";
  }

  getWsUrl() {
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
          .screen{display:grid;grid-template-rows:auto 1fr;gap:12px;padding:14px;background:radial-gradient(circle at 78% 12%,rgba(37,99,235,.18),transparent 28%),#101316}
          .lcd{min-height:142px;display:grid;gap:10px;align-content:center;padding:18px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:#07130d;color:#b7f56f;box-shadow:inset 0 0 28px rgba(89,255,120,.08);font-family:"Courier New",Consolas,monospace}
          .channel{font-size:clamp(26px,7vw,46px);font-weight:900;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.caller{font-size:clamp(16px,4vw,26px);font-weight:800;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.detail{display:flex;flex-wrap:wrap;gap:10px;font-size:12px;color:#7fbd62}
          .unlock{display:none;grid-template-columns:minmax(0,1fr) auto;gap:8px}.unlock.show{display:grid}.unlock input{min-width:0;height:36px;padding:0 11px;border-radius:18px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:var(--primary-text-color)}
          .controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.controls .primary{background:#2276d2}.controls .danger{background:#7f2a2a}.queue{margin-left:auto;color:var(--secondary-text-color);font-size:12px}
          .foot{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid rgba(255,255,255,.08);background:#181d22}.metric{padding:10px 12px;border-right:1px solid rgba(255,255,255,.08)}.metric:last-child{border-right:0}.label{color:var(--secondary-text-color);font-size:11px;text-transform:uppercase}.value{margin-top:3px;font-size:14px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
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
          </div>
          <div class="foot">
            <div class="metric"><div class="label">Link</div><div class="value link-value">Offline</div></div>
            <div class="metric"><div class="label">Mode</div><div class="value mode-value">Native</div></div>
            <div class="metric"><div class="label">Audio</div><div class="value audio-value">Idle</div></div>
          </div>
        </div>
      </ha-card>
    `;

    this.querySelector(".native-start")?.addEventListener("click", () => this.startNative({ userGesture: true }));
    this.querySelector(".native-stop")?.addEventListener("click", () => this.stopNative({ reconnect: false, manual: true }));
    this.querySelector(".native-skip")?.addEventListener("click", () => this.skipCall());
    this.querySelector(".native-reconnect")?.addEventListener("click", () => this.startNative({ reconnect: true, userGesture: true }));
    this.querySelector(".native-open")?.addEventListener("click", () => window.open(this.getUrl(), "_blank", "noopener,noreferrer"));
    this.querySelector(".unlock-button")?.addEventListener("click", () => this.sendAccessCode());
    this.querySelector(".access-code")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") this.sendAccessCode();
    });

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
    this.ensureAudio(options.userGesture);
    if (this._ws && this._ws.readyState <= 1) return;

    this.setNativeStatus("Connecting");
    this._ws = new WebSocket(this.getWsUrl());
    this._ws.onopen = () => {
      this._linked = true;
      this.sendWs("VER");
      this.sendWs("CFG");
      this.updateNativeUi();
    };
    this._ws.onmessage = (event) => this.handleWsMessage(event.data);
    this._ws.onerror = () => {
      this.setNativeStatus("Connection error");
      this.updateNativeUi();
    };
    this._ws.onclose = () => {
      this._linked = false;
      this._live = false;
      this.updateNativeUi();
      if (!this._manualStop) {
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

    const [command, payload] = message;
    if (command === "PIN") {
      this._authRequired = true;
      this.updateNativeUi();
      if (this.config.access_code) this.sendAccessCode(this.config.access_code);
    } else if (command === "CFG") {
      this._authRequired = false;
      this._configData = payload;
      this.subscribeAllTalkgroups();
      this.updateNativeUi();
    } else if (command === "LFM") {
      this._live = Boolean(payload);
      this.updateNativeUi();
    } else if (command === "CAL" && payload) {
      this.queueCall(this.decorateCall(payload));
    } else if (command === "XPR") {
      this._authRequired = true;
      this.setNativeStatus("Access expired");
    } else if (command === "MAX") {
      this.setNativeStatus("Too many listeners");
    }
  }

  sendAccessCode(code = undefined) {
    const value = code ?? this.querySelector(".access-code")?.value ?? "";
    if (!value) return;
    this.sendWs("PIN", window.btoa(value));
    const input = this.querySelector(".access-code");
    if (input) input.value = "";
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

  decorateCall(call) {
    const systems = Array.isArray(this._configData?.systems) ? this._configData.systems : [];
    call.systemData = systems.find((system) => system.id === call.system);
    call.talkgroupData = call.systemData?.talkgroups?.find((talkgroup) => talkgroup.id === call.talkgroup);
    if (call.talkgroupData?.frequency) call.frequency = call.talkgroupData.frequency;
    return call;
  }

  queueCall(call) {
    if (!call?.audio?.data) return;
    this._queue.push(call);
    this.updateNativeUi();
    if (!this._call && !this._audioSource) this.playNext();
  }

  async playNext() {
    if (this._audioSource || this._call) return;
    const call = this._queue.shift();
    if (!call) {
      this.updateNativeUi();
      return;
    }
    this._call = call;
    this.updateNativeUi();

    const audioContext = this.ensureAudio();
    if (!audioContext) {
      this.setNativeStatus("Tap Start for audio");
      return;
    }

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
    } catch {
      this._audioSource = undefined;
      this._call = undefined;
      this.setNativeStatus("Audio decode failed");
      this.updateNativeUi();
      window.setTimeout(() => this.playNext(), 250);
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

  stopAudio() {
    if (this._audioSource) {
      this._audioSource.onended = null;
      this._audioSource.stop();
      this._audioSource.disconnect();
      this._audioSource = undefined;
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
    const status = this._authRequired ? "Unlock required" : this._live ? "Live feed on" : this._linked ? "Connected" : "Stopped";
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
    this.setText(".audio-value", this._audioSource ? "Playing" : this._queue.length ? "Queued" : "Idle");
    this.querySelector(".unlock")?.classList.toggle("show", this._authRequired && !this.config.access_code);
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

  setText(selector, value) {
    const element = this.querySelector(selector);
    if (element) element.textContent = value ?? "--";
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
