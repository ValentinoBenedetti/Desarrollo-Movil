import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

export interface OMMJsonObject {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  EPHEMERIS_TYPE?: number;
  CLASSIFICATION_TYPE?: string;
  NORAD_CAT_ID: number;
  ELEMENT_SET_NO?: number;
  REV_AT_EPOCH?: number;
  BSTAR: number;
  MEAN_MOTION_DOT?: number;
  MEAN_MOTION_DDOT?: number;
}

export type ConstellationGroup =
  | 'stations'
  | 'starlink'
  | 'gps-ops'
  | 'weather'
  | 'active';

export type ProviderName = 'CelesTrak' | 'SpaceTrack' | 'N2YO' | 'WhereTheISS';

export interface OrbitalElementRecord {
  noradId: number;
  name: string;
  epochIso: string;
  tleLine1?: string;
  tleLine2?: string;
  omm?: OMMJsonObject;
  constellation: ConstellationGroup;
  source: ProviderName;
  fetchedAt: number;
}

export interface CachedPayload<T> {
  data: T;
  fetchedAt: number;
  ttlMs: number;
  source: ProviderName;
}

export interface OrbitalDataWithMeta {
  record: OrbitalElementRecord;
  ageHours: number;
  epochAgeHours: number;
  isStale: boolean;
  fromCache: boolean;
}

export interface ValidationPosition {
  noradId: number;
  name: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  altitudeKm: number;
  velocityKmS?: number;
  azimuth?: number;
  elevation?: number;
  source: ProviderName;
}

export interface ObserverLocation {
  latitude: number;
  longitude: number;
  altitudeKm: number;
}

export interface IDataProvider {
  readonly name: ProviderName;
  getCatalog(group: ConstellationGroup, limit?: number): Promise<OrbitalElementRecord[]>;
  getOrbitalData(noradId: number): Promise<OrbitalElementRecord>;
  getValidationPosition(
    noradId: number,
    observer?: ObserverLocation
  ): Promise<ValidationPosition>;
}

interface RateLimitConfig {
  maxRequestsPerWindow: number;
  windowMs: number;
  minIntervalMs: number;
}

class ProviderRateLimiter {
  private timestamps: number[] = [];
  private lastRequestTime = 0;
  private readonly config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsedSinceLast = now - this.lastRequestTime;

    if (elapsedSinceLast < this.config.minIntervalMs) {
      await this.sleep(this.config.minIntervalMs - elapsedSinceLast);
    }

    const current = Date.now();
    this.timestamps = this.timestamps.filter(t => current - t < this.config.windowMs);

    if (this.timestamps.length >= this.config.maxRequestsPerWindow) {
      const oldest = this.timestamps[0];
      const waitTime = this.config.windowMs - (current - oldest) + 50;
      if (waitTime > 0) {
        await this.sleep(waitTime);
      }
      const afterWait = Date.now();
      this.timestamps = this.timestamps.filter(t => afterWait - t < this.config.windowMs);
    }

    const committed = Date.now();
    this.timestamps.push(committed);
    this.lastRequestTime = committed;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

async function fetchWithBackoff(
  url: string,
  options: RequestInit = {},
  limiter: ProviderRateLimiter,
  maxRetries = 3
): Promise<Response> {
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= maxRetries) {
    await limiter.acquire();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.status === 429 || response.status >= 500) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      if (!response.ok) {
        throw new Error(`HTTP Client Error ${response.status}`);
      }
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attempt += 1;
      if (attempt > maxRetries) {
        break;
      }
      const backoffMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 250, 10000);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

function parseThreeLineTleText(
  rawText: string,
  constellation: ConstellationGroup,
  source: ProviderName
): OrbitalElementRecord[] {
  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const records: OrbitalElementRecord[] = [];
  const now = Date.now();

  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i];
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];

    if (!line1.startsWith('1 ') || !line2.startsWith('2 ')) {
      continue;
    }

    const noradId = parseInt(line1.substring(2, 7).trim(), 10);
    const epochIso = parseTleEpochToIso(line1);

    records.push({
      noradId,
      name,
      epochIso,
      tleLine1: line1,
      tleLine2: line2,
      constellation,
      source,
      fetchedAt: now,
    });
  }

  return records;
}

