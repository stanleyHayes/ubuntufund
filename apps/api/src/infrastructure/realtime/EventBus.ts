import { EventEmitter } from 'node:events';
import type { LiveEvent, LiveEventType } from '@ubuntu-fund/types';

/** Newest N events retained per channel for `Last-Event-ID` resume. */
const RING_BUFFER_SIZE = 50;

export type BusEvent = LiveEvent;
export type BusListener = (event: BusEvent) => void;

/** Channel name for a whole-campaign feed. */
export function campaignChannel(campaignId: string): string {
  return `campaign:${campaignId}`;
}

/** Channel name for a single live session's feed. */
export function liveChannel(liveSessionId: string): string {
  return `live:${liveSessionId}`;
}

/**
 * In-process pub/sub for real-time live-session events, backed by a Node
 * EventEmitter with a small per-channel ring buffer. The buffer lets a newly
 * connected (or reconnecting) SSE client replay events it missed via the
 * `Last-Event-ID` header.
 *
 * Single-process only — running more than one API instance would need a shared
 * broker (Redis pub/sub, etc.) behind this same interface.
 */
export class EventBus {
  private readonly emitter = new EventEmitter();
  private readonly buffers = new Map<string, BusEvent[]>();
  /**
   * Starts at the boot time in ms rather than 0. Ids must keep increasing
   * across restarts (free-plan spin-downs, deploys): a client reconnecting with
   * the previous process's Last-Event-ID would otherwise be "ahead" of every
   * new event and silently skip the ones published before it reconnected. One
   * event per millisecond of uptime is far beyond real traffic, so a new
   * process always starts above the old one's last id. Still a safe integer.
   */
  private sequence: number;

  constructor(startAt: number = Date.now()) {
    this.sequence = startAt;
    // Each SSE client attaches one listener per channel; a popular live session
    // can hold many concurrent viewers, so lift the default 10-listener cap.
    this.emitter.setMaxListeners(0);
  }

  /**
   * Publish an event to a channel: assigns it a monotonic id + timestamp,
   * appends it to the channel's ring buffer, and notifies live subscribers.
   * Returns the published event.
   */
  publish(channel: string, type: LiveEventType, data: unknown): BusEvent {
    const event: BusEvent = {
      id: ++this.sequence,
      type,
      data,
      ts: Date.now(),
    };

    const buffer = this.buffers.get(channel) ?? [];
    buffer.push(event);
    if (buffer.length > RING_BUFFER_SIZE) {
      buffer.splice(0, buffer.length - RING_BUFFER_SIZE);
    }
    this.buffers.set(channel, buffer);

    this.emitter.emit(channel, event);
    return event;
  }

  /** Subscribe to a channel's live events. Returns an unsubscribe function. */
  subscribe(channel: string, listener: BusListener): () => void {
    this.emitter.on(channel, listener);
    return () => {
      this.emitter.off(channel, listener);
    };
  }

  /**
   * Buffered events for a channel. When `afterId` is provided, only events
   * newer than it are returned (used to resume from `Last-Event-ID`).
   */
  getBufferedEvents(channel: string, afterId?: number): BusEvent[] {
    const buffer = this.buffers.get(channel) ?? [];
    if (afterId === undefined) return [...buffer];
    return buffer.filter((event) => event.id > afterId);
  }
}

/**
 * Process-wide singleton. The donation projector publishes to it; the SSE
 * controller subscribes to it. Both live in the same Node process.
 */
export const eventBus = new EventBus();
