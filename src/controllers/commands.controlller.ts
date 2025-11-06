import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { MqttService } from 'src/services/mqtt.service';

class SendCommandDto {
  deviceId: string;
  command: string;
  payload?: any;
}

@Controller('commands')
export class CommandsController {
  constructor(private readonly mqttService: MqttService) {}

  @Post('send')
  async sendCommand(
    @Body() sendCommandDto: SendCommandDto,
    @Headers('x-api-key') apiKey: string
  ) {
    if (!apiKey) {
      throw new UnauthorizedException('API key required');
    }

    const success = await this.mqttService.sendCommand(
      sendCommandDto.deviceId,
      apiKey,
      sendCommandDto.command,
      sendCommandDto.payload
    );

    return {
      success,
      message: success ? 'Command sent successfully' : 'Failed to send command'
    };
  }

  @Post('enroll')
  async enrollFingerprint(
    @Body() body: { deviceId: string; fingerprintId: number },
    @Headers('x-api-key') apiKey: string
  ) {
    const success = await this.mqttService.sendCommand(
      body.deviceId,
      apiKey,
      'ENROLL',
      { fingerprintId: body.fingerprintId }
    );

    return {
      success,
      message: success ? 'Enrollment command sent' : 'Failed to send enrollment command'
    };
  }

  @Post('delete')
  async deleteFingerprint(
    @Body() body: { deviceId: string; fingerprintId: number },
    @Headers('x-api-key') apiKey: string
  ) {
    const success = await this.mqttService.sendCommand(
      body.deviceId,
      apiKey,
      'DELETE',
      { fingerprintId: body.fingerprintId }
    );

    return {
      success,
      message: success ? 'Delete command sent' : 'Failed to send delete command'
    };
  }

  @Post('emergency-lock')
  async emergencyLock(
    @Body() body: { deviceId: string },
    @Headers('x-api-key') apiKey: string
  ) {
    const success = await this.mqttService.sendCommand(
      body.deviceId,
      apiKey,
      'EMERGENCY_LOCK'
    );

    return {
      success,
      message: success ? 'Emergency lock command sent' : 'Failed to send lock command'
    };
  }
}