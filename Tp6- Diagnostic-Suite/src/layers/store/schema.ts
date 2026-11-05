import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const TABLE_NAMES = {
  DEVICES: 'devices',
  DIAGNOSTICS: 'diagnostics',
  INSTALLATIONS: 'installations',
  OUTBOX_QUEUE: 'outbox_queue',
} as const;

export const databaseSchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: TABLE_NAMES.DEVICES,
      columns: [
        { name: 'ip', type: 'string', isIndexed: true },
        { name: 'mac', type: 'string' },
        { name: 'hostname', type: 'string' },
        { name: 'vendor', type: 'string' },
        { name: 'serial_number', type: 'string', isOptional: true },
        { name: 'equipment_model', type: 'string', isOptional: true },
        { name: 'last_seen', type: 'number' },
      ],
    }),
    tableSchema({
      name: TABLE_NAMES.DIAGNOSTICS,
      columns: [
        { name: 'device_id', type: 'string', isIndexed: true },
        { name: 'snmp_summary', type: 'string' },
        { name: 'ssh_output', type: 'string' },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: TABLE_NAMES.INSTALLATIONS,
      columns: [
        { name: 'device_id', type: 'string', isIndexed: true },
        { name: 'site_name', type: 'string' },
        { name: 'technician_id', type: 'string' },
        { name: 'serial_number', type: 'string' },
        { name: 'equipment_model', type: 'string' },
        { name: 'notes', type: 'string' },
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
        { name: 'photo_uri', type: 'string' },
        { name: 'pdf_uri', type: 'string' },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: TABLE_NAMES.OUTBOX_QUEUE,
      columns: [
        { name: 'event_type', type: 'string', isIndexed: true },
        { name: 'payload', type: 'string' },
        { name: 'attempts', type: 'number' },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'last_error', type: 'string', isOptional: true },
        { name: 'next_retry_at', type: 'number', isIndexed: true },
        { name: 'created_at', type: 'number' },
      ],
    }),
  ],
});

