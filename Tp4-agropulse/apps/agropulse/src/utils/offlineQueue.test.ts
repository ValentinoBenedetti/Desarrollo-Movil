import AsyncStorage from '@react-native-async-storage/async-storage';
import { getQueue, enqueue, dequeue, QueueItem } from './offlineQueue';

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn(async (key) => store[key] || null),
    setItem: jest.fn(async (key, value) => { store[key] = value; }),
    clear: jest.fn(async () => { store = {}; })
  };
});

describe('offlineQueue', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('enqueues an item and deduplicates identical client_request_ids', async () => {
    const item1: QueueItem = {
      client_request_id: '123-abc',
      type: 'reading',
      payload: { moisture: 30 },
      timestamp: new Date().toISOString()
    };

    const item2: QueueItem = {
      client_request_id: '123-abc', // Duplicate
      type: 'reading',
      payload: { moisture: 30 },
      timestamp: new Date().toISOString()
    };

    await enqueue(item1);
    let queue = await getQueue();
    expect(queue.length).toBe(1);

    await enqueue(item2);
    queue = await getQueue();
    expect(queue.length).toBe(1); // Should still be 1
  });

  it('dequeues an item properly', async () => {
    const item1: QueueItem = {
      client_request_id: '123-abc',
      type: 'reading',
      payload: { moisture: 30 },
      timestamp: new Date().toISOString()
    };

    await enqueue(item1);
    await dequeue('123-abc');
    const queue = await getQueue();
    expect(queue.length).toBe(0);
  });
});