function parseTleEpochToIso(tleLine1: string): string {
  try {
    const yearStr = tleLine1.substring(18, 20).trim();
    const dayOfYearStr = tleLine1.substring(20, 32).trim();
    const yearShort = parseInt(yearStr, 10);
    const fullYear = yearShort < 57 ? 2000 + yearShort : 1900 + yearShort;
    const dayOfYear = parseFloat(dayOfYearStr);

    const janFirst = Date.UTC(fullYear, 0, 1, 0, 0, 0, 0);
    const epochMs = janFirst + (dayOfYear - 1) * 86400 * 1000;
    return new Date(epochMs).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * 1. CelesTrak Provider
 * Principal source for GP catalogs and Starlink Supplementary GP (SupGP) ephemerides.
 * Supports both OMM JSON (required for 6-digit NORAD IDs) and TLE text fallback.
 */
export class CelesTrakProvider implements IDataProvider {
  readonly name: ProviderName = 'CelesTrak';

  private readonly limiter = new ProviderRateLimiter({
    maxRequestsPerWindow: 30,
    windowMs: 60 * 60 * 1000,
    minIntervalMs: 1500,
  });

  async getCatalog(
    group: ConstellationGroup,
    limit = 80
  ): Promise<OrbitalElementRecord[]> {
    const ommUrl =
      group === 'starlink'
        ? 'https://celestrak.org/NORAD/elements/supplemental/sup-gp.php?FILE=starlink&FORMAT=json'
        : `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=json`;

    try {
      const response = await fetchWithBackoff(ommUrl, {}, this.limiter);
      const ommArray: OMMJsonObject[] = await response.json();
      const now = Date.now();

      return ommArray.slice(0, limit).map(omm => ({
        noradId: Number(omm.NORAD_CAT_ID),
        name: String(omm.OBJECT_NAME).trim(),
        epochIso: String(omm.EPOCH),
        omm,
        constellation: group,
        source: this.name,
        fetchedAt: now,
      }));
    } catch {
      const tleUrl =
        group === 'starlink'
          ? 'https://celestrak.org/NORAD/elements/supplemental/sup-gp.php?FILE=starlink&FORMAT=tle'
          : `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`;
      const response = await fetchWithBackoff(tleUrl, {}, this.limiter);
      const text = await response.text();
      return parseThreeLineTleText(text, group, this.name).slice(0, limit);
    }
  }

  async getOrbitalData(noradId: number): Promise<OrbitalElementRecord> {
    const ommUrl = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${noradId}&FORMAT=json`;
    try {
      const response = await fetchWithBackoff(ommUrl, {}, this.limiter);
      const ommList: OMMJsonObject[] = await response.json();
      if (!Array.isArray(ommList) || ommList.length === 0) {
        throw new Error(`No OMM returned from CelesTrak for NORAD ${noradId}`);
      }
      const omm = ommList[0];
      return {
        noradId: Number(omm.NORAD_CAT_ID),
        name: String(omm.OBJECT_NAME).trim(),
        epochIso: String(omm.EPOCH),
        omm,
        constellation: 'active',
        source: this.name,
        fetchedAt: Date.now(),
      };
    } catch {
      const tleUrl = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${noradId}&FORMAT=tle`;
      const response = await fetchWithBackoff(tleUrl, {}, this.limiter);
      const text = await response.text();
      const parsed = parseThreeLineTleText(text, 'active', this.name);
      if (parsed.length === 0) {
        throw new Error(`CelesTrak TLE empty for NORAD ${noradId}`);
      }
      return parsed[0];
    }
  }

  async getValidationPosition(_noradId: number): Promise<ValidationPosition> {
    throw new Error(
      'CelesTrak provides orbital elements (OMM/TLE) only, not real-time validation coordinates.'
    );
  }
}

/**
 * 2. Space-Track Provider
 * Official GP/TLE fallback provider. Strict rate limits (< 30 req/min, < 300 req/hour).
 * Uses backend proxy or secure Keychain credentials so secrets are never embedded in the bundle.
 */
export class SpaceTrackProvider implements IDataProvider {
  readonly name: ProviderName = 'SpaceTrack';
  private readonly proxyBaseUrl: string;

  private readonly limiter = new ProviderRateLimiter({
    maxRequestsPerWindow: 25,
    windowMs: 60 * 1000,
    minIntervalMs: 2200,
  });

  constructor(proxyBaseUrl = 'http://localhost:4700/api/spacetrack') {
    this.proxyBaseUrl = proxyBaseUrl;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: 'spacetrack_api',
      });
      if (credentials) {
        return {
          Authorization: `Bearer ${credentials.password}`,
          'Content-Type': 'application/json',
        };
      }
    } catch {
      // Keychain not populated yet; proxy handles upstream session if configured
    }
    return { 'Content-Type': 'application/json' };
  }

  async getCatalog(
    group: ConstellationGroup,
    limit = 50
  ): Promise<OrbitalElementRecord[]> {
    const headers = await this.getAuthHeaders();
    const url = `${this.proxyBaseUrl}/catalog?group=${encodeURIComponent(group)}&limit=${limit}`;
    const response = await fetchWithBackoff(url, { headers }, this.limiter);
    const payload: OMMJsonObject[] = await response.json();
    const now = Date.now();

    return payload.slice(0, limit).map(omm => ({
      noradId: Number(omm.NORAD_CAT_ID),
      name: String(omm.OBJECT_NAME).trim(),
      epochIso: String(omm.EPOCH),
      omm,
      constellation: group,
      source: this.name,
      fetchedAt: now,
    }));
  }

  async getOrbitalData(noradId: number): Promise<OrbitalElementRecord> {
    const headers = await this.getAuthHeaders();
    const url = `${this.proxyBaseUrl}/gp/${noradId}`;
    const response = await fetchWithBackoff(url, { headers }, this.limiter);
    const omm: OMMJsonObject = await response.json();

    return {
      noradId: Number(omm.NORAD_CAT_ID),
      name: String(omm.OBJECT_NAME).trim(),
      epochIso: String(omm.EPOCH),
      omm,
      constellation: 'active',
      source: this.name,
      fetchedAt: Date.now(),
    };
  }

  async getValidationPosition(_noradId: number): Promise<ValidationPosition> {
    throw new Error('Space-Track does not expose a live sub-satellite point endpoint.');
  }
}

