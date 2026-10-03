const path = require('path');
const fs = require('fs');

// Resolve supabase from agropulse dependencies
const supabaseModule = path.join(__dirname, '..', 'apps', 'agropulse', 'node_modules', '@supabase', 'supabase-js');
const { createClient } = require(supabaseModule);

// Read environment from apps/agropulse/.env
const envPath = path.join(__dirname, '..', 'apps', 'agropulse', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const urlMatch = envContent.match(/EXPO_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : 'http://127.0.0.1:54331';
const supabaseKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('\n========================================================');
console.log('🌾 AGROPULSE — MONITOR DE EVENTOS EN TIEMPO REAL');
console.log('📡 Conectado a Supabase Realtime:', supabaseUrl);
console.log('👉 Presioná Ctrl+C para salir cuando quieras');
console.log('========================================================\n');

async function startMonitoring() {
  // Preload names for pretty printing
  const { data: plots } = await supabase.from('plots').select('id, name');
  const { data: stations } = await supabase.from('stations').select('id, name, plot_id');
  const { data: valves } = await supabase.from('valves').select('id, name, plot_id');

  const plotMap = new Map((plots || []).map(p => [p.id, p.name]));
  const stationMap = new Map((stations || []).map(s => [s.id, { name: s.name, plot: plotMap.get(s.plot_id) || 'Lote' }]));
  const valveMap = new Map((valves || []).map(v => [v.id, { name: v.name, plot: plotMap.get(v.plot_id) || 'Lote' }]));

  console.log('🟢 Escuchando telemetría, cambios de válvulas y órdenes de riego...\n');

  // 1. Escuchar nuevas lecturas
  supabase
    .channel('terminal-readings')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'readings' }, (payload) => {
      const r = payload.new;
      const stInfo = stationMap.get(r.station_id) || { name: 'Estación desconocida', plot: 'Lote' };
      const time = new Date(r.measured_at || Date.now()).toLocaleTimeString();
      const origin = r.source === 'manual' ? '📱 Manual (App)' : '📡 Sensor IoT';

      console.log(`[${time}] 💧 NUEVA LECTURA | ${stInfo.plot} (${stInfo.name})`);
      console.log(`         Humedad: ${r.moisture_pct}% | Temp: ${r.temp_c}°C | Origen: ${origin}`);
      if (r.client_request_id) {
        console.log(`         Idempotencia UUID: ${r.client_request_id}`);
      }
      console.log('--------------------------------------------------------');
    })
    .subscribe();

  // 2. Escuchar cambios de válvulas
  supabase
    .channel('terminal-valves')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'valves' }, (payload) => {
      const v = payload.new;
      const vInfo = valveMap.get(v.id) || { name: v.name || 'Válvula', plot: 'Lote' };
      const time = new Date().toLocaleTimeString();
      const statusText = v.status === 'open' ? '🟢 ABIERTA (Regando)' : '🔴 CERRADA';

      console.log(`[${time}] ⚙️ CAMBIO DE VÁLVULA | ${vInfo.plot} - ${vInfo.name}`);
      console.log(`         Nuevo Estado: ${statusText}`);
      console.log('--------------------------------------------------------');
    })
    .subscribe();

  // 3. Escuchar órdenes de riego (Event-Driven)
  supabase
    .channel('terminal-commands')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'irrigation_commands' }, (payload) => {
      const cmd = payload.new;
      const time = new Date().toLocaleTimeString();
      console.log(`[${time}] 📋 COMANDO REGISTRADO | Acción: ${cmd.action.toUpperCase()} | Estado: ${cmd.status}`);
      console.log(`         Client Request ID: ${cmd.client_request_id}`);
      console.log('--------------------------------------------------------');
    })
    .subscribe();
}

startMonitoring();
