/**
 * Real-time public data around the KG-D6 block (all free, keyless, CORS-enabled):
 *
 *   USD/INR      European Central Bank reference rates via api.frankfurter.dev (daily, plus history)
 *   Tide         Open-Meteo marine: sea level height vs mean sea level at the block (hourly)
 *   Earthquakes  USGS FDSN event service: M2.5+ within 1,000 km, last 30 days
 *
 * Plant sensor data (pressures, flows) is not public, so production stays on the
 * published quarterly figures; these feeds cover everything that IS live.
 */
import { useSyncExternalStore } from 'react';

const LAT = 16.3;
const LON = 82.33;
const QUAKE_RADIUS_KM = 1000;

export type FeedState = 'loading' | 'live' | 'error';

export interface Quake {
  magnitude: number;
  place: string;
  time: number;
  distanceKm: number;
}

export interface LiveFeedStatus {
  fx: { state: FeedState; usdInr: number | null; date: string | null; history: Record<string, number> };
  tide: { state: FeedState; heightM: number | null; trend: 'rising' | 'falling' | null; todayMin: number | null; todayMax: number | null; time: string | null };
  quakes: { state: FeedState; count: number; largest: Quake | null; nearest: Quake | null; checked: number | null };
}

/** Used only until the ECB rate arrives (or if it cannot be fetched) */
export const FALLBACK_USD_INR = 86.85;

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

const getJson = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

class LiveFeedsService {
  private status: LiveFeedStatus = {
    fx: { state: 'loading', usdInr: null, date: null, history: {} },
    tide: { state: 'loading', heightM: null, trend: null, todayMin: null, todayMax: null, time: null },
    quakes: { state: 'loading', count: 0, largest: null, nearest: null, checked: null },
  };
  private listeners = new Set<() => void>();
  private timers: ReturnType<typeof setInterval>[] = [];

  public start(): void {
    if (this.timers.length) return;
    this.refreshFx();
    this.refreshTide();
    this.refreshQuakes();
    this.timers.push(setInterval(() => this.refreshFx(), 60 * 60 * 1000));
    this.timers.push(setInterval(() => this.refreshTide(), 10 * 60 * 1000));
    this.timers.push(setInterval(() => this.refreshQuakes(), 15 * 60 * 1000));
  }

  public stop(): void {
    this.timers.forEach(clearInterval);
    this.timers = [];
  }

  private set(patch: Partial<LiveFeedStatus>): void {
    this.status = { ...this.status, ...patch };
    this.listeners.forEach((l) => l());
  }

  /** ECB USD/INR: latest plus the last 200 days (for the ledger's daily INR values) */
  public async refreshFx(): Promise<void> {
    try {
      const end = new Date();
      const start = new Date(end.getTime() - 200 * 86400000);
      const day = (d: Date) => d.toISOString().slice(0, 10);
      const [latest, series] = await Promise.all([
        getJson('https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR'),
        getJson(`https://api.frankfurter.dev/v1/${day(start)}..${day(end)}?base=USD&symbols=INR`),
      ]);
      const history: Record<string, number> = {};
      for (const [d, r] of Object.entries(series.rates as Record<string, { INR: number }>)) history[d] = r.INR;
      this.set({ fx: { state: 'live', usdInr: latest.rates.INR, date: latest.date, history } });
    } catch {
      this.set({ fx: { ...this.status.fx, state: 'error' } });
    }
  }

  public async refreshTide(): Promise<void> {
    try {
      const j = await getJson(
        `https://marine-api.open-meteo.com/v1/marine?latitude=${LAT}&longitude=${LON}&current=sea_level_height_msl&hourly=sea_level_height_msl&forecast_days=1`
      );
      const now = j.current.sea_level_height_msl as number;
      const times = (j.hourly.time as string[]).map((t) => Date.parse(t + 'Z'));
      const series = j.hourly.sea_level_height_msl as number[];
      // Trend from the next hourly value after now
      const i = times.findIndex((t) => t > Date.now());
      const next = i >= 0 ? series[i] : now;
      this.set({
        tide: {
          state: 'live',
          heightM: now,
          trend: next >= now ? 'rising' : 'falling',
          todayMin: Math.min(...series),
          todayMax: Math.max(...series),
          time: j.current.time,
        },
      });
    } catch {
      this.set({ tide: { ...this.status.tide, state: 'error' } });
    }
  }

  public async refreshQuakes(): Promise<void> {
    try {
      const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const j = await getJson(
        `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${LAT}&longitude=${LON}&maxradiuskm=${QUAKE_RADIUS_KM}&minmagnitude=2.5&starttime=${since}`
      );
      const quakes: Quake[] = (j.features as { properties: { mag: number; place: string; time: number }; geometry: { coordinates: number[] } }[]).map((f) => ({
        magnitude: f.properties.mag,
        place: f.properties.place,
        time: f.properties.time,
        distanceKm: haversineKm(LAT, LON, f.geometry.coordinates[1], f.geometry.coordinates[0]),
      }));
      const by = (cmp: (a: Quake, b: Quake) => number) => (quakes.length ? [...quakes].sort(cmp)[0] : null);
      this.set({
        quakes: {
          state: 'live',
          count: quakes.length,
          largest: by((a, b) => b.magnitude - a.magnitude),
          nearest: by((a, b) => a.distanceKm - b.distanceKm),
          checked: Date.now(),
        },
      });
    } catch {
      this.set({ quakes: { ...this.status.quakes, state: 'error' } });
    }
  }

  /** Live ECB rate, the rate on a given day (latest fixing on or before it), or the fallback */
  public usdInr(date?: string): number {
    const { usdInr, history } = this.status.fx;
    if (date) {
      const days = Object.keys(history).filter((d) => d <= date).sort();
      if (days.length) return history[days[days.length - 1]];
    }
    return usdInr ?? FALLBACK_USD_INR;
  }

  public getStatus = (): LiveFeedStatus => this.status;
  public subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
}

export const liveFeeds = new LiveFeedsService();
export const useLiveFeeds = () => useSyncExternalStore(liveFeeds.subscribe, liveFeeds.getStatus);