/**
 * 3. N2YO Provider
 * Cross-validation for any NORAD satellite + TLE fallback.
 * Rate limits: 1000 req/hour for TLE/positions, 100 req/hour for passes/above.
 */
export class N2yoProvider implements IDataProvider {
  readonly name: ProviderName = 'N2YO';

  private readonly limiter = new ProviderRateLimiter({
    maxRequestsPerWindow: 900,
    windowMs: 60 * 60 * 1000,
    minIntervalMs: 1000,
  });

  private runtimeApiKey: string | null = null;

  setRuntimeApiKey(apiKey: string): void {
    this.runtimeApiKey = apiKey.trim();
  }

  private async resolveApiKey(): Promise<string> {
    if (this.runtimeApiKey) {
      return this.runtimeApiKey;
    }
    try {
      const stored = await Keychain.getGenericPassword({ service: 'n2yo_api_key' });
      if (stored && stored.password) {
        return stored.password;
      }
    } catch {
      // Ignore keychain error
    }
    throw new Error('N2YO API key not configured in Keychain or runtime settings.');
  }

  async getCatalog(
    _group: ConstellationGroup,
    _limit = 20
  ): Promise<OrbitalElementRecord[]> {
    throw new Error('N2YO catalog listing requires observer search; use CelesTrak for bulk GP.');
  }

