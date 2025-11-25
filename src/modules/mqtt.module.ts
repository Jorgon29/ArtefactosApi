import { Module } from '@nestjs/common';
import { MqttService } from '../services/mqtt.service';
import { ConfigModule } from '@nestjs/config';
import { FingerprintService } from '../services/fingerprint.service';
import { UsersModule } from './user.module';
import { Fingerprint, FingerprintDocument, FingerprintSchema } from '../models/fingerprint.schema';
import { Model } from 'mongoose';
import { UserDocument, UserSchema } from '../models/user.schema';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    MongooseModule.forFeature([
      { name: 'Fingerprint', schema: FingerprintSchema },
      { name: 'User', schema: UserSchema },
    ]),
  ],
  providers: [MqttService, FingerprintService],
  exports: [MqttService, FingerprintService]
})
export class MqttModule {}