import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';
import { OutboxEventType, OutboxItemStatus } from '../../../core/types';
import { TABLE_NAMES } from '../schema';

export default class OutboxItem extends Model {
  public static table = TABLE_NAMES.OUTBOX_QUEUE;

  @text('event_type') public eventType!: OutboxEventType;
  @text('payload') public payloadRaw!: string;
  @field('attempts') public attempts!: number;
  @text('status') public status!: OutboxItemStatus;
  @text('last_error') public lastError?: string;
  @field('next_retry_at') public nextRetryAt!: number;
  @field('created_at') public createdAt!: number;

  public get parsedPayload(): Record<string, unknown> {
    try {
      return JSON.parse(this.payloadRaw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}

