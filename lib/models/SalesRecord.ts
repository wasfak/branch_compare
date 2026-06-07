import mongoose, { Schema, model, models } from "mongoose";

export interface SalesRecordDoc {
  code: string;
  itemName: string;
  company: string;
  quantity: number;
  revenue: number;
  profit: number;
  branch: string;
  periodStart: Date;
  periodEnd: Date;
  uploadedAt: Date;
}

const SalesRecordSchema = new Schema<SalesRecordDoc>({
  code: { type: String, required: true },
  itemName: { type: String, required: true },
  company: { type: String, required: true },
  quantity: { type: Number, required: true },
  revenue: { type: Number, required: true, default: 0 },
  profit: { type: Number, required: true, default: 0 },
  branch: { type: String, required: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  uploadedAt: { type: Date, default: Date.now },
});

SalesRecordSchema.index({ branch: 1, code: 1 });
SalesRecordSchema.index({ branch: 1, periodStart: 1, periodEnd: 1 });
SalesRecordSchema.index({ company: 1 });
SalesRecordSchema.index({ company: 1, branch: 1 });

export const SalesRecord =
  (models.SalesRecord as mongoose.Model<SalesRecordDoc>) ||
  model<SalesRecordDoc>("SalesRecord", SalesRecordSchema);
