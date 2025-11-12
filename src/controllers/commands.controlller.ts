import { Controller, Post, Body, Headers, UnauthorizedException, UseGuards, Delete, Param, BadRequestException } from '@nestjs/common';
import { MqttService } from '../services/mqtt.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { User } from '../auth/user.decorator';
import { FingerprintService } from '../services/fingerprint.service';
import { AdminGuard } from '../auth/admin_guard';

class SendCommandDto {
  deviceId: string;
  command: string;
  payload?: any;
}

@Controller('commands')
export class CommandsController {
  constructor(private readonly mqttService: MqttService, private fingerprintService: FingerprintService) {}

  @UseGuards(JwtAuthGuard)
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

  @UseGuards(JwtAuthGuard)
  @Post('enroll')
  async enrollFingerprint(
    @Body() body: { deviceId: string; },
    @Headers('x-api-key') apiKey: string,
    @User('userId') userId: string,
  ) {
    const fingerprintId = await this.fingerprintService.claimNewFingerprintId(userId);
    const success = await this.mqttService.sendCommand(
      body.deviceId,
      apiKey,
      'ENROLL',
      { fingerprintId: fingerprintId }
    );

    return {
      success,
      message: success ? 'Enrollment command sent' : 'Failed to send enrollment command'
    };
  }

@UseGuards(JwtAuthGuard)
  @Delete('fingerprint/:id')
  async deleteFingerprint(
    @Body() body: { deviceId: string; },
    @Headers('x-api-key') apiKey: string,
    @Param('id') id: string,
    @User('userId') userId: string,
  ) {
    const fingerprintId = parseInt(id, 10);
    if (isNaN(fingerprintId)) {
        throw new BadRequestException('Invalid fingerprint ID format.');
    }
    await this.fingerprintService.releaseFingerprintId(userId, fingerprintId);
    const success = await this.mqttService.sendCommand(
      body.deviceId,
      apiKey,
      'DELETE',
      { fingerprintId: fingerprintId }
    );
    return {
      success,
      message: success 
        ? `Delete command sent for FID ${fingerprintId}. ID has been released in DB.` 
        : `Failed to send delete command. ID ${fingerprintId} has been released in DB.`
    };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
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