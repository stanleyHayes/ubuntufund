import { describe, it, expect } from 'vitest';
import {
  EventBus,
  campaignChannel,
  liveChannel,
} from '../../src/infrastructure/realtime/EventBus.js';

describe('EventBus', () => {
  it('assigns monotonic ids and delivers to subscribers', () => {
    const bus = new EventBus();
    const received: number[] = [];
    const unsubscribe = bus.subscribe('campaign:1', (e) => received.push(e.id));

    const first = bus.publish('campaign:1', 'donation', { a: 1 });
    const second = bus.publish('campaign:1', 'total', { a: 2 });

    expect(second.id).toBe(first.id + 1);
    expect(received).toEqual([first.id, second.id]);

    unsubscribe();
    bus.publish('campaign:1', 'alert', { a: 3 });
    expect(received).toHaveLength(2); // no delivery after unsubscribe
  });

  it('isolates channels', () => {
    const bus = new EventBus();
    const a: string[] = [];
    bus.subscribe('campaign:a', (e) => a.push(e.type));
    bus.publish('campaign:b', 'donation', {});
    expect(a).toHaveLength(0);
  });

  it('replays only events newer than the given id', () => {
    const bus = new EventBus();
    const e1 = bus.publish('live:x', 'donation', { n: 1 });
    const e2 = bus.publish('live:x', 'total', { n: 2 });

    expect(bus.getBufferedEvents('live:x').map((e) => e.id)).toEqual([e1.id, e2.id]);
    expect(bus.getBufferedEvents('live:x', e1.id).map((e) => e.id)).toEqual([e2.id]);
  });

  it('bounds the ring buffer to the newest 50 events', () => {
    const bus = new EventBus();
    for (let i = 0; i < 60; i++) bus.publish('campaign:big', 'total', { i });
    const buffered = bus.getBufferedEvents('campaign:big');
    expect(buffered).toHaveLength(50);
    expect(buffered[buffered.length - 1]?.data).toMatchObject({ i: 59 });
  });

  it('builds namespaced channel names', () => {
    expect(campaignChannel('abc')).toBe('campaign:abc');
    expect(liveChannel('xyz')).toBe('live:xyz');
  });
});
