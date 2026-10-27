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

const CARD_VERSION = "1.6.0";

const HISTORY_REFRESH_MS = 10 * 60 * 1000;

const TRANSLATIONS = {
  de: {
    entity_required: "Bitte eine 'entity' angeben (Sensor mit Füllstand).",
    entity_not_found: "Entität {entity} nicht gefunden",
    sensor_unavailable: "Sensor nicht verfügbar",
    liters_of: "{liters} L von {max} L",
    level_info: "Füllstand: {level} {unit} (max. {max} {unit})",
    low_level: "Füllstand niedrig",
    history_range: "Min / Max ({hours} h): {min} / {max}",
    history_usage: "Verbrauch: ca. {value}/Tag",
    history_days_left: "Reicht noch ca. {days} Tage",
    "editor.entity": "Entität (Füllstand-Sensor) *",
    "editor.name": "Name",
    "editor.max_height_cm": "Max. Höhe (cm) *",
    "editor.min_height_cm": "Min./Totpunkt Höhe (cm)",
    "editor.max_volume_l": "Max. Volumen (Liter)",
    "editor.decimals": "Nachkommastellen (Liter)",
    "editor.unit_source": "Einheit des Sensors",
    "editor.water_color": "Wasserfarbe",
    "editor.water_color_light": "Wellenfarbe (hell)",
    "editor.icon": "Icon",
    "editor.show_percentage": "Prozent anzeigen",
    "editor.show_liters": "Liter anzeigen",
    "editor.show_history": "Verbrauch und Reichweite anzeigen",
    "editor.show_scale": "Skala am Tank anzeigen",
    "editor.tank_height": "Höhe des Tanks (px)",
    "editor.tank_width": "Breite des Tanks (px)",
    "editor.low_level_percent": "Warnung unter (%)",
    "editor.low_level_percent.hint": "Unter diesem Füllstand wird das Wasser in der Warnfarbe angezeigt. Leer = keine Warnung.",
    "editor.low_level_color": "Warnfarbe",
    "editor.history_hours": "Rückblick für Verbrauch (Stunden)",
    "editor.history_hours.hint":
      "So weit schaut die Karte zurück, um Verbrauch, Reichweite und Min/Max zu berechnen. 72 = die letzten 3 Tage. Länger = ruhigerer Wert, kürzer = reagiert schneller.",
  },
  en: {
    entity_required: "Please set an 'entity' (level sensor).",
    entity_not_found: "Entity {entity} not found",
    sensor_unavailable: "Sensor unavailable",
    liters_of: "{liters} L of {max} L",
    level_info: "Level: {level} {unit} (max. {max} {unit})",
    low_level: "Low level",
    history_range: "Min / Max ({hours} h): {min} / {max}",
    history_usage: "Usage: approx. {value}/day",
    history_days_left: "Lasts approx. {days} more days",
    "editor.entity": "Entity (level sensor) *",
    "editor.name": "Name",
    "editor.max_height_cm": "Max. height (cm) *",
    "editor.min_height_cm": "Min./dead space height (cm)",
    "editor.max_volume_l": "Max. volume (litres)",
    "editor.decimals": "Decimals (litres)",
    "editor.unit_source": "Sensor unit",
    "editor.water_color": "Water colour",
    "editor.water_color_light": "Wave colour (light)",
    "editor.icon": "Icon",
    "editor.show_percentage": "Show percentage",
    "editor.show_liters": "Show litres",
    "editor.show_history": "Show usage and remaining days",
    "editor.show_scale": "Show scale on tank",
    "editor.tank_height": "Tank height (px)",
    "editor.tank_width": "Tank width (px)",
    "editor.low_level_percent": "Warn below (%)",
    "editor.low_level_percent.hint": "Below this level the water is shown in the warning colour. Empty = no warning.",
    "editor.low_level_color": "Warning colour",
    "editor.history_hours": "Look-back for usage (hours)",
    "editor.history_hours.hint":
      "How far back the card looks to calculate usage, remaining days and min/max. 72 = the last 3 days. Longer = steadier value, shorter = reacts faster.",
  },
};

