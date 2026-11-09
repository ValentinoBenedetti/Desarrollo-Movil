import * as satellite from 'satellite.js';
import type {
  ObserverLocation,
  OMMJsonObject,
  OrbitalElementRecord,
} from '../services/DataProvider';

export interface GeoCoordinate {
  latitude: number;
  longitude: number;
}

export interface PropagatedState {
  noradId: number;
  name: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  altitudeKm: number;
  velocityKmS: number;
  azimuthDeg: number;
  elevationDeg: number;
  rangeKm: number;
  dopplerFactor: number;
  orbitalPeriodMin: number;
  orbitRegime: 'LEO' | 'MEO' | 'GEO' | 'HEO';
  eciPositionKm: { x: number; y: number; z: number };
}

export interface SkyTrackPoint {
  timestamp: number;
  azimuthDeg: number;
  elevationDeg: number;
  rangeKm: number;
}

export interface PassWindow {
  noradId: number;
  satelliteName: string;
  aosTime: number;
  aosAzimuthDeg: number;
  maxTime: number;
  maxElevationDeg: number;
  maxAzimuthDeg: number;
  losTime: number;
  losAzimuthDeg: number;
  durationSec: number;
  skyTrack: SkyTrackPoint[];
}

export interface ValidationErrorMetrics {
  groundDistanceErrorKm: number;
  spatial3DErrorKm: number;
  altitudeDeltaKm: number;
  latitudeDeltaDeg: number;
  longitudeDeltaDeg: number;
}

const EARTH_RADIUS_KM = 6371.0088;
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Formats a floating point value into TLE exponential notation (e.g., BSTAR 0.0001027 -> " 10270-3").
 */
function formatTleExponential(val: number): string {
  if (val === 0 || !Number.isFinite(val)) {
    return ' 00000-0';
  }
  const sign = val < 0 ? '-' : ' ';
  const abs = Math.abs(val);
  const exp = Math.floor(Math.log10(abs)) + 1;
  const mantissa = Math.round((abs / Math.pow(10, exp)) * 100000);
  const mantissaStr = String(mantissa).padStart(5, '0').slice(0, 5);
  const expSign = exp >= 0 ? '+' : '-';
  return `${sign}${mantissaStr}${expSign}${Math.abs(exp)}`;
}

/**
 * Synthesizes standard 2-line TLE strings from an OMM JSON object (including 6-digit NORAD IDs via Alpha-5 or modulo).
 */
function ommToTleLines(omm: OMMJsonObject): [string, string] {
  const epochDate = new Date(
    omm.EPOCH.endsWith('Z') ? omm.EPOCH : `${omm.EPOCH}Z`
  );
  const fullYear = epochDate.getUTCFullYear();
  const yy = String(fullYear % 100).padStart(2, '0');
  const startOfYear = Date.UTC(fullYear, 0, 1, 0, 0, 0, 0);
  const dayOfYear = (epochDate.getTime() - startOfYear) / 86400000 + 1;
  const ddd = dayOfYear.toFixed(8).padStart(12, '0');

  const rawCat = Number(omm.NORAD_CAT_ID) || 99999;
  const catStr = String(rawCat % 100000).padStart(5, '0');
  const bstarStr = formatTleExponential(Number(omm.BSTAR ?? 0));

  const inc = Number(omm.INCLINATION).toFixed(4).padStart(8, ' ');
  const raan = Number(omm.RA_OF_ASC_NODE).toFixed(4).padStart(8, ' ');
  const ecc = Math.round(Number(omm.ECCENTRICITY) * 1e7)
    .toString()
    .padStart(7, '0')
    .slice(0, 7);
  const argp = Number(omm.ARG_OF_PERICENTER).toFixed(4).padStart(8, ' ');
  const ma = Number(omm.MEAN_ANOMALY).toFixed(4).padStart(8, ' ');
  const mm = Number(omm.MEAN_MOTION).toFixed(8).padStart(11, ' ');
  const rev = String((Number(omm.REV_AT_EPOCH) || 1) % 100000).padStart(5, ' ');

  const line1 = `1 ${catStr}U 20001A   ${yy}${ddd}  .00000000  00000-0 ${bstarStr} 0  9990`;
  const line2 = `2 ${catStr} ${inc} ${raan} ${ecc} ${argp} ${ma} ${mm}${rev}0`;
  return [line1, line2];
}

export class OrbitalEngine {
  private static satrecCache = new Map<string, satellite.SatRec>();

