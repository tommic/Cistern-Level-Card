/**
 * Cistern Level Card
 * Zeigt den Füllstand einer Zisterne/Tanks als animierten Tank mit
 * sanften Wellen, inkl. Umrechnung von cm-Füllstand in Liter.
 *
 * Konfiguration (Beispiel):
 * type: custom:cistern-level-card
 * entity: sensor.zisterne_fuellstand
 * name: Zisterne
 * max_height_cm: 200
 * max_volume_l: 6000
 * min_height_cm: 0
 * decimals: 0
 * water_color: "#1E88E5"
 * show_liters: true
 */

const CARD_VERSION = "1.2.0";

class CisternLevelCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("cistern-level-card-editor");
  }

  static getStubConfig(hass) {
    const sensorEntity = Object.keys(hass?.states || {}).find((eid) =>
      eid.startsWith("sensor.")
    );
    return {
      entity: sensorEntity || "sensor.zisterne_fuellstand",
      name: "Zisterne",
      max_height_cm: 200,
      max_volume_l: 6000,
      min_height_cm: 0,
      decimals: 0,
      show_liters: true,
    };
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("Bitte eine 'entity' angeben (Sensor mit Füllstand in cm).");
    }
    this._config = {
      name: config.name || "",
      max_height_cm: Number(config.max_height_cm) || 200,
      min_height_cm: Number(config.min_height_cm) || 0,
      max_volume_l: config.max_volume_l != null ? Number(config.max_volume_l) : null,
      decimals: config.decimals != null ? Number(config.decimals) : 0,
      water_color: config.water_color || "#1e88e5",
      water_color_light: config.water_color_light || "#4fa8f0",
      show_liters: config.show_liters !== false,
      show_percentage: config.show_percentage !== false,
      unit_source: config.unit_source || "cm",
      icon: config.icon || "mdi:waves",
      ...config,
    };
    this._lastPercent = null;
    if (!this._built) {
      this._buildStaticDom();
      this._built = true;
    }
    this._updateContent();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._built) {
      this._updateContent();
    }
  }

  getCardSize() {
    return 4;
  }

  connectedCallback() {
    if (this._config && !this._built) {
      this._buildStaticDom();
      this._built = true;
      this._updateContent();
    }
  }

  _buildStaticDom() {
    const root = this.attachShadow ? this : null;
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        ha-card {
          cursor: pointer;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 1.05em;
          font-weight: 500;
          color: var(--primary-text-color);
        }
        .header ha-icon {
          color: var(--water-color, #1e88e5);
        }
        .body {
          display: flex;
          align-items: stretch;
          gap: 20px;
        }
        .tank-wrap {
          position: relative;
          width: 96px;
          min-width: 96px;
          height: 200px;
          border-radius: 14px;
          border: 3px solid var(--divider-color, #8888);
          background: var(--card-background-color, #fff1);
          overflow: hidden;
          box-shadow: inset 0 2px 6px rgba(0,0,0,0.15);
        }
        .fill {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          /* Platz für die Welle lassen, damit sie bei 100 % am oberen Rand endet */
          --p: 0;
          height: calc((100% - 11px) * var(--p));
          transition: height 1.2s ease-in-out;
        }
        .fill.empty .waves { display: none; }
        .water {
          position: absolute;
          inset: 0;
          background: var(--water-color, #1e88e5);
        }
        .waves {
          position: absolute;
          left: 0;
          right: 0;
          top: -11px;
          height: 12px;
          pointer-events: none;
        }
        .wave {
          position: absolute;
          left: 0;
          bottom: 0;
          width: 200%;
          height: 100%;
          animation: waveMove 6s linear infinite;
        }
        .wave path { fill: var(--water-color, #1e88e5); }
        .wave.wave-back {
          height: 100%;
          bottom: 1px;
          opacity: 0.5;
          animation-duration: 9s;
          animation-direction: reverse;
        }
        .wave.wave-back path { fill: var(--water-color-light, #4fa8f0); }
        @keyframes waveMove {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .wave { animation: none; }
        }
        .scale {
          position: absolute;
          right: 4px;
          top: 6px;
          bottom: 6px;
          width: 1px;
          background: transparent;
        }
        .tick {
          position: absolute;
          right: 0;
          width: 6px;
          height: 1px;
          background: var(--divider-color, #8886);
        }
        .stats {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 10px;
          flex: 1;
        }
        .stat-main {
          font-size: 2.1em;
          font-weight: 600;
          color: var(--primary-text-color);
          line-height: 1.1;
        }
        .stat-sub {
          font-size: 1.0em;
          color: var(--secondary-text-color);
        }
        .stat-row {
          display: flex;
          flex-direction: column;
        }
        .unavailable {
          color: var(--error-color, #db4437);
          font-size: 0.9em;
        }
      </style>
      <ha-card>
        <div class="header">
          <ha-icon icon=""></ha-icon>
          <span class="name"></span>
        </div>
        <div class="body">
          <div class="tank-wrap">
            <div class="fill empty">
              <div class="water"></div>
              <div class="waves">
                <svg class="wave wave-back" viewBox="0 0 192 12" preserveAspectRatio="none"><path d="M0 6 Q24 0 48 6 T96 6 T144 6 T192 6 V12 H0 Z"/></svg>
                <svg class="wave" viewBox="0 0 192 12" preserveAspectRatio="none"><path d="M0 6 Q24 12 48 6 T96 6 T144 6 T192 6 V12 H0 Z"/></svg>
              </div>
            </div>
            <div class="scale"></div>
          </div>
          <div class="stats">
            <div class="stat-row">
              <span class="stat-main percentage">–</span>
              <span class="stat-sub liters"></span>
            </div>
            <div class="stat-row">
              <span class="stat-sub height-info"></span>
            </div>
            <div class="unavailable" style="display:none;"></div>
          </div>
        </div>
      </ha-card>
    `;

    this._els = {
      card: this.shadowRoot.querySelector("ha-card"),
      icon: this.shadowRoot.querySelector(".header ha-icon"),
      name: this.shadowRoot.querySelector(".name"),
      fill: this.shadowRoot.querySelector(".fill"),
      percentage: this.shadowRoot.querySelector(".percentage"),
      liters: this.shadowRoot.querySelector(".liters"),
      heightInfo: this.shadowRoot.querySelector(".height-info"),
      unavailable: this.shadowRoot.querySelector(".unavailable"),
      tankWrap: this.shadowRoot.querySelector(".tank-wrap"),
    };
    this._els.card.addEventListener("click", () => this._showHistory());
  }

  _updateContent() {
    if (!this._config || !this._hass || !this._els) return;
    const cfg = this._config;
    const stateObj = this._hass.states[cfg.entity];

    this._els.icon.setAttribute("icon", cfg.icon);
    this._els.name.textContent = cfg.name || stateObj?.attributes?.friendly_name || cfg.entity;
    this._els.tankWrap.style.setProperty("--water-color", cfg.water_color);
    this._els.tankWrap.style.setProperty("--water-color-light", cfg.water_color_light);
    this.shadowRoot.querySelector(".header ha-icon").style.setProperty(
      "--water-color",
      cfg.water_color
    );

    if (!stateObj || stateObj.state === "unavailable" || stateObj.state === "unknown") {
      this._els.unavailable.style.display = "block";
      this._els.unavailable.textContent = !stateObj
        ? `Entität ${cfg.entity} nicht gefunden`
        : "Sensor nicht verfügbar";
      this._els.percentage.textContent = "–";
      this._els.liters.textContent = "";
      this._els.heightInfo.textContent = "";
      this._setFillPercent(0);
      return;
    }
    this._els.unavailable.style.display = "none";

    const rawLevel = parseFloat(stateObj.state);
    const minH = cfg.min_height_cm;
    const maxH = cfg.max_height_cm;
    const usableHeight = Math.max(maxH - minH, 0.0001);
    const effectiveLevel = Math.min(Math.max(rawLevel - minH, 0), usableHeight);
    const percent = (effectiveLevel / usableHeight) * 100;

    this._setFillPercent(percent);

    if (cfg.show_percentage) {
      this._els.percentage.textContent = `${percent.toLocaleString("de-DE", {
        maximumFractionDigits: 1,
      })} %`;
    } else {
      this._els.percentage.textContent = `${rawLevel.toLocaleString("de-DE")} ${cfg.unit_source}`;
    }

    if (cfg.show_liters && cfg.max_volume_l) {
      const liters = (percent / 100) * cfg.max_volume_l;
      this._els.liters.textContent = `${liters.toLocaleString("de-DE", {
        maximumFractionDigits: cfg.decimals,
      })} L von ${cfg.max_volume_l.toLocaleString("de-DE")} L`;
    } else {
      this._els.liters.textContent = "";
    }

    this._els.heightInfo.textContent = `Füllstand: ${rawLevel.toLocaleString("de-DE")} ${
      cfg.unit_source
    } (max. ${maxH} ${cfg.unit_source})`;
  }

  _showHistory() {
    if (!this._config?.entity) return;
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId: this._config.entity },
        bubbles: true,
        composed: true,
      })
    );
  }

  _setFillPercent(percent) {
    const clamped = Math.min(Math.max(percent, 0), 100);
    if (this._lastPercent === clamped) return;
    this._lastPercent = clamped;
    this._els.fill.style.setProperty("--p", clamped / 100);
    this._els.fill.classList.toggle("empty", clamped <= 0);
  }
}

class CisternLevelCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._entityPicker) {
      this._entityPicker.hass = hass;
    }
  }

  _render() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }
    const cfg = this._config || {};
    this.shadowRoot.innerHTML = `
      <style>
        .row { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
        label { font-size: 0.9em; color: var(--secondary-text-color); }
        input {
          padding: 8px;
          border-radius: 6px;
          border: 1px solid var(--divider-color, #ccc);
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color);
        }
        .two-col { display: flex; gap: 12px; }
        .two-col .row { flex: 1; }
        .checkbox-row { flex-direction: row; align-items: center; gap: 8px; }
      </style>
      <div class="editor">
        <div class="row">
          <label>Entität (Füllstand-Sensor in cm) *</label>
          <ha-entity-picker id="entity"></ha-entity-picker>
        </div>
        <div class="row">
          <label>Name</label>
          <input id="name" type="text" value="${cfg.name || ""}" placeholder="Zisterne" />
        </div>
        <div class="two-col">
          <div class="row">
            <label>Max. Höhe (cm) *</label>
            <input id="max_height_cm" type="number" value="${cfg.max_height_cm ?? 200}" />
          </div>
          <div class="row">
            <label>Min./Totpunkt Höhe (cm)</label>
            <input id="min_height_cm" type="number" value="${cfg.min_height_cm ?? 0}" />
          </div>
        </div>
        <div class="row">
          <label>Max. Volumen (Liter)</label>
          <input id="max_volume_l" type="number" value="${cfg.max_volume_l ?? ""}" placeholder="6000" />
        </div>
        <div class="two-col">
          <div class="row">
            <label>Wasserfarbe</label>
            <input id="water_color" type="color" value="${cfg.water_color || "#1e88e5"}" />
          </div>
          <div class="row">
            <label>Icon</label>
            <input id="icon" type="text" value="${cfg.icon || "mdi:waves"}" />
          </div>
        </div>
      </div>
    `;

    this._entityPicker = this.shadowRoot.getElementById("entity");
    this._entityPicker.hass = this._hass;
    this._entityPicker.value = cfg.entity || "";
    this._entityPicker.includeDomains = ["sensor", "input_number", "number"];
    this._entityPicker.addEventListener("value-changed", (e) => {
      this._updateConfig("entity", e.detail.value);
    });

    ["name", "max_height_cm", "min_height_cm", "max_volume_l", "water_color", "icon"].forEach(
      (id) => {
        const el = this.shadowRoot.getElementById(id);
        el.addEventListener("change", (e) => {
          let value = e.target.value;
          if (["max_height_cm", "min_height_cm", "max_volume_l"].includes(id)) {
            value = value === "" ? undefined : Number(value);
          }
          this._updateConfig(id, value);
        });
      }
    );
  }

  _updateConfig(key, value) {
    this._config = { ...this._config, [key]: value };
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
  }
}

customElements.define("cistern-level-card", CisternLevelCard);
customElements.define("cistern-level-card-editor", CisternLevelCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "cistern-level-card",
  name: "Cistern Level Card",
  description: "Zeigt den Füllstand einer Zisterne mit animierter Wasseroberfläche.",
  preview: true,
});

console.info(
  `%c CISTERN-LEVEL-CARD %c v${CARD_VERSION} `,
  "color: white; background: #1e88e5; font-weight: 700;",
  "color: #1e88e5; background: white; font-weight: 700;"
);
