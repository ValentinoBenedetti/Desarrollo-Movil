import { Model, Query } from '@nozbe/watermelondb';
import { children, field, text } from '@nozbe/watermelondb/decorators';
import { TABLE_NAMES } from '../schema';
import type Diagnostic from './Diagnostic';
import type Installation from './Installation';

export default class Device extends Model {
  public static table = TABLE_NAMES.DEVICES;

  public static associations = {
    [TABLE_NAMES.DIAGNOSTICS]: { type: 'has_many' as const, foreignKey: 'device_id' },
    [TABLE_NAMES.INSTALLATIONS]: { type: 'has_many' as const, foreignKey: 'device_id' },
  };

  @text('ip') public ip!: string;
  @text('mac') public mac!: string;
  @text('hostname') public hostname!: string;
  @text('vendor') public vendor!: string;
  @text('serial_number') public serialNumber?: string;
  @text('equipment_model') public equipmentModel?: string;
  @field('last_seen') public lastSeen!: number;

  @children(TABLE_NAMES.DIAGNOSTICS) public diagnostics!: Query<Diagnostic>;
  @children(TABLE_NAMES.INSTALLATIONS) public installations!: Query<Installation>;
}

