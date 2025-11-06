import { Module } from '@nestjs/common';
import { MqttService } from 'src/services/mqtt.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [MqttService],
  exports: [MqttService]
})
export class MqttModule {}