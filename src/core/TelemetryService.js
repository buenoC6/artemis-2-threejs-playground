export class TelemetryService {
  constructor({ pollIntervalMs = 60000, missionStartDate = null } = {}) {
    this.pollIntervalMs = pollIntervalMs;
    this.missionStartDate = missionStartDate ? new Date(missionStartDate) : null;
    this.pollTimer = null;
    this.state = {
      mission: {
        source: "Mission Clock",
        status: "live",
        elapsedMs: 0,
        label: "J+0 00h00",
        updatedAt: Date.now(),
      },
      vehicle: {
        source: "Orion Live Feed",
        status: "idle",
        speedKmH: null,
        temperatureC: null,
        updatedAt: null,
        error: null,
      },
      distances: {
        source: "Orion Live Feed",
        status: "idle",
        earthKm: null,
        moonKm: null,
        signalDelayS: null,
        updatedAt: null,
        error: null,
      },
      spaceWeather: {
        source: "NOAA SWPC",
        status: "idle",
        kpIndex: null,
        radiationMsVh: null,
        updatedAt: null,
        error: null,
      },
    };
  }

  start() {
    if (this.pollTimer) return;
    this.refresh();
    this.pollTimer = window.setInterval(() => {
      this.refresh();
    }, this.pollIntervalMs);
  }

  stop() {
    if (!this.pollTimer) return;
    window.clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  getSnapshot() {
    return {
      mission: { ...this.state.mission },
      vehicle: { ...this.state.vehicle },
      distances: { ...this.state.distances },
      spaceWeather: { ...this.state.spaceWeather },
    };
  }

  async refresh() {
    this.refreshMissionClock();
    await Promise.all([this.refreshOrionTelemetry(), this.refreshSpaceWeather()]);
  }

  refreshMissionClock() {
    if (!this.missionStartDate) return;

    const elapsedMs = Date.now() - this.missionStartDate.getTime();
    this.state.mission = {
      source: "Mission Clock",
      status: "live",
      elapsedMs,
      label: this.formatMissionLabel(elapsedMs),
      updatedAt: Date.now(),
    };
  }

  async refreshOrionTelemetry() {
    try {
      // Source live optionnelle: fichier local alimente par un process externe.
      const response = await fetch("/data/orion-live.json", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();

      const speedKmH = Number(payload?.speedKmH);
      const earthKm = Number(payload?.distanceEarthKm);
      const moonKm = Number(payload?.distanceMoonKm);
      if (!Number.isFinite(speedKmH) || !Number.isFinite(earthKm) || !Number.isFinite(moonKm)) {
        throw new Error("Payload Orion incomplet");
      }

      const now = Date.now();
      const updatedAt = Number.isFinite(Number(payload?.updatedAt))
        ? Number(payload.updatedAt)
        : now;

      this.state.vehicle = {
        source: payload?.source || "Orion Live Feed",
        status: "live",
        speedKmH,
        temperatureC: Number.isFinite(Number(payload?.temperatureC))
          ? Number(payload.temperatureC)
          : null,
        updatedAt,
        error: null,
      };

      this.state.distances = {
        source: payload?.source || "Orion Live Feed",
        status: "live",
        earthKm,
        moonKm,
        signalDelayS: Number.isFinite(Number(payload?.signalDelayS))
          ? Number(payload.signalDelayS)
          : null,
        updatedAt,
        error: null,
      };
    } catch (error) {
      const prevVehicle = this.state.vehicle;
      const prevDistances = this.state.distances;
      this.state.vehicle = {
        ...prevVehicle,
        status: Number.isFinite(prevVehicle.speedKmH) ? "stale" : "error",
        error: error?.message || "Erreur telemetrie Orion",
      };
      this.state.distances = {
        ...prevDistances,
        status: Number.isFinite(prevDistances.earthKm) ? "stale" : "error",
        error: error?.message || "Erreur telemetrie Orion",
      };
    }
  }

  formatMissionLabel(elapsedMs) {
    const sign = elapsedMs >= 0 ? "+" : "-";
    const abs = Math.abs(elapsedMs);
    const days = Math.floor(abs / 86400000);
    const hours = Math.floor((abs % 86400000) / 3600000);
    const mins = Math.floor((abs % 3600000) / 60000);
    const hh = String(hours).padStart(2, "0");
    const mm = String(mins).padStart(2, "0");
    return `J${sign}${days} ${hh}h${mm}`;
  }

  async refreshSpaceWeather() {
    try {
      const response = await fetch(
        "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json",
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const kpIndex = this.extractLatestKp(payload);
      if (!Number.isFinite(kpIndex)) {
        throw new Error("Kp index indisponible");
      }

      this.state.spaceWeather = {
        source: "NOAA SWPC",
        status: "live",
        kpIndex,
        radiationMsVh: this.mapKpToRadiation(kpIndex),
        updatedAt: Date.now(),
        error: null,
      };
    } catch (error) {
      const previous = this.state.spaceWeather;
      this.state.spaceWeather = {
        ...previous,
        status: previous.radiationMsVh ? "stale" : "error",
        error: error?.message || "Erreur inconnue",
      };
    }
  }

  extractLatestKp(payload) {
    if (!Array.isArray(payload) || payload.length < 2) return null;

    for (let i = payload.length - 1; i >= 1; i -= 1) {
      const row = payload[i];
      if (Array.isArray(row)) {
        const kp = parseFloat(row[1]);
        if (Number.isFinite(kp)) return kp;
      } else if (row && typeof row === "object") {
        const kp = parseFloat(row.kp_index ?? row.Kp);
        if (Number.isFinite(kp)) return kp;
      }
    }

    return null;
  }

  mapKpToRadiation(kpIndex) {
    // Approximation pedagogique: map Kp (0-9) vers une dose externe plausible.
    const base = 0.03;
    const surge = Math.pow(Math.max(0, kpIndex), 1.35) * 0.06;
    return Math.min(2.5, base + surge);
  }
}




