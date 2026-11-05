import { Model, Relation } from '@nozbe/watermelondb';
import { field, immutableRelation, text } from '@nozbe/watermelondb/decorators';
import { InstallationStatus } from '../../../core/types';
import { TABLE_NAMES } from '../schema';
import type Device from './Device';

export default class Installation extends Model {
  public static table = TABLE_NAMES.INSTALLATIONS;

  public static associations = {
    [TABLE_NAMES.DEVICES]: { type: 'belongs_to' as const, key: 'device_id' },
  };

  @field('device_id') public deviceId!: string;
  @text('site_name') public siteName!: string;
  @text('technician_id') public technicianId!: string;
  @text('serial_number') public serialNumber!: string;
  @text('equipment_model') public equipmentModel!: string;
  @text('notes') public notes!: string;
  @field('latitude') public latitude!: number;
  @field('longitude') public longitude!: number;
  @text('photo_uri') public photoUri!: string;
  @text('pdf_uri') public pdfUri!: string;
  @text('status') public status!: InstallationStatus;
  @field('created_at') public createdAt!: number;

  @immutableRelation(TABLE_NAMES.DEVICES, 'device_id') public device!: Relation<Device>;
}