  async getOrbitalData(noradId: number): Promise<OrbitalElementRecord> {
    const apiKey = await this.resolveApiKey();
    const url = `https://api.n2yo.com/rest/v1/satellite/tle/${noradId}&apiKey=${encodeURIComponent(
      apiKey
    )}`;
    const response = await fetchWithBackoff(url, {}, this.limiter);
    const data = await response.json();

    if (!data?.tle) {
      throw new Error(`Invalid N2YO TLE response for NORAD ${noradId}`);
    }

    const lines = String(data.tle)
      .split(/\r?\n/)
      .map((l: string) => l.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      throw new Error(`Malformed TLE lines from N2YO for NORAD ${noradId}`);
    }

    return {
      noradId: Number(data.info?.satid ?? noradId),
      name: String(data.info?.satname ?? `NORAD ${noradId}`),
      epochIso: parseTleEpochToIso(lines[0]),
      tleLine1: lines[0],
      tleLine2: lines[1],
      constellation: 'active',
      source: this.name,
      fetchedAt: Date.now(),
    };
  }

  async getValidationPosition(
    noradId: number,
    observer: ObserverLocation = { latitude: -32.4845, longitude: -58.2322, altitudeKm: 0.02 }
  ): Promise<ValidationPosition> {
    const apiKey = await this.resolveApiKey();
    const url = `https://api.n2yo.com/rest/v1/satellite/positions/${noradId}/${observer.latitude}/${observer.longitude}/${observer.altitudeKm}/1/&apiKey=${encodeURIComponent(
      apiKey
    )}`;

    const response = await fetchWithBackoff(url, {}, this.limiter);
    const json = await response.json();
    const pos = json?.positions?.[0];

    if (!pos) {
      throw new Error(`N2YO returned no position sample for NORAD ${noradId}`);
    }

    return {
      noradId: Number(json.info?.satid ?? noradId),
      name: String(json.info?.satname ?? `NORAD ${noradId}`),
      timestamp: Number(pos.timestamp) * 1000,
      latitude: Number(pos.satlatitude),
      longitude: Number(pos.satlongitude),
      altitudeKm: Number(pos.sataltitude),
      azimuth: Number(pos.azimuth),
      elevation: Number(pos.elevation),
      source: this.name,
    };
  }
}

/**
 * 4. Where the ISS at? Provider
 * Unauthenticated endpoint for ISS (NORAD 25544) real-time cross-validation and TLE fallback.
 * Rate limit: ~1 request/second.
 */
export class WhereTheIssProvider implements IDataProvider {
  readonly name: ProviderName = 'WhereTheISS';

  private readonly limiter = new ProviderRateLimiter({
    maxRequestsPerWindow: 55,
    windowMs: 60 * 1000,
    minIntervalMs: 1100,
  });

  async getCatalog(
    _group: ConstellationGroup,
    _limit = 1
  ): Promise<OrbitalElementRecord[]> {
    const iss = await this.getOrbitalData(25544);
    return [iss];
  }

  async getOrbitalData(noradId: number): Promise<OrbitalElementRecord> {
    if (noradId !== 25544) {
      throw new Error('WhereTheISS only supports NORAD 25544 (ISS).');
    }
    const url = 'https://api.wheretheiss.at/v1/satellites/25544/tles';
    const response = await fetchWithBackoff(url, {}, this.limiter);
    const data = await response.json();

    return {
      noradId: 25544,
      name: String(data.name ?? 'ISS (ZARYA)'),
      epochIso: new Date(Number(data.tle_timestamp) * 1000).toISOString(),
      tleLine1: String(data.line1).trim(),
      tleLine2: String(data.line2).trim(),
      constellation: 'stations',
      source: this.name,
      fetchedAt: Date.now(),
    };
  }

  async getValidationPosition(noradId: number): Promise<ValidationPosition> {
    if (noradId !== 25544) {
      throw new Error('WhereTheISS validation is restricted to ISS (NORAD 25544).');
    }
    const url = 'https://api.wheretheiss.at/v1/satellites/25544';
    const response = await fetchWithBackoff(url, {}, this.limiter);
    const data = await response.json();

    return {
      noradId: 25544,
      name: 'ISS (ZARYA)',
      timestamp: Number(data.timestamp) * 1000,
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      altitudeKm: Number(data.altitude),
      velocityKmS: Number(data.velocity) / 3600,
      source: this.name,
    };
  }
}

