import express from 'express';
import cors from 'cors';
import net from 'net';
import crypto from 'crypto';

const HTTP_PORT = process.env.PORT || 3000;
const TCP_PING_PORT = process.env.TCP_PING_PORT || 3001;

// --- HTTP SERVER (Throughput & Health) ---
const app = express();
app.use(cors());

// Healthcheck
app.get('/health', (req, res) => {
  res.json({ status: 'ok', serverTime: Date.now() });
});

// Ping endpoint HTTP (referencia básica)
app.get('/ping', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.send(`pong:${Date.now()}`);
});

// Endpoint de descarga para test de Throughput
// Permite especificar tamaño por query param: ?bytes=... o ?mb=... (default: 5MB)
app.get('/download', (req, res) => {
  let totalBytes = 5 * 1024 * 1024; // 5 MB por defecto

  if (req.query.mb) {
    const mb = parseFloat(req.query.mb);
    if (!isNaN(mb) && mb > 0 && mb <= 100) {
      totalBytes = Math.floor(mb * 1024 * 1024);
    }
  } else if (req.query.bytes) {
    const bytes = parseInt(req.query.bytes, 10);
    if (!isNaN(bytes) && bytes > 0 && bytes <= 100 * 1024 * 1024) {
      totalBytes = bytes;
    }
  }

  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Length': totalBytes,
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'X-Payload-Bytes': totalBytes.toString()
  });

  const CHUNK_SIZE = 64 * 1024; // 64 KB por chunk
  const dummyChunk = crypto.randomBytes(CHUNK_SIZE);
  let bytesRemaining = totalBytes;

  function pushChunk() {
    while (bytesRemaining > 0) {
      const currentChunkSize = Math.min(bytesRemaining, CHUNK_SIZE);
      const chunk = currentChunkSize === CHUNK_SIZE ? dummyChunk : dummyChunk.subarray(0, currentChunkSize);
      bytesRemaining -= currentChunkSize;

      const canContinue = res.write(chunk);
      if (!canContinue) {
        // Control de contrapresión (backpressure)
        res.once('drain', pushChunk);
        return;
      }
    }
    res.end();
  }

  pushChunk();
});

// Endpoint de subida para test de Throughput
// Consume el stream sin acumular en memoria para evitar saturar el GC
app.post('/upload', (req, res) => {
  const startTime = process.hrtime.bigint();
  let bytesReceived = 0;

  req.on('data', (chunk) => {
    bytesReceived += chunk.length;
  });

  req.on('end', () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    const durationSec = durationMs / 1000;
    const speedMbps = durationSec > 0 ? (bytesReceived * 8) / (durationSec * 1_000_000) : 0;

    res.json({
      status: 'success',
      bytesReceived,
      durationMs: parseFloat(durationMs.toFixed(2)),
      speedMbps: parseFloat(speedMbps.toFixed(2))
    });
  });

  req.on('error', (err) => {
    res.status(500).json({ error: 'Upload stream failed', message: err.message });
  });
});

app.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`[HTTP] Servidor de throughput escuchando en http://0.0.0.0:${HTTP_PORT}`);
});

// --- TCP ECHO SERVER (Sondas RTT y Jitter de bajo nivel) ---
// El cliente móvil enviará paquetes pequeños (ej: timestamp o secuencia)
// y el servidor responderá inmediatamente como echo para medir RTT puro.
const tcpServer = net.createServer((socket) => {
  socket.on('data', (data) => {
    // Echo inmediato del buffer recibido
    socket.write(data);
  });

  socket.on('error', (err) => {
    // Manejo silencioso de desconexiones abruptas del cliente
  });
});

tcpServer.listen(TCP_PING_PORT, '0.0.0.0', () => {
  console.log(`[TCP] Servidor de echo para sondas RTT escuchando en 0.0.0.0:${TCP_PING_PORT}`);
});
