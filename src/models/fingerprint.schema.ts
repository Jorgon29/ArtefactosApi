import { Prop, SchemaFactory, Schema } from "@nestjs/mongoose";
import mongoose, { Document } from "mongoose";

export type FingerprintDocument = Fingerprint & Document;

@Schema()
export class Fingerprint {
  @Prop({
    required: true,
    unique: true,
    min: 0,
    max: 999
  })
  id: number;

  @Prop({ required: true, ref: 'User' })
  userId: mongoose.Schema.Types.ObjectId;
}

export const FingerprintSchema = SchemaFactory.createForClass(Fingerprint);