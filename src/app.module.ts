import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from './config/config';
import { UsersModule } from './modules/user.module';
import { MqttModule } from './modules/mqtt.module';
import { CommandsController } from './controllers/commands.controlller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('database.uri'),
      }),
      inject: [ConfigService],
    }),

    UsersModule,
    MqttModule,
  ],
  controllers: [CommandsController],
})
export class AppModule {}