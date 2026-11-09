import assert from 'node:assert/strict';
import { OrbitalEngine } from '../src/engine/OrbitalEngine.ts';
import type { ObserverLocation, OrbitalElementRecord } from '../src/services/DataProvider.ts';

const ISS_RECORD: OrbitalElementRecord = {
  noradId: 25544,
  name: 'ISS (ZARYA)',
  epochIso: '2026-11-06T12:00:00.000Z',
  tleLine1: '1 25544U 98067A   26310.50000000  .00016717  00000-0  10270-3 0  9993',
  tleLine2: '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.50103472421639',
  constellation: 'stations',
  source: 'CelesTrak',
  fetchedAt: Date.now(),
};

const STARLINK_OMM_RECORD: OrbitalElementRecord = {
  noradId: 601234, // 6-digit NORAD Catalog ID (OMM format support per Section 4.1)
  name: 'STARLINK-31050 (6-DIGIT OMM)',
  epochIso: '2026-11-06T12:00:00.000Z',
  omm: {
    OBJECT_NAME: 'STARLINK-31050',
    OBJECT_ID: '2026-045A',
    EPOCH: '2026-11-06T12:00:00.000000',
    MEAN_MOTION: 15.06391245,
    ECCENTRICITY: 0.0001421,
    INCLINATION: 53.0538,
    RA_OF_ASC_NODE: 172.3412,
    ARG_OF_PERICENTER: 88.412,
    MEAN_ANOMALY: 271.7032,
    EPHEMERIS_TYPE: 0,
    CLASSIFICATION_TYPE: 'U',
    NORAD_CAT_ID: 601234,
    ELEMENT_SET_NO: 999,
    REV_AT_EPOCH: 1240,
    BSTAR: 0.000098421,
    MEAN_MOTION_DOT: 0.00001245,
    MEAN_MOTION_DDOT: 0,
  },
  constellation: 'starlink',
  source: 'CelesTrak',
  fetchedAt: Date.now(),
};

const OBSERVER_FCYT: ObserverLocation = {
  latitude: -32.4845,
  longitude: -58.2322,
  altitudeKm: 0.025,
};