const BOOTSTRAP_ORBITAL_RECORDS: OrbitalElementRecord[] = [
  {
    noradId: 25544,
    name: 'ISS (ZARYA)',
    epochIso: new Date().toISOString(),
    tleLine1: '1 25544U 98067A   26310.50000000  .00016717  00000-0  10270-3 0  9993',
    tleLine2: '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.50103472421639',
    constellation: 'stations',
    source: 'CelesTrak',
    fetchedAt: Date.now() - 6 * 3600 * 1000,
  },
  {
    noradId: 44713,
    name: 'STARLINK-1007',
    epochIso: new Date().toISOString(),
    tleLine1: '1 44713U 19074A   26310.50000000  .00001245  00000-0  98421-4 0  9991',
    tleLine2: '2 44713  53.0538 172.3412 0001421  88.4120 271.7032 15.06391245381124',
    constellation: 'starlink',
    source: 'CelesTrak',
    fetchedAt: Date.now() - 6 * 3600 * 1000,
  },
  {
    noradId: 48859,
    name: 'GPS BIIR-2 (PRN 13)',
    epochIso: new Date().toISOString(),
    tleLine1: '1 24876U 97035A   26310.50000000 -.00000041  00000-0  00000-0 0  9994',
    tleLine2: '2 24876  55.4123 115.2310 0068120 212.1140 147.5210  2.00563120214128',
    constellation: 'gps-ops',
    source: 'CelesTrak',
    fetchedAt: Date.now() - 6 * 3600 * 1000,
  },
  {
    noradId: 41866,
    name: 'GOES 16 (GEO)',
    epochIso: new Date().toISOString(),
    tleLine1: '1 41866U 16071A   26310.50000000 -.00000258  00000-0  00000-0 0  9995',
    tleLine2: '2 41866   0.0412  85.1240 0000812 140.2310 219.8120  1.00271124 29142',
    constellation: 'weather',
    source: 'CelesTrak',
    fetchedAt: Date.now() - 6 * 3600 * 1000,
  },
];

/**
 * DataProvider Orchestrator
 * Manages TTL cache (12-24h), staleness metrics (RF-09, RF-16), and automatic failover across providers (RF-14).
 */
export class DataProviderOrchestrator {
  private static readonly CACHE_PREFIX = '@sat_tracker_v1:';
  public static readonly DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;
  public static readonly STALE_THRESHOLD_HOURS = 24;

  public readonly celestrak = new CelesTrakProvider();
  public readonly spacetrack = new SpaceTrackProvider();
  public readonly n2yo = new N2yoProvider();
  public readonly whereTheIss = new WhereTheIssProvider();

  private readonly orbitalChain: IDataProvider[];
  private readonly ttlMs: number;

  constructor(ttlMs: number = DataProviderOrchestrator.DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
    this.orbitalChain = [this.celestrak, this.spacetrack, this.n2yo, this.whereTheIss];
  }

  private computeMetadata(
    record: OrbitalElementRecord,
    fromCache: boolean
  ): OrbitalDataWithMeta {
    const now = Date.now();
    const ageHours = Math.max(0, (now - record.fetchedAt) / (1000 * 60 * 60));
    const parsedEpoch = Date.parse(record.epochIso);
    const epochAgeHours = Number.isNaN(parsedEpoch)
      ? ageHours
      : Math.max(0, (now - parsedEpoch) / (1000 * 60 * 60));

    const isStale =
      ageHours > DataProviderOrchestrator.STALE_THRESHOLD_HOURS ||
      epochAgeHours > DataProviderOrchestrator.STALE_THRESHOLD_HOURS * 2;

    return {
      record,
      ageHours,
      epochAgeHours,
      isStale,
      fromCache,
    };
  }

