import AsyncStorage from '@react-native-async-storage/async-storage';

export interface QueueItem {
  client_request_id: string;
  type: 'reading' | 'command';
  payload: any;
  timestamp: string;
}

const QUEUE_KEY = 'agropulse_offline_queue';

export async function getQueue(): Promise<QueueItem[]> {
  const data = await AsyncStorage.getItem(QUEUE_KEY);
  return data ? JSON.parse(data) : [];
}

export async function enqueue(item: QueueItem): Promise<void> {
  const queue = await getQueue();
  // Deduplicate by client_request_id
  if (queue.some((q) => q.client_request_id === item.client_request_id)) {
    return; // Already in queue
  }
  queue.push(item);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function dequeue(client_request_id: string): Promise<void> {
  const queue = await getQueue();
  const newQueue = queue.filter((q) => q.client_request_id !== client_request_id);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
}

export async function syncQueue(supabaseClient: any): Promise<number> {
  const queue = await getQueue();
  if (queue.length === 0) return 0;
  let synced = 0;

  for (const item of queue) {
    try {
      if (item.type === 'reading') {
        const { error } = await supabaseClient.from('readings').insert(item.payload);
        // Error code 23505 is unique violation (already applied, so safe to dequeue)
        if (!error || error.code === '23505') {
          await dequeue(item.client_request_id);
          synced++;
        }
      } else if (item.type === 'command') {
        const { error } = await supabaseClient.from('irrigation_commands').insert(item.payload);
        if (!error || error.code === '23505') {
          await dequeue(item.client_request_id);
          synced++;
        }
      }
    } catch (e) {
      console.warn('Sync failed for item', item.client_request_id, e);
    }
  }

  return synced;
}
