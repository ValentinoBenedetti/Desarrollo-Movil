import { Kafka } from 'kafkajs';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const KAFKA_BROKERS = [process.env.KAFKA_BROKERS || 'localhost:29092'];
const SKIP_MONTE_A = process.env.SKIP_MONTE_A === 'true';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const kafka = new Kafka({ clientId: 'agropulse-worker', brokers: KAFKA_BROKERS });

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'agropulse-group' });

// In-memory state for simulator
const state = {
  '44444444-4444-4444-4444-444444444441': { moisture: 34, temp: 22, rain: 0 }, // C1
  '44444444-4444-4444-4444-444444444442': { moisture: 18, temp: 24, rain: 0 }, // C2
  '44444444-4444-4444-4444-444444444443': { moisture: 30, temp: 21, rain: 0 }  // MA
};

const valves = {
  '55555555-5555-5555-5555-555555555551': 'closed',
  '55555555-5555-5555-5555-555555555552': 'closed',
  '55555555-5555-5555-5555-555555555553': 'closed'
};

const processingCommands = new Set();

async function init() {
  await producer.connect();
  await consumer.connect();

  await consumer.subscribe({ topic: 'soil.moisture', fromBeginning: false });
  await consumer.subscribe({ topic: 'weather.tick', fromBeginning: false });
  await consumer.subscribe({ topic: 'irrigation.commands', fromBeginning: false });

  console.log('Worker/Simulator started. Connected to Kafka and Supabase.');

  // Start consumer loop
  consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      if (!message.value) return;
      const payload = JSON.parse(message.value.toString());

      if (topic === 'soil.moisture' || topic === 'weather.tick') {
        console.log(`[CONSUMED] ${topic}:`, payload);
        
        const { data: station, error } = await supabase.from('stations').select('id, plot_id').eq('id', payload.station_id).single();
        if (error || !station) {
          console.warn(`[WARNING] Station ${payload.station_id} not found.`);
          return;
        }

        const reading = {
          station_id: payload.station_id,
          measured_at: payload.ts,
          moisture_pct: payload.moisture_pct || 0,
          temp_c: payload.temp_c || 0,
          rain_mm: payload.rain_mm || 0,
          source: 'sensor'
        };

        const { error: insertError } = await supabase.from('readings').insert(reading);
        if (insertError) {
          console.error('[ERROR] Failed to insert reading:', insertError.message);
        } else {
          console.log(`[UPSERT READING] Station ${payload.station_id}`);
        }

        if (payload.moisture_pct) {
          const { data: plot } = await supabase.from('plots').select('threshold_min').eq('id', station.plot_id).single();
          if (plot && payload.moisture_pct < plot.threshold_min) {
            const { data: recent } = await supabase.from('alerts').select('id').eq('plot_id', station.plot_id).eq('type', 'dry').is('read_at', null).limit(1);
            if (!recent || recent.length === 0) {
              await supabase.from('alerts').insert({ plot_id: station.plot_id, type: 'dry', payload: { moisture: payload.moisture_pct } });
              console.log(`[ALERT] Created dry alert for plot ${station.plot_id}`);
            }
          }
        }
      }

      if (topic === 'irrigation.commands') {
        console.log(`[CONSUMED] irrigation.commands:`, payload);
        const { command_id, valve_id, action, duration_min } = payload;

        await new Promise(res => setTimeout(res, 2500));

        const { data: cmd } = await supabase.from('irrigation_commands').select('status').eq('id', command_id).single();
        if (cmd?.status === 'cancelled') {
          console.log(`[COMMAND CANCELLED] Command ${command_id}`);
          processingCommands.delete(command_id);
          return;
        }

        if (duration_min === 99) {
           await supabase.from('irrigation_commands').update({ status: 'failed', error_reason: 'valve_timeout' }).eq('id', command_id);
           console.log(`[COMMAND FAILED] Timeout for command ${command_id}`);
           processingCommands.delete(command_id);
           return;
        }

        const newStatus = (action === 'open' || action === 'irrigate_minutes') ? 'open' : 'closed';
        valves[valve_id as keyof typeof valves] = newStatus;

        await supabase.from('valves').update({ status: newStatus }).eq('id', valve_id);
        await supabase.from('irrigation_commands').update({ status: 'applied', applied_at: new Date().toISOString() }).eq('id', command_id);
        
        await producer.send({
          topic: 'valve.status',
          messages: [{ value: JSON.stringify({ valve_id, status: newStatus, ts: new Date().toISOString() }) }]
        });

        console.log(`[COMMAND APPLIED] Valve ${valve_id} is now ${newStatus}`);
        processingCommands.delete(command_id);
      }
    }
  });

  // Start simulator loop (every 5s)
  setInterval(async () => {
    const ts = new Date().toISOString();
    
    // Update C2 based on valve
    if (valves['55555555-5555-5555-5555-555555555552'] === 'open') {
       state['44444444-4444-4444-4444-444444444442'].moisture = Math.min(100, state['44444444-4444-4444-4444-444444444442'].moisture + 2);
    } else {
       state['44444444-4444-4444-4444-444444444442'].moisture = Math.max(0, state['44444444-4444-4444-4444-444444444442'].moisture - 0.1);
    }
    // C1 random walk
    state['44444444-4444-4444-4444-444444444441'].moisture = Math.max(26, Math.min(44, state['44444444-4444-4444-4444-444444444441'].moisture + (Math.random() - 0.5)));

    const messages = [];

    messages.push({ value: JSON.stringify({ station_id: '44444444-4444-4444-4444-444444444441', moisture_pct: state['44444444-4444-4444-4444-444444444441'].moisture, temp_c: state['44444444-4444-4444-4444-444444444441'].temp, ts }) });
    messages.push({ value: JSON.stringify({ station_id: '44444444-4444-4444-4444-444444444442', moisture_pct: state['44444444-4444-4444-4444-444444444442'].moisture, temp_c: state['44444444-4444-4444-4444-444444444442'].temp, ts }) });

    if (!SKIP_MONTE_A) {
       messages.push({ value: JSON.stringify({ station_id: '44444444-4444-4444-4444-444444444443', moisture_pct: state['44444444-4444-4444-4444-444444444443'].moisture, temp_c: state['44444444-4444-4444-4444-444444444443'].temp, ts }) });
    }

    await producer.send({ topic: 'soil.moisture', messages });
    console.log(`[PRODUCED] soil.moisture x${messages.length}`);

  }, 5000);

  setInterval(async () => {
    const { data: commands } = await supabase.from('irrigation_commands').select('*').eq('status', 'pending');
    if (commands && commands.length > 0) {
       for (const cmd of commands) {
          if (!processingCommands.has(cmd.id)) {
            processingCommands.add(cmd.id);
            await producer.send({
              topic: 'irrigation.commands',
              messages: [{ value: JSON.stringify({ command_id: cmd.id, valve_id: cmd.valve_id, action: cmd.action, duration_min: cmd.duration_min, ts: new Date().toISOString() }) }]
            });
            console.log(`[PRODUCED] irrigation.commands: ${cmd.id}`);
          }
       }
    }
  }, 1000);
}

init().catch(console.error);
