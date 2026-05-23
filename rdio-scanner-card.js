class RdioScannerCard extends HTMLElement {
  static getStubConfig() {
    return {
      type: "custom:rdio-scanner-card",
      title: "Rdio Scanner",
      url: "http://192.168.1.49:3000",
      status_entity: "sensor.rdio_scanner_status",
      systems_entity: "sensor.rdio_scanner_systems",
      talkgroups_entity: "sensor.rdio_scanner_talkgroups",
      height: 640,
      show_header: true,
    };
  }

  setConfig(config) {
    this.config = {
      ...RdioScannerCard.getStubConfig(),
      ...config,
    };
    this._rendered = false;
    this._iframeUrl = undefined;
  }

  set hass(hass) {
    this._hass = hass;
    if (this._rendered) {
      this.updateHeader();
    } else {
      this.render();
    }
  }

  getCardSize() {
    return Math.max(4, Math.ceil((Number(this.config?.height) || 640) / 150));
  }

  connectedCallback() {
    this.render();
  }

  getUrl() {
    const entityUrl = this.value(this.config.url_entity, "");
    return entityUrl || this.config.url || "http://192.168.1.49:3000";
  }

  value(entityId, fallback = "--") {
    const state = entityId && this._hass?.states[entityId]?.state;
    return !state || state === "unknown" || state === "unavailable" ? fallback : state;
  }

  render() {
    if (!this.config) return;

    const url = this.getUrl();
    const height = Math.max(320, Number(this.config.height) || 640);

    if (this._rendered && this._iframeUrl === url) {
      this.updateHeader();
      return;
    }

    this.innerHTML = `
      <ha-card>
        <style>
          ha-card {
            overflow: hidden;
            border-radius: 8px;
            background: #121417;
            color: var(--primary-text-color);
          }
          .rdio-header {
            display: ${this.config.show_header === false ? "none" : "grid"};
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 10px;
            align-items: center;
            padding: 10px 12px;
            background: #1b2026;
            border-bottom: 1px solid rgba(255,255,255,.08);
          }
          .rdio-title {
            min-width: 0;
            display: grid;
            gap: 4px;
          }
          .rdio-name {
            min-width: 0;
            font-size: 15px;
            font-weight: 700;
            line-height: 1.2;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .rdio-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            color: var(--secondary-text-color);
            font-size: 12px;
            line-height: 1.2;
          }
          .rdio-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            display: inline-block;
            background: #ff453a;
            box-shadow: 0 0 8px rgba(255,69,58,.65);
          }
          .rdio-dot.connected {
            background: #34c759;
            box-shadow: 0 0 8px rgba(52,199,89,.8);
          }
          .rdio-status {
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .rdio-actions {
            display: inline-flex;
            gap: 4px;
            align-items: center;
          }
          .rdio-actions button {
            width: 36px;
            height: 36px;
            padding: 0;
            border: 0;
            border-radius: 50%;
            cursor: pointer;
            color: var(--primary-text-color);
            background: rgba(255,255,255,.08);
          }
          .rdio-actions button:hover {
            background: rgba(255,255,255,.14);
          }
          ha-icon {
            --mdc-icon-size: 20px;
            width: 20px;
            height: 20px;
            vertical-align: middle;
          }
          iframe {
            width: 100%;
            height: ${height}px;
            display: block;
            border: 0;
            background: #0b0d0f;
          }
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
    this.querySelector(".rdio-open")?.addEventListener("click", () => {
      window.open(url, "_blank", "noopener,noreferrer");
    });

    this._rendered = true;
    this._iframeUrl = url;
    this.updateHeader();
  }

  updateHeader() {
    if (!this._rendered || !this._hass) return;

    const status = this.value(this.config.status_entity, "Unknown");
    const connected = status.toLowerCase() === "connected";
    const systems = this.value(this.config.systems_entity, "--");
    const talkgroups = this.value(this.config.talkgroups_entity, "--");

    const dot = this.querySelector(".rdio-dot");
    const statusText = this.querySelector(".rdio-status-text");
    const systemsText = this.querySelector(".rdio-systems");
    const talkgroupsText = this.querySelector(".rdio-talkgroups");

    dot?.classList.toggle("connected", connected);
    if (statusText) statusText.textContent = status;
    if (systemsText) systemsText.textContent = systems;
    if (talkgroupsText) talkgroupsText.textContent = talkgroups;
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
  description: "Embeds a local Rdio Scanner feed with Home Assistant status sensors.",
});