async function runTestSuite(): Promise<void> {
  console.log('==============================================================');
  console.log(' TP7 SATELLITE TRACKER - SUITE DE VERIFICACION ORBITAL (SGP4)');
  console.log('==============================================================\n');

  // Test 1: SGP4 Propagation (TLE) -> ECI, Geodetic & Topocentric Look Angles (RF-02, RF-03)
  const testDate = new Date('2026-11-06T18:00:00.000Z');
  const issState = OrbitalEngine.propagateAt(ISS_RECORD, testDate, OBSERVER_FCYT);
  assert.ok(issState, 'La propagación SGP4 de la ISS debe devolver un estado válido');
  assert.ok(issState.latitude >= -52 && issState.latitude <= 52, 'Latitud ISS dentro de inclinación 51.6°');
  assert.ok(issState.longitude >= -180 && issState.longitude <= 180, 'Longitud dentro de [-180, 180]');
  assert.ok(issState.altitudeKm > 380 && issState.altitudeKm < 450, 'Altitud LEO nominal de la ISS (~410-425 km)');
  assert.ok(issState.velocityKmS > 7.4 && issState.velocityKmS < 7.9, 'Velocidad orbital LEO (~7.66 km/s)');
  assert.equal(issState.orbitRegime, 'LEO');
  console.log(
    `[PASS] 1. Propagacion SGP4 Local (ISS #25544): Lat=${issState.latitude.toFixed(4)}°, Lon=${issState.longitude.toFixed(4)}°, Alt=${issState.altitudeKm.toFixed(2)} km, Vel=${issState.velocityKmS.toFixed(2)} km/s`
  );
  console.log(
    `       Look Angles desde FCyT: Azimut=${issState.azimuthDeg.toFixed(2)}°, Elevacion=${issState.elevationDeg.toFixed(2)}°, Rango=${issState.rangeKm.toFixed(1)} km`
  );

  // Test 2: OMM JSON 6-Digit NORAD ID Support (Section 4.1)
  const ommState = OrbitalEngine.propagateAt(STARLINK_OMM_RECORD, testDate, OBSERVER_FCYT);
  assert.ok(ommState, 'La propagación OMM/JSON para NORAD de 6 dígitos debe funcionar');
  assert.equal(ommState.noradId, 601234);
  assert.ok(ommState.altitudeKm > 500 && ommState.altitudeKm < 600, 'Altitud Starlink LEO (~550 km)');
  console.log(
    `[PASS] 2. Soporte Formato OMM/JSON (NORAD 6 digitos #601234): Lat=${ommState.latitude.toFixed(4)}°, Lon=${ommState.longitude.toFixed(4)}°, Alt=${ommState.altitudeKm.toFixed(2)} km`
  );

  // Test 3: Ground Track Antimeridian Split (RF-11)
  const syntheticCrossing = [
    { latitude: 10.0, longitude: 172.0 },
    { latitude: 12.0, longitude: 178.5 },
    { latitude: 14.0, longitude: -176.5 },
    { latitude: 16.0, longitude: -170.0 },
  ];
  const splitSegments = OrbitalEngine.splitAntimeridianPolyline(syntheticCrossing);
  assert.equal(splitSegments.length, 2, 'El cruce del antimeridiano debe cortar la polilínea en 2 segmentos');
  assert.equal(splitSegments[0][splitSegments[0].length - 1].longitude, 180, 'El primer segmento debe terminar en +180°');
  assert.equal(splitSegments[1][0].longitude, -180, 'El segundo segmento debe iniciar en -180°');

  const fullOrbitSegments = OrbitalEngine.computeGroundTrackSegments(
    ISS_RECORD,
    testDate,
    OBSERVER_FCYT,
    40
  );
  assert.ok(fullOrbitSegments.length >= 2, 'Una órbita completa debe dividirse al cruzar el antimeridiano');
  console.log(
    `[PASS] 3. Ground Track y Corte Antimeridiano (±180°): ${fullOrbitSegments.length} segmentos generados sin saltos horizontales`
  );

  // Test 4: Footprint Coverage Radius Calculation (RF-12)
  const r10 = OrbitalEngine.computeFootprintRadiusMeters(420, 10);
  const r25 = OrbitalEngine.computeFootprintRadiusMeters(420, 25);
  assert.ok(r10 > 1200_000 && r10 < 1650_000, 'Footprint ISS a 10° de elevación mínima (~1450 km)');
  assert.ok(r25 < r10, 'Mayor elevación mínima debe reducir el radio del footprint operativo');
  console.log(
    `[PASS] 4. Calculo de Footprint (ITU-R): Radio(El>=10°)=${(r10 / 1000).toFixed(1)} km | Radio(El>=25°)=${(r25 / 1000).toFixed(1)} km`
  );

  // Test 5: Coarse-to-Fine Visibility Window Prediction (AOS / MAX / LOS) (RF-04)
  const passes = OrbitalEngine.predictVisibilityWindows(
    ISS_RECORD,
    OBSERVER_FCYT,
    10,
    48,
    5
  );
  assert.ok(passes.length > 0, 'Debe encontrar ventanas de visibilidad (AOS/LOS) para la ISS en 48h');
  const firstPass = passes[0];
  assert.ok(firstPass.losTime > firstPass.aosTime, 'LOS debe ser posterior a AOS');
  assert.ok(firstPass.maxElevationDeg >= 10, 'Elevación máxima debe superar el umbral configurado');
  assert.ok(firstPass.skyTrack.length >= 10, 'SkyTrack debe incluir puntos polares para el SVG Sky Chart');
  console.log(
    `[PASS] 5. Predictor AOS/LOS (Búsqueda Grueso->Fino + Bisección): ${passes.length} pases detectados. Próximo pase: MaxEl=${firstPass.maxElevationDeg.toFixed(1)}°, Duración=${firstPass.durationSec}s`
  );

  // Test 6: Cross-Validation Error Calculation (RF-15)
  const simulatedExternal = {
    latitude: issState.latitude + 0.0065,
    longitude: issState.longitude - 0.0072,
    altitudeKm: issState.altitudeKm + 0.24,
  };
  const metrics = OrbitalEngine.computeValidationError(
    {
      latitude: issState.latitude,
      longitude: issState.longitude,
      altitudeKm: issState.altitudeKm,
    },
    simulatedExternal
  );
  assert.ok(metrics.groundDistanceErrorKm > 0.5 && metrics.groundDistanceErrorKm < 2.0);
  assert.ok(metrics.spatial3DErrorKm >= metrics.groundDistanceErrorKm);
  console.log(
    `[PASS] 6. Capa de Validacion Cruzada (Haversine 2D & Cuerda 3D): Error 2D=${metrics.groundDistanceErrorKm.toFixed(3)} km | Error 3D=${metrics.spatial3DErrorKm.toFixed(3)} km`
  );

  console.log('\n==============================================================');
  console.log(' TODAS LAS PRUEBAS ORBITALES Y GEODESICAS PASARON EXITOSAMENTE');
  console.log('==============================================================');
}

runTestSuite().catch(err => {
  console.error(err);
  process.exit(1);
});

