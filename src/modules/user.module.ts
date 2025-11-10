import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../models/user.schema';
import { UserService } from '../services/user.service';
import { UsersController } from '../controllers/user.controller';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/auth.guard';
import { OwnershipGuard } from '../auth/ownership.guard';
import { AdminGuard } from '../auth/admin_guard';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'ultra-secret-jwt-secret',
      signOptions: { expiresIn: '1d' }
    }),
  ],
  controllers: [UsersController],
  providers: [UserService, JwtAuthGuard, OwnershipGuard, AdminGuard],
  exports: [UserService]
})
export class UsersModule {}