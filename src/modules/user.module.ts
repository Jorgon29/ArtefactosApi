import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../models/user.schema';
import { UserService } from '../services/user.service';
import { UsersController } from '../controllers/user.controller';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/auth.guard';
import { OwnershipGuard } from '../auth/ownership.guard';
import { AdminGuard } from '../auth/admin_guard';
import { FingerprintService } from '../services/fingerprint.service';
import { Fingerprint, FingerprintSchema } from '../models/fingerprint.schema';
import { MqttService } from '../services/mqtt.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema },{ name: Fingerprint.name, schema: FingerprintSchema}]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'ultra-secret-jwt-secret',
      signOptions: { expiresIn: '1d' }
    }),
  ],
  controllers: [UsersController],
  providers: [UserService, JwtAuthGuard, OwnershipGuard, AdminGuard, FingerprintService, MqttService],
  exports: [
    UserService,
    JwtModule,
    JwtAuthGuard,
    OwnershipGuard,
    AdminGuard,
    FingerprintService
  ]
})
export class UsersModule {}