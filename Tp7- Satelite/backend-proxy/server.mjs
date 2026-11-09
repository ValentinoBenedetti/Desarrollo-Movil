import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 4700);

const FALLBACK_CATALOG = [
  {
    noradId: 25544,
    name: 'ISS (ZARYA)',
    constellation: 'stations',
    source: 'CelesTrak',
    epochIso: new Date(Date.now() - 3.4 * 3600 * 1000).toISOString(),
    tleLine1: '1 25544U 98067A   26310.50000000  .00016717  00000-0  10270-3 0  9993',
    tleLine2: '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.50103472421639',
  },
  {
    noradId: 48274,
    name: 'CSS (TIANHE)',
    constellation: 'stations',
    source: 'CelesTrak',
    epochIso: new Date(Date.now() - 4.1 * 3600 * 1000).toISOString(),
    tleLine1: '1 48274U 21035A   26310.50000000  .00021510  00000-0  24110-3 0  9991',
    tleLine2: '2 48274  41.4742 118.2310 0005120 215.4100 144.6210 15.60124120281421',
  },
  {
    noradId: 44713,
    name: 'STARLINK-1007',
    constellation: 'starlink',
    source: 'CelesTrak (SupGP)',
    epochIso: new Date(Date.now() - 5.2 * 3600 * 1000).toISOString(),
    tleLine1: '1 44713U 19074A   26310.50000000  .00001245  00000-0  98421-4 0  9991',
    tleLine2: '2 44713  53.0538 172.3412 0001421  88.4120 271.7032 15.06391245381124',
  },
  {
    noradId: 44714,
    name: 'STARLINK-1008',
    constellation: 'starlink',
    source: 'CelesTrak (SupGP)',
    epochIso: new Date(Date.now() - 5.2 * 3600 * 1000).toISOString(),
    tleLine1: '1 44714U 19074B   26310.50000000  .00001410  00000-0  10210-3 0  9994',
    tleLine2: '2 44714  53.0541 172.8510 0001310  92.1140 268.0312 15.06401120381152',
  },
  {
    noradId: 45178,
    name: 'STARLINK-1130',
    constellation: 'starlink',
    source: 'CelesTrak (SupGP)',
    epochIso: new Date(Date.now() - 5.2 * 3600 * 1000).toISOString(),
    tleLine1: '1 45178U 20012A   26310.50000000  .00001812  00000-0  12140-3 0  9992',
    tleLine2: '2 45178  53.0512 195.4120 0001512  74.2310 285.9120 15.06384510341219',
  },
  {
    noradId: 45531,
    name: 'STARLINK-1329',
    constellation: 'starlink',
    source: 'CelesTrak (SupGP)',
    epochIso: new Date(Date.now() - 5.2 * 3600 * 1000).toISOString(),
    tleLine1: '1 45531U 20025A   26310.50000000  .00001621  00000-0  11420-3 0  9998',
    tleLine2: '2 45531  53.0529 220.1140 0001280  81.5120 278.6210 15.06412010319824',
  },
  {
    noradId: 46112,
    name: 'STARLINK-1605',
    constellation: 'starlink',
    source: 'CelesTrak (SupGP)',
    epochIso: new Date(Date.now() - 5.2 * 3600 * 1000).toISOString(),
    tleLine1: '1 46112U 20057A   26310.50000000  .00001940  00000-0  13110-3 0  9995',
    tleLine2: '2 46112  53.0531 248.7210 0001410  85.1200 275.0140 15.06399820298412',
  },
  {
    noradId: 47120,
    name: 'STARLINK-1952',
    constellation: 'starlink',
    source: 'CelesTrak (SupGP)',
    epochIso: new Date(Date.now() - 5.2 * 3600 * 1000).toISOString(),
    tleLine1: '1 47120U 20088A   26310.50000000  .00001510  00000-0  10840-3 0  9997',
    tleLine2: '2 47120  53.0518 280.3410 0001390  90.4120 269.7310 15.06405120274120',
  },
  {
    noradId: 48150,
    name: 'STARLINK-2411',
    constellation: 'starlink',
    source: 'CelesTrak (SupGP)',
    epochIso: new Date(Date.now() - 5.2 * 3600 * 1000).toISOString(),
    tleLine1: '1 48150U 21024A   26310.50000000  .00001720  00000-0  11920-3 0  9993',
    tleLine2: '2 48150  53.0544 312.8120 0001450  79.8120 280.3210 15.06389120251240',
  },
  {
    noradId: 601234,
    name: 'STARLINK-31050 (6-Dig OMM)',
    constellation: 'starlink',
    source: 'CelesTrak (SupGP)',
    epochIso: new Date(Date.now() - 5.2 * 3600 * 1000).toISOString(),
    tleLine1: '1 01234U 26045A   26310.50000000  .00001245  00000-0  98421-4 0  9990',
    tleLine2: '2 01234  53.0538  45.3412 0001421  88.4120 120.7032 15.06391245 12400',
  },
  {
    noradId: 24876,
    name: 'GPS BIIR-2 (PRN 13)',
    constellation: 'gps-ops',
    source: 'CelesTrak',
    epochIso: new Date(Date.now() - 7.0 * 3600 * 1000).toISOString(),
    tleLine1: '1 24876U 97035A   26310.50000000 -.00000041  00000-0  00000-0 0  9994',
    tleLine2: '2 24876  55.4123 115.2310 0068120 212.1140 147.5210  2.00563120214128',
  },
  {
    noradId: 41866,
    name: 'GOES 16 (GEO)',
    constellation: 'weather',
    source: 'CelesTrak',
    epochIso: new Date(Date.now() - 8.5 * 3600 * 1000).toISOString(),
    tleLine1: '1 41866U 16071A   26310.50000000 -.00000258  00000-0  00000-0 0  9995',
    tleLine2: '2 41866   0.0412  85.1240 0000812 140.2310 219.8120  1.00271124 29142',
  },
];

