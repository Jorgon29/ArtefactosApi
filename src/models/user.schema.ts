import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as bcrypt from 'bcrypt';

export interface UserMethods {
  validatePassword(candidatePassword: string): Promise<boolean>;
}

export type UserDocument = User & Document & UserMethods;

@Schema()
export class User {
    @Prop({ 
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    minlength: 3,
    maxlength: 30 
  })
  name: string;

  @Prop({ required: true })
  password: string;

  @Prop([Number])
  fingerprints: number[];
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.pre('save', async function(this: UserDocument, next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

UserSchema.methods.validatePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};