  /**
   * Parses either OMM JSON (including 6-digit NORAD catalog objects) or 2-line TLE into a satellite.js SatRec.
   */
  static getSatRec(record: OrbitalElementRecord): satellite.SatRec {
    const cacheKey = `${record.noradId}:${record.epochIso}`;
    const existing = this.satrecCache.get(cacheKey);
    if (existing) {
      return existing;
    }

    let satrec: satellite.SatRec;
    const satAny = satellite as unknown as {
      json2satrec?: (omm: OMMJsonObject) => satellite.SatRec;
    };

    if (record.omm && typeof satAny.json2satrec === 'function') {
      satrec = satAny.json2satrec(record.omm);
    } else if (record.omm) {
      const [l1, l2] = ommToTleLines(record.omm);
      satrec = satellite.twoline2satrec(l1, l2);
    } else if (record.tleLine1 && record.tleLine2) {
      satrec = satellite.twoline2satrec(record.tleLine1, record.tleLine2);
    } else {
      throw new Error(`OrbitalElementRecord ${record.noradId} lacks valid OMM or TLE data.`);
    }

    if (this.satrecCache.size > 500) {
      this.satrecCache.clear();
    }
    this.satrecCache.set(cacheKey, satrec);
    return satrec;
  }

  /**
   * Propagates a single satellite at a specific Date using SGP4/SDP4.
   * Computes geodetic coordinates (lat/lon/alt) and observer topocentric look angles (az/el/range).
   */
  static propagateAt(
    record: OrbitalElementRecord,
    date: Date,
    observer: ObserverLocation
  ): PropagatedState | null {
    const satrec = this.getSatRec(record);
    const positionAndVelocity = satellite.propagate(satrec, date);

    if (
      !positionAndVelocity ||
      typeof positionAndVelocity.position === 'boolean' ||
      !positionAndVelocity.position ||
      typeof positionAndVelocity.velocity === 'boolean' ||
      !positionAndVelocity.velocity
    ) {
      return null;
    }

    const posEci = positionAndVelocity.position;
    const velEci = positionAndVelocity.velocity;

    const gmst = satellite.gstime(date);
    const geodetic = satellite.eciToGeodetic(posEci, gmst);

    const latitude = satellite.degreesLat(geodetic.latitude);
    const longitude = satellite.degreesLong(geodetic.longitude);
    const altitudeKm = geodetic.height;

    const velocityKmS = Math.sqrt(
      velEci.x * velEci.x + velEci.y * velEci.y + velEci.z * velEci.z
    );

    const observerGd: satellite.GeodeticLocation = {
      longitude: satellite.degreesToRadians(observer.longitude),
      latitude: satellite.degreesToRadians(observer.latitude),
      height: observer.altitudeKm,
    };

    const posEcf = satellite.eciToEcf(posEci, gmst);
    const lookAngles = satellite.ecfToLookAngles(observerGd, posEcf);

    const azimuthDeg = (lookAngles.azimuth * RAD2DEG + 360) % 360;
    const elevationDeg = lookAngles.elevation * RAD2DEG;
    const rangeKm = lookAngles.rangeSat;

    const orbitalPeriodMin =
      satrec.no > 0 ? (2 * Math.PI) / satrec.no : 95;

    let orbitRegime: 'LEO' | 'MEO' | 'GEO' | 'HEO' = 'LEO';
    if (altitudeKm > 34000 && altitudeKm < 37500) {
      orbitRegime = 'GEO';
    } else if (altitudeKm >= 2000) {
      orbitRegime = 'MEO';
    }

    return {
      noradId: record.noradId,
      name: record.name,
      timestamp: date.getTime(),
      latitude,
      longitude,
      altitudeKm,
      velocityKmS,
      azimuthDeg,
      elevationDeg,
      rangeKm,
      dopplerFactor: 1 - velocityKmS / 299792.458,
      orbitalPeriodMin,
      orbitRegime,
      eciPositionKm: { x: posEci.x, y: posEci.y, z: posEci.z },
    };
  }

  static propagateConstellationBatch(
    records: OrbitalElementRecord[],
    date: Date,
    observer: ObserverLocation,
    maxObjects = 60
  ): PropagatedState[] {
    const subset = records.slice(0, maxObjects);
    const results: PropagatedState[] = [];

    for (let i = 0; i < subset.length; i += 1) {
      const state = this.propagateAt(subset[i], date, observer);
      if (state) {
        results.push(state);
      }
    }
    return results;
  }

  static computeGroundTrackSegments(
    record: OrbitalElementRecord,
    centerDate: Date,
    observer: ObserverLocation,
    stepSec = 40
  ): GeoCoordinate[][] {
    const currentState = this.propagateAt(record, centerDate, observer);
    const periodMin = currentState ? currentState.orbitalPeriodMin : 95;

    const pastWindowMs = periodMin * 0.25 * 60 * 1000;
    const futureWindowMs = periodMin * 0.95 * 60 * 1000;

    const adaptiveStepSec =
      periodMin > 300 ? Math.max(300, Math.floor((periodMin * 60) / 160)) : stepSec;

    const rawPoints: GeoCoordinate[] = [];
    const startMs = centerDate.getTime() - pastWindowMs;
    const endMs = centerDate.getTime() + futureWindowMs;

    for (let t = startMs; t <= endMs; t += adaptiveStepSec * 1000) {
      const st = this.propagateAt(record, new Date(t), observer);
      if (st && Number.isFinite(st.latitude) && Number.isFinite(st.longitude)) {
        rawPoints.push({ latitude: st.latitude, longitude: st.longitude });
      }
    }

    return this.splitAntimeridianPolyline(rawPoints);
  }

  static splitAntimeridianPolyline(points: GeoCoordinate[]): GeoCoordinate[][] {
    if (points.length === 0) {
      return [];
    }

    const segments: GeoCoordinate[][] = [];
    let currentSegment: GeoCoordinate[] = [points[0]];

    for (let i = 1; i < points.length; i += 1) {
      const prev = points[i - 1];
      const curr = points[i];
      const deltaLon = curr.longitude - prev.longitude;

      if (Math.abs(deltaLon) > 180) {
        const boundaryPrev = prev.longitude >= 0 ? 180 : -180;
        const boundaryCurr = -boundaryPrev;

        const unwrappedDelta =
          deltaLon > 180 ? deltaLon - 360 : deltaLon + 360;
        const fraction =
          unwrappedDelta !== 0
            ? Math.abs((boundaryPrev - prev.longitude) / unwrappedDelta)
            : 0.5;
        const clampedFraction = Math.max(0, Math.min(1, fraction));
        const crossingLat =
          prev.latitude + (curr.latitude - prev.latitude) * clampedFraction;

        currentSegment.push({
          latitude: crossingLat,
          longitude: boundaryPrev,
        });
        segments.push(currentSegment);

        currentSegment = [
          {
            latitude: crossingLat,
            longitude: boundaryCurr,
          },
          curr,
        ];
      } else {
        currentSegment.push(curr);
      }
    }

    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }

    return segments;
  }

  static computeFootprintRadiusMeters(
    altitudeKm: number,
    minElevationDeg = 10
  ): number {
    if (altitudeKm <= 0) {
      return 0;
    }
    const epsRad = Math.max(0, minElevationDeg) * DEG2RAD;
    const ratio = (EARTH_RADIUS_KM / (EARTH_RADIUS_KM + altitudeKm)) * Math.cos(epsRad);
    const clampedRatio = Math.min(1, Math.max(-1, ratio));
    const rhoRad = Math.asin(clampedRatio);
    const centralAngleRad = Math.PI / 2 - epsRad - rhoRad;

    if (centralAngleRad <= 0) {
      return 0;
    }
    return EARTH_RADIUS_KM * centralAngleRad * 1000;
  }

  static predictVisibilityWindows(
    record: OrbitalElementRecord,
    observer: ObserverLocation,
    minElevationDeg = 10,
    lookaheadHours = 24,
    maxPasses = 6
  ): PassWindow[] {
    const passes: PassWindow[] = [];
    const startMs = Date.now();
    const endMs = startMs + lookaheadHours * 3600 * 1000;
    const coarseStepMs = 60 * 1000;

    let prevTime = startMs;
    let prevState = this.propagateAt(record, new Date(prevTime), observer);
    if (!prevState) {
      return passes;
    }

    let inPass = prevState.elevationDeg >= minElevationDeg;
    let passStartCoarse = inPass ? startMs : 0;

    for (
      let t = startMs + coarseStepMs;
      t <= endMs && passes.length < maxPasses;
      t += coarseStepMs
    ) {
      const currState = this.propagateAt(record, new Date(t), observer);
      if (!currState) {
        break;
      }

      const isVisible = currState.elevationDeg >= minElevationDeg;

      if (!inPass && isVisible) {
        inPass = true;
        passStartCoarse = prevTime;
      } else if (inPass && !isVisible) {
        inPass = false;
        const aosMs = this.refineHorizonCrossing(
          record,
          observer,
          passStartCoarse,
          passStartCoarse + coarseStepMs,
          minElevationDeg,
          true
        );
        const losMs = this.refineHorizonCrossing(
          record,
          observer,
          prevTime,
          t,
          minElevationDeg,
          false
        );

        const passWindow = this.buildDetailedPassWindow(
          record,
          observer,
          aosMs,
          losMs,
          minElevationDeg
        );
        if (passWindow && passWindow.maxElevationDeg >= minElevationDeg) {
          passes.push(passWindow);
        }
      }

      prevTime = t;
      prevState = currState;
    }

    return passes;
  }

  private static refineHorizonCrossing(
    record: OrbitalElementRecord,
    observer: ObserverLocation,
    lowMs: number,
    highMs: number,
    thresholdDeg: number,
    rising: boolean
  ): number {
    let lo = lowMs;
    let hi = highMs;

    for (let iter = 0; iter < 7; iter += 1) {
      if (hi - lo <= 1000) {
        break;
      }
      const mid = Math.floor((lo + hi) / 2);
      const st = this.propagateAt(record, new Date(mid), observer);
      if (!st) {
        break;
      }
      const above = st.elevationDeg >= thresholdDeg;
      if (rising) {
        if (above) {
          hi = mid;
        } else {
          lo = mid;
        }
      } else {
        if (above) {
          lo = mid;
        } else {
          hi = mid;
        }
      }
    }

    return Math.floor((lo + hi) / 2);
  }

  private static buildDetailedPassWindow(
    record: OrbitalElementRecord,
    observer: ObserverLocation,
    aosMs: number,
    losMs: number,
    minElevationDeg: number
  ): PassWindow | null {
    if (losMs <= aosMs) {
      return null;
    }

    const durationSec = Math.round((losMs - aosMs) / 1000);
    const sampleCount = 32;
    const stepMs = Math.max(2000, Math.floor((losMs - aosMs) / sampleCount));

    const skyTrack: SkyTrackPoint[] = [];
    let maxElevationDeg = -90;
    let maxAzimuthDeg = 0;
    let maxTime = aosMs;

    for (let t = aosMs; t <= losMs; t += stepMs) {
      const st = this.propagateAt(record, new Date(t), observer);
      if (!st) {
        continue;
      }
      skyTrack.push({
        timestamp: t,
        azimuthDeg: st.azimuthDeg,
        elevationDeg: Math.max(0, st.elevationDeg),
        rangeKm: st.rangeKm,
      });
      if (st.elevationDeg > maxElevationDeg) {
        maxElevationDeg = st.elevationDeg;
        maxAzimuthDeg = st.azimuthDeg;
        maxTime = t;
      }
    }

    const aosState = this.propagateAt(record, new Date(aosMs), observer);
    const losState = this.propagateAt(record, new Date(losMs), observer);

    if (!aosState || !losState || maxElevationDeg < minElevationDeg) {
      return null;
    }

    skyTrack.push({
      timestamp: losMs,
      azimuthDeg: losState.azimuthDeg,
      elevationDeg: Math.max(0, losState.elevationDeg),
      rangeKm: losState.rangeKm,
    });

    return {
      noradId: record.noradId,
      satelliteName: record.name,
      aosTime: aosMs,
      aosAzimuthDeg: aosState.azimuthDeg,
      maxTime,
      maxElevationDeg,
      maxAzimuthDeg,
      losTime: losMs,
      losAzimuthDeg: losState.azimuthDeg,
      durationSec,
      skyTrack,
    };
  }

  static computeValidationError(
    local: { latitude: number; longitude: number; altitudeKm: number },
    reference: { latitude: number; longitude: number; altitudeKm: number }
  ): ValidationErrorMetrics {
    const dLat = (reference.latitude - local.latitude) * DEG2RAD;
    const dLon = (reference.longitude - local.longitude) * DEG2RAD;
    const lat1 = local.latitude * DEG2RAD;
    const lat2 = reference.latitude * DEG2RAD;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const groundDistanceErrorKm = EARTH_RADIUS_KM * c;

    const altitudeDeltaKm = Math.abs(reference.altitudeKm - local.altitudeKm);
    const spatial3DErrorKm = Math.sqrt(
      groundDistanceErrorKm * groundDistanceErrorKm +
        altitudeDeltaKm * altitudeDeltaKm
    );

    return {
      groundDistanceErrorKm,
      spatial3DErrorKm,
      altitudeDeltaKm,
      latitudeDeltaDeg: Math.abs(reference.latitude - local.latitude),
      longitudeDeltaDeg: Math.abs(reference.longitude - local.longitude),
    };
  }
}