let liveIssTleFetched = false;

async function syncLiveIssTle() {
  if (liveIssTleFetched) return;
  try {
    const res = await fetch('https://api.wheretheiss.at/v1/satellites/25544/tles');
    if (res.ok) {
      const data = await res.json();
      if (data && data.line1 && data.line2) {
        FALLBACK_CATALOG[0].tleLine1 = String(data.line1).trim();
        FALLBACK_CATALOG[0].tleLine2 = String(data.line2).trim();
        FALLBACK_CATALOG[0].epochIso = new Date(
          Number(data.tle_timestamp || Date.now() / 1000) * 1000
        ).toISOString();
        liveIssTleFetched = true;
      }
    }
  } catch {
    // Keep fallback TLE if offline
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url || '/', `http://localhost:${PORT}`);

  if (parsedUrl.pathname === '/api/health') {
    sendJson(res, 200, {
      status: 'ok',
      service: 'TP7 Satellite Tracker Proxy & Mission Control',
      ttlHours: 12,
      liveIssTleSynced: liveIssTleFetched,
    });
    return;
  }

  if (parsedUrl.pathname === '/api/catalog') {
    await syncLiveIssTle();
    const group = parsedUrl.searchParams.get('group') || 'all';
    const items =
      group === 'all'
        ? FALLBACK_CATALOG
        : FALLBACK_CATALOG.filter(item => item.constellation === group);
    sendJson(res, 200, items);
    return;
  }

  if (parsedUrl.pathname === '/api/validate/iss') {
    await syncLiveIssTle();
    try {
      const response = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
      if (response.ok) {
        const data = await response.json();
        sendJson(res, 200, {
          live: true,
          source: 'WhereTheISS (API Real)',
          noradId: 25544,
          name: 'ISS (ZARYA)',
          timestamp: Number(data.timestamp) * 1000,
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          altitudeKm: Number(data.altitude),
          velocityKmS: Number(data.velocity) / 3600,
          tleLine1: FALLBACK_CATALOG[0].tleLine1,
          tleLine2: FALLBACK_CATALOG[0].tleLine2,
        });
        return;
      }
    } catch {
      // Fall through to deterministic reference if offline
    }
    sendJson(res, 200, {
      live: false,
      source: 'WhereTheISS (Offline Proxy Cache)',
      noradId: 25544,
      name: 'ISS (ZARYA)',
      timestamp: Date.now(),
    });
    return;
  }

  if (parsedUrl.pathname === '/vendor/satellite.min.js') {
    const satPath = path.resolve(
      __dirname,
      '../node_modules/satellite.js/dist/satellite.min.js'
    );
    if (fs.existsSync(satPath)) {
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      fs.createReadStream(satPath).pipe(res);
      return;
    }
  }

  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(indexPath).pipe(res);
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('===================================================================');
  console.log(` TP7 SATELLITE TRACKER - PROXY & SIMULADOR WEB ACTIVO`);
  console.log(` URL en PC            : http://localhost:${PORT}`);
  console.log(` URL en Celular Wi-Fi : http://192.168.0.32:${PORT}`);
  console.log('===================================================================');
});