// Hellere Wellenfarbe aus der Wasserfarbe ableiten, wenn keine explizit gesetzt ist.
function lightenColor(color) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(color).trim());
  if (!m) return `color-mix(in srgb, ${color} 65%, white)`;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const mixed = [0, 2, 4].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(v + (255 - v) * 0.35)
      .toString(16)
      .padStart(2, "0");
  });
  return `#${mixed.join("")}`;
}

// Sprache aus Home Assistant (hass.locale) übernehmen; Fallback: Browser, dann Englisch.
function resolveLocale(hass) {
  return hass?.locale?.language || hass?.language || navigator.language || "en";
}

function translate(locale, key, vars = {}) {
  const lang = String(locale).toLowerCase().startsWith("de") ? "de" : "en";
  const text = TRANSLATIONS[lang][key] ?? TRANSLATIONS.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? "");
}

// Zeitpunkt (ms) eines Verlaufseintrags; NaN, wenn keiner vorhanden ist.
function historyTime(entry) {
  const raw = entry.lu ?? entry.lc ?? entry.last_updated ?? entry.last_changed;
  if (typeof raw === "number") return raw < 1e12 ? raw * 1000 : raw;
  return raw ? Date.parse(raw) : NaN;
}

function formatNumber(locale, value, options) {
  try {
    return value.toLocaleString(locale, options);
  } catch (e) {
    return value.toLocaleString("en", options);
  }
}

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
      throw new Error(translate(resolveLocale(this._hass), "entity_required"));
    }
    this._config = {
      name: config.name || "",
      max_height_cm: Number(config.max_height_cm) || 200,
      min_height_cm: Number(config.min_height_cm) || 0,
      max_volume_l: config.max_volume_l != null ? Number(config.max_volume_l) : null,
      decimals: config.decimals != null ? Number(config.decimals) : 0,
      water_color: config.water_color || "#1e88e5",
      show_liters: config.show_liters !== false,
      show_percentage: config.show_percentage !== false,
      show_history: config.show_history !== false,
      history_hours: Number(config.history_hours) > 0 ? Number(config.history_hours) : 72,
      unit_source: config.unit_source || "cm",
      icon: config.icon || "mdi:waves",
      ...config,
    };
    // Normalisierte Werte (müssen nach ...config stehen, damit ungültige Eingaben nicht überschreiben)
    this._config.tank_height = Number(config.tank_height) > 0 ? Number(config.tank_height) : 200;
    this._config.tank_width = Number(config.tank_width) > 0 ? Number(config.tank_width) : 96;
    this._config.show_scale = config.show_scale !== false;
    this._config.low_level_percent =
      config.low_level_percent != null && config.low_level_percent !== ""
        ? Number(config.low_level_percent)
        : null;
    this._config.low_level_color = config.low_level_color || "#e53935";
    this._lastPercent = null;
    this._history = null;
    this._historyFetchedAt = 0;
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
          width: var(--tank-width, 96px);
          min-width: var(--tank-width, 96px);
          height: var(--tank-height, 200px);
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
          inset: 0;
          pointer-events: none;
        }
        .scale.hidden { display: none; }
        .tick {
          position: absolute;
          right: 4px;
          padding: 1px 4px;
          border-radius: 4px;
          font-size: 0.65em;
          line-height: 1.2;
          color: #fff;
          background: rgba(0, 0, 0, 0.4);
          /* Position wie die Füllhöhe: Platz für die Welle oben abziehen */
          bottom: calc((100% - 11px) * var(--t));
          transform: translateY(50%);
        }
        .low .stat-main { color: var(--low-color); }
        .low-hint {
          color: var(--low-color);
          font-size: 0.9em;
          font-weight: 500;
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
        .history {
          gap: 2px;
          font-size: 0.9em;
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
            <div class="scale">
              <span class="tick" style="--t:0.75">75 %</span>
              <span class="tick" style="--t:0.5">50 %</span>
              <span class="tick" style="--t:0.25">25 %</span>
            </div>
          </div>
          <div class="stats">
            <div class="stat-row">
              <span class="stat-main percentage">–</span>
              <span class="stat-sub liters"></span>
            </div>
            <div class="stat-row">
              <span class="stat-sub height-info"></span>
            </div>
            <div class="stat-row history" style="display:none;">
              <span class="stat-sub history-range"></span>
              <span class="stat-sub history-usage"></span>
              <span class="stat-sub history-days"></span>
            </div>
            <div class="low-hint" style="display:none;"></div>
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
      history: this.shadowRoot.querySelector(".history"),
      historyRange: this.shadowRoot.querySelector(".history-range"),
      historyUsage: this.shadowRoot.querySelector(".history-usage"),
      historyDays: this.shadowRoot.querySelector(".history-days"),
      unavailable: this.shadowRoot.querySelector(".unavailable"),
      lowHint: this.shadowRoot.querySelector(".low-hint"),
      scale: this.shadowRoot.querySelector(".scale"),
      tankWrap: this.shadowRoot.querySelector(".tank-wrap"),
    };
    this._els.card.addEventListener("click", () => this._showHistory());
  }

  _t(key, vars) {
    return translate(resolveLocale(this._hass), key, vars);
  }

  // Wasserfarbe setzen; die helle Wellenfarbe wird bei Warnung immer abgeleitet.
  _applyWaterColor(color, low) {
    const cfg = this._config;
    this._els.tankWrap.style.setProperty("--water-color", color);
    this._els.tankWrap.style.setProperty(
      "--water-color-light",
      !low && cfg.water_color_light ? cfg.water_color_light : lightenColor(color)
    );
  }

  _updateContent() {
    if (!this._config || !this._hass || !this._els) return;
    const cfg = this._config;
    const stateObj = this._hass.states[cfg.entity];

    this._els.icon.setAttribute("icon", cfg.icon);
    this._els.name.textContent = cfg.name || stateObj?.attributes?.friendly_name || cfg.entity;
    this._els.tankWrap.style.setProperty("--tank-width", `${cfg.tank_width}px`);
    this._els.tankWrap.style.setProperty("--tank-height", `${cfg.tank_height}px`);
    this._els.scale.classList.toggle("hidden", !cfg.show_scale);
    this._els.card.style.setProperty("--low-color", cfg.low_level_color);
    this.shadowRoot.querySelector(".header ha-icon").style.setProperty(
      "--water-color",
      cfg.water_color
    );

    this._applyWaterColor(cfg.water_color, false);
    this._els.card.classList.remove("low");
    this._els.lowHint.style.display = "none";

    if (!stateObj || stateObj.state === "unavailable" || stateObj.state === "unknown") {
      this._els.unavailable.style.display = "block";
      this._els.unavailable.textContent = !stateObj
        ? this._t("entity_not_found", { entity: cfg.entity })
        : this._t("sensor_unavailable");
      this._els.percentage.textContent = "–";
      this._els.liters.textContent = "";
      this._els.heightInfo.textContent = "";
      this._els.history.style.display = "none";
      this._setFillPercent(0);
      return;
    }
    this._els.unavailable.style.display = "none";

    const loc = resolveLocale(this._hass);
    const rawLevel = parseFloat(stateObj.state);
    if (isNaN(rawLevel)) {
      this._els.unavailable.style.display = "block";
      this._els.unavailable.textContent = this._t("sensor_unavailable");
      this._els.percentage.textContent = "–";
      this._els.liters.textContent = "";
      this._els.heightInfo.textContent = "";
      this._els.history.style.display = "none";
      this._setFillPercent(0);
      return;
    }
    const minH = cfg.min_height_cm;
    const maxH = cfg.max_height_cm;
    const usableHeight = Math.max(maxH - minH, 0.0001);
    const effectiveLevel = Math.min(Math.max(rawLevel - minH, 0), usableHeight);
    const percent = (effectiveLevel / usableHeight) * 100;

    this._setFillPercent(percent);

    // Warnstufe: Wasser und Prozentanzeige in der Warnfarbe
    const low = cfg.low_level_percent != null && percent <= cfg.low_level_percent;
    this._els.card.classList.toggle("low", low);
    this._els.lowHint.style.display = low ? "" : "none";
    this._els.lowHint.textContent = low ? this._t("low_level") : "";
    this._applyWaterColor(low ? cfg.low_level_color : cfg.water_color, low);

    if (cfg.show_percentage) {
      this._els.percentage.textContent = `${formatNumber(loc, percent, {
        maximumFractionDigits: 1,
      })} %`;
    } else {
      this._els.percentage.textContent = `${formatNumber(loc, rawLevel)} ${cfg.unit_source}`;
    }

    if (cfg.show_liters && cfg.max_volume_l) {
      const liters = (percent / 100) * cfg.max_volume_l;
      this._els.liters.textContent = this._t("liters_of", {
        liters: formatNumber(loc, liters, { maximumFractionDigits: cfg.decimals }),
        max: formatNumber(loc, cfg.max_volume_l),
      });
    } else {
      this._els.liters.textContent = "";
    }

    this._els.heightInfo.textContent = this._t("level_info", {
      level: formatNumber(loc, rawLevel),
      max: formatNumber(loc, maxH),
      unit: cfg.unit_source,
    });

    this._maybeFetchHistory();
    this._renderHistory(percent);
  }

  // Verlauf der letzten Stunden holen (höchstens alle 10 Minuten).
  async _maybeFetchHistory() {
    const cfg = this._config;
    if (!cfg.show_history || this._historyLoading || !this._hass?.callWS) return;
    if (Date.now() - this._historyFetchedAt < HISTORY_REFRESH_MS) return;
    this._historyLoading = true;
    this._historyFetchedAt = Date.now();
    try {
      const end = new Date();
      const start = new Date(end.getTime() - cfg.history_hours * 3600 * 1000);
      const result = await this._hass.callWS({
        type: "history/history_during_period",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        entity_ids: [cfg.entity],
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      });
      this._history = result?.[cfg.entity] || [];
    } catch (e) {
      this._history = null;
    } finally {
      this._historyLoading = false;
    }
    this._updateContent();
  }

  // Füllstand in Liter (bzw. Prozent ohne Volumen) aus den Verlaufspunkten.
  // Das Messrauschen (Sensor springt ständig um 1 Einheit) darf nicht als Verbrauch
  // zählen: Der Verlauf wird deshalb auf Stundenwerte (Median) geglättet, und nur
  // Abnahmen ab einer Mindestgröße werden als Verbrauch gewertet. Zuflüsse (Regen,
  // Nachfüllen) werden nicht gegengerechnet.
  _computeHistoryStats() {
    const cfg = this._config;
    const usable = Math.max(cfg.max_height_cm - cfg.min_height_cm, 0.0001);
    const toUnit = (raw) => {
      const pct = Math.min(Math.max(raw - cfg.min_height_cm, 0), usable) / usable;
      return cfg.max_volume_l ? pct * cfg.max_volume_l : pct * 100;
    };
    const HOUR = 3600 * 1000;
    const end = Date.now();
    const start = end - cfg.history_hours * HOUR;

    const points = (this._history || [])
      .map((e) => ({ t: historyTime(e), v: parseFloat(e.s ?? e.state) }))
      .filter((p) => !isNaN(p.v));
    if (!points.length) return null;
    if (points.some((p) => isNaN(p.t))) {
      // Ohne Zeitstempel: gleichmäßig über den Zeitraum verteilen
      points.forEach((p, i) => (p.t = start + ((i + 0.5) / points.length) * (end - start)));
    }
    points.sort((x, y) => x.t - y.t);
    points.forEach((p) => (p.v = toUnit(p.v)));

    // Stundenwerte: Median aus dem zuletzt bekannten Wert und allen Werten der Stunde
    const median = (arr) => {
      const sorted = [...arr].sort((x, y) => x - y);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };
    const buckets = Math.max(Math.ceil(cfg.history_hours), 1);
    const hourly = [];
    let idx = 0;
    let carry = points[0].v;
    for (let i = 0; i < buckets; i++) {
      const from = start + i * HOUR;
      const to = from + HOUR;
      while (idx < points.length && points[idx].t < from) carry = points[idx++].v;
      const values = [carry];
      for (let j = idx; j < points.length && points[j].t < to; j++) values.push(points[j].v);
      hourly.push(median(values));
    }
    // Zusätzlich über 3 Stunden glätten
    const smooth = hourly.map((_, i) =>
      median(hourly.slice(Math.max(i - 1, 0), Math.min(i + 2, hourly.length)))
    );

    // Verbrauch: Abnahmen zählen, sobald sie größer als die Rauschschwelle sind
    const range = cfg.max_volume_l || 100;
    const threshold = range * 0.015;
    let used = 0;
    let ref = smooth[0];
    smooth.forEach((v) => {
      if (Math.abs(v - ref) >= threshold) {
        if (v < ref) used += ref - v;
        ref = v;
      }
    });
    return {
      min: Math.min(...smooth),
      max: Math.max(...smooth),
      perDay: (used / cfg.history_hours) * 24,
    };
  }

  _renderHistory(percent) {
    const cfg = this._config;
    const stats = cfg.show_history && this._history ? this._computeHistoryStats() : null;
    if (!stats) {
      this._els.history.style.display = "none";
      return;
    }
    const loc = resolveLocale(this._hass);
    const unit = cfg.max_volume_l ? " L" : " %";
    const fmt = (v) => formatNumber(loc, v, { maximumFractionDigits: cfg.max_volume_l ? cfg.decimals : 1 });
    this._els.history.style.display = "";
    this._els.historyRange.textContent = this._t("history_range", {
      hours: cfg.history_hours,
      min: fmt(stats.min) + unit,
      max: fmt(stats.max) + unit,
    });
    if (stats.perDay > 0) {
      this._els.historyUsage.textContent = this._t("history_usage", {
        value: fmt(stats.perDay) + unit,
      });
      const current = cfg.max_volume_l ? (percent / 100) * cfg.max_volume_l : percent;
      this._els.historyDays.textContent = this._t("history_days_left", {
        days: formatNumber(loc, current / stats.perDay, { maximumFractionDigits: 0 }),
      });
    } else {
      this._els.historyUsage.textContent = "";
      this._els.historyDays.textContent = "";
    }
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

const EDITOR_FIELDS = [
  { key: "name", type: "text", placeholder: "Zisterne" },
  { key: "max_height_cm", type: "number", row: "heights", def: 200 },
  { key: "min_height_cm", type: "number", row: "heights", def: 0 },
  { key: "max_volume_l", type: "number", placeholder: "6000" },
  { key: "decimals", type: "number", row: "display", def: 0 },
  { key: "unit_source", type: "text", row: "display", def: "cm" },
  { key: "water_color", type: "color", row: "colors", def: "#1e88e5" },
  { key: "water_color_light", type: "color", row: "colors" },
  { key: "tank_height", type: "number", row: "size", def: 200 },
  { key: "tank_width", type: "number", row: "size", def: 96 },
  { key: "low_level_percent", type: "number", row: "low", placeholder: "15" },
  { key: "low_level_color", type: "color", row: "low", def: "#e53935" },
  { key: "icon", type: "text", def: "mdi:waves" },
  { key: "show_percentage", type: "checkbox", def: true },
  { key: "show_liters", type: "checkbox", def: true },
  { key: "show_scale", type: "checkbox", def: true },
  { key: "show_history", type: "checkbox", def: true },
  { key: "history_hours", type: "number", def: 72 },
];

class CisternLevelCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    const firstTime = !this._hass;
    this._hass = hass;
    if (this._entityPicker) {
      this._entityPicker.hass = hass;
    }
    if (firstTime && this._config) {
      this._render();
    }
  }

  _t(key) {
    return translate(resolveLocale(this._hass), key);
  }

  _render() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }
    const cfg = this._config || {};
    this.shadowRoot.innerHTML = `
      <style>
        .row { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; flex: 1; }
        label { font-size: 0.9em; color: var(--secondary-text-color); }
        input[type="text"], input[type="number"] {
          padding: 8px;
          border-radius: 6px;
          border: 1px solid var(--divider-color, #ccc);
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color);
        }
        input[type="color"] { width: 100%; height: 36px; padding: 0; border: none; background: none; }
        .group { display: flex; gap: 12px; }
        .hint { font-size: 0.8em; color: var(--secondary-text-color); line-height: 1.3; }
        .checkbox-row { flex-direction: row; align-items: center; gap: 8px; }
      </style>
      <div class="editor">
        <div class="row">
          <label>${this._t("editor.entity")}</label>
          <ha-entity-picker id="entity"></ha-entity-picker>
        </div>
        <div id="fields"></div>
      </div>
    `;

    this._entityPicker = this.shadowRoot.getElementById("entity");
    this._entityPicker.hass = this._hass;
    this._entityPicker.value = cfg.entity || "";
    this._entityPicker.includeDomains = ["sensor", "input_number", "number"];
    this._entityPicker.addEventListener("value-changed", (e) => {
      this._updateConfig("entity", e.detail.value);
    });

    // Felder per DOM aufbauen (nicht per innerHTML), damit Werte mit
    // Anführungszeichen o. ä. die Eingabe nicht zerstören.
    const container = this.shadowRoot.getElementById("fields");
    const groups = {};
    EDITOR_FIELDS.forEach((field) => {
      let parent = container;
      if (field.row) {
        if (!groups[field.row]) {
          groups[field.row] = document.createElement("div");
          groups[field.row].className = "group";
          container.appendChild(groups[field.row]);
        }
        parent = groups[field.row];
      }
      parent.appendChild(this._buildField(field, cfg));
    });
  }

  _derivedLight(waterColor) {
    const light = lightenColor(waterColor || "#1e88e5");
    return /^#[0-9a-f]{6}$/i.test(light) ? light : "#4fa8f0";
  }

  _buildField(field, cfg) {
    const row = document.createElement("div");
    row.className = "row" + (field.type === "checkbox" ? " checkbox-row" : "");
    const label = document.createElement("label");
    label.textContent = this._t(`editor.${field.key}`);
    const input = document.createElement("input");
    input.type = field.type;
    if (field.placeholder) input.placeholder = field.placeholder;
    const current = cfg[field.key];

    if (field.type === "checkbox") {
      input.checked = current !== undefined ? current !== false : field.def !== false;
      input.addEventListener("change", () => this._updateConfig(field.key, input.checked));
      row.append(input, label);
      return row;
    }

    let initial = current ?? field.def ?? "";
    if (field.key === "water_color_light" && current === undefined) {
      initial = this._derivedLight(cfg.water_color);
    }
    input.value = initial;
    input.addEventListener("change", () => {
      let value = input.value;
      if (field.type === "number") {
        value = value === "" ? undefined : Number(value);
      }
      this._updateConfig(field.key, value);
      // Ohne eigene Wellenfarbe folgt die Anzeige der neuen Wasserfarbe
      if (field.key === "water_color" && this._config.water_color_light === undefined) {
        const light = this.shadowRoot.getElementById("field-water_color_light");
        if (light) light.value = this._derivedLight(value);
      }
    });
    input.id = `field-${field.key}`;
    row.append(label, input);
    const hintKey = `editor.${field.key}.hint`;
    if (this._t(hintKey) !== hintKey) {
      const hint = document.createElement("span");
      hint.className = "hint";
      hint.textContent = this._t(hintKey);
      row.append(hint);
    }
    return row;
  }

  _updateConfig(key, value) {
    const config = { ...this._config };
    if (value === undefined || value === "") {
      delete config[key];
    } else {
      config[key] = value;
    }
    this._config = config;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config },
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