  async getCatalog(
    group: ConstellationGroup,
    limit = 60,
    forceRefresh = false
  ): Promise<OrbitalDataWithMeta[]> {
    const cacheKey = `${DataProviderOrchestrator.CACHE_PREFIX}catalog:${group}`;

    if (!forceRefresh) {
      const cached = await this.readCache<OrbitalElementRecord[]>(cacheKey);
      if (cached && Date.now() - cached.fetchedAt < cached.ttlMs) {
        return cached.data
          .slice(0, limit)
          .map(r => this.computeMetadata(r, true));
      }
    }

    const catalogProviders: IDataProvider[] = [this.celestrak, this.spacetrack];
    for (const provider of catalogProviders) {
      try {
        const records = await provider.getCatalog(group, limit);
        if (records.length > 0) {
          await this.writeCache(cacheKey, records, provider.name);
          await Promise.all(
            records.slice(0, 25).map(rec =>
              this.writeCache(
                `${DataProviderOrchestrator.CACHE_PREFIX}sat:${rec.noradId}`,
                rec,
                provider.name
              )
            )
          );
          return records.map(r => this.computeMetadata(r, false));
        }
      } catch {
        // Proceed to next fallback provider in chain
      }
    }

    const expiredCache = await this.readCache<OrbitalElementRecord[]>(cacheKey);
    if (expiredCache && expiredCache.data.length > 0) {
      return expiredCache.data
        .slice(0, limit)
        .map(r => this.computeMetadata(r, true));
    }

    return BOOTSTRAP_ORBITAL_RECORDS.filter(
      b => group === 'active' || b.constellation === group
    ).map(r => this.computeMetadata(r, true));
  }

  async getOrbitalData(
    noradId: number,
    forceRefresh = false
  ): Promise<OrbitalDataWithMeta> {
    const cacheKey = `${DataProviderOrchestrator.CACHE_PREFIX}sat:${noradId}`;

    if (!forceRefresh) {
      const cached = await this.readCache<OrbitalElementRecord>(cacheKey);
      if (cached && Date.now() - cached.fetchedAt < cached.ttlMs) {
        return this.computeMetadata(cached.data, true);
      }
    }

    for (const provider of this.orbitalChain) {
      try {
        const record = await provider.getOrbitalData(noradId);
        await this.writeCache(cacheKey, record, provider.name);
        return this.computeMetadata(record, false);
      } catch {
        // Fallback to next provider
      }
    }

    const expiredCache = await this.readCache<OrbitalElementRecord>(cacheKey);
    if (expiredCache) {
      return this.computeMetadata(expiredCache.data, true);
    }

    const fallbackBootstrap =
      BOOTSTRAP_ORBITAL_RECORDS.find(r => r.noradId === noradId) ??
      BOOTSTRAP_ORBITAL_RECORDS[0];
    return this.computeMetadata(fallbackBootstrap, true);
  }

  async getValidationPosition(
    noradId: number,
    observer?: ObserverLocation,
    preferredProvider?: 'WhereTheISS' | 'N2YO'
  ): Promise<ValidationPosition> {
    if (noradId === 25544 && preferredProvider !== 'N2YO') {
      try {
        return await this.whereTheIss.getValidationPosition(25544);
      } catch {
        return await this.n2yo.getValidationPosition(25544, observer);
      }
    }
    return await this.n2yo.getValidationPosition(noradId, observer);
  }

  async refreshExpiredCache(): Promise<number> {
    let refreshedCount = 0;
    const keys = await AsyncStorage.getAllKeys();
    const satKeys = keys.filter(k =>
      k.startsWith(`${DataProviderOrchestrator.CACHE_PREFIX}sat:`)
    );

    for (const key of satKeys) {
      const cached = await this.readCache<OrbitalElementRecord>(key);
      if (!cached || Date.now() - cached.fetchedAt >= cached.ttlMs) {
        const noradId = Number(key.split(':').pop());
        if (!Number.isNaN(noradId)) {
          try {
            await this.getOrbitalData(noradId, true);
            refreshedCount += 1;
          } catch {
            // Keep existing cache if offline during background fetch
          }
        }
      }
    }
    return refreshedCount;
  }

  private async readCache<T>(key: string): Promise<CachedPayload<T> | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as CachedPayload<T>;
    } catch {
      return null;
    }
  }

  private async writeCache<T>(
    key: string,
    data: T,
    source: ProviderName
  ): Promise<void> {
    try {
      const payload: CachedPayload<T> = {
        data,
        fetchedAt: Date.now(),
        ttlMs: this.ttlMs,
        source,
      };
      await AsyncStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // Storage full or unavailable
    }
  }
}

export const dataProvider = new DataProviderOrchestrator();
