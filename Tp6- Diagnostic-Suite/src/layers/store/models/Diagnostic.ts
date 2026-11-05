import { Model, Relation } from '@nozbe/watermelondb';
import { field, immutableRelation, text } from '@nozbe/watermelondb/decorators';
import { SnmpDiagnosticSummary } from '../../../core/types';
import { TABLE_NAMES } from '../schema';
import type Device from './Device';

export default class Diagnostic extends Model {
  public static table = TABLE_NAMES.DIAGNOSTICS;

  public static associations = {
    [TABLE_NAMES.DEVICES]: { type: 'belongs_to' as const, key: 'device_id' },
  };

  @field('device_id') public deviceId!: string;
  @text('snmp_summary') public snmpSummaryRaw!: string;
  @text('ssh_output') public sshOutput!: string;
  @field('created_at') public createdAt!: number;

  @immutableRelation(TABLE_NAMES.DEVICES, 'device_id') public device!: Relation<Device>;

  public get parsedSnmpSummary(): SnmpDiagnosticSummary | null {
    if (!this.snmpSummaryRaw) {
      return null;
    }
    try {
      return JSON.parse(this.snmpSummaryRaw) as SnmpDiagnosticSummary;
    } catch {
      return null;
    }
  }
}

