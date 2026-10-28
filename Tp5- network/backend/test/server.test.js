import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';

const HTTP_PORT = 3000;
const TCP_PORT = 3001;
const BASE_URL = `http://127.0.0.1:${HTTP_PORT}`;

describe('Network QoS Backend Suite', () => {
  let serverProcess;

  before(async () => {
    // Iniciar servidor como proceso hijo
    serverProcess = spawn('node', ['src/server.js'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'inherit', 'inherit'],
      env: { ...process.env, PORT: HTTP_PORT.toString(), TCP_PING_PORT: TCP_PORT.toString() },
    });

    // Esperar a que el servidor esté listo
    let ready = false;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`${BASE_URL}/health`);
        if (res.ok) {
          ready = true;
          break;
        }
      } catch {
        // Aún iniciando...
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    assert.ok(ready, 'El servidor backend no inició a tiempo');
  });

  after(() => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  });

  test('GET /health retorna status ok y serverTime numérico', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
    assert.equal(typeof data.serverTime, 'number');
  });

  test('GET /ping retorna cabeceras no-cache y prefijo pong:', async () => {
    const res = await fetch(`${BASE_URL}/ping`);
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.ok(body.startsWith('pong:'));
    assert.equal(res.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, private');
  });

  test('GET /download con bytes exactos retorna Content-Length y tamaño correcto', async () => {
    const requestedBytes = 4096;
    const res = await fetch(`${BASE_URL}/download?bytes=${requestedBytes}`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-length'), requestedBytes.toString());
    assert.equal(res.headers.get('x-payload-bytes'), requestedBytes.toString());

    const buffer = await res.arrayBuffer();
    assert.equal(buffer.byteLength, requestedBytes);
  });

  test('GET /download con mb=0.25 transfiere exactamente 262144 bytes', async () => {
    const expectedBytes = Math.floor(0.25 * 1024 * 1024);
    const res = await fetch(`${BASE_URL}/download?mb=0.25`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-length'), expectedBytes.toString());

    const buffer = await res.arrayBuffer();
    assert.equal(buffer.byteLength, expectedBytes);
  });

  test('POST /upload procesa stream y calcula Mbps, duración y bytes recibidos', async () => {
    const payloadSize = 128 * 1024; // 128 KB
    const dummyPayload = new Uint8Array(payloadSize);
    for (let i = 0; i < payloadSize; i++) {
      dummyPayload[i] = i % 256;
    }

    const res = await fetch(`${BASE_URL}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: dummyPayload,
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'success');
    assert.equal(data.bytesReceived, payloadSize);
    assert.ok(data.durationMs >= 0);
    assert.ok(data.speedMbps >= 0);
  });

  test('TCP Echo Server en puerto 3001 responde exactamente el payload enviado para sondas RTT', async () => {
    const message = 'QOS_PROBE_PING_PACKET_TEST';

    const echoResponse = await new Promise((resolve, reject) => {
      const client = net.createConnection({ host: '127.0.0.1', port: TCP_PORT }, () => {
        client.write(message);
      });

      client.setTimeout(2000);

      client.on('data', (data) => {
        client.destroy();
        resolve(data.toString());
      });

      client.on('timeout', () => {
        client.destroy();
        reject(new Error('Timeout esperando respuesta de echo TCP'));
      });

      client.on('error', (err) => {
        client.destroy();
        reject(err);
      });
    });

    assert.equal(echoResponse, message);
  });
});
