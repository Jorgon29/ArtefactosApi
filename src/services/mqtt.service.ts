import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';

interface AppConfig {
  mqtt: {
    url: string;
    username: string;
    password: string;
  };
  esp32: {
    apiKeys: Record<string, string>;
  };
}

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: mqtt.MqttClient;
  private readonly esp32ApiKeys = new Map<string, string>();

  constructor(private configService: ConfigService<AppConfig>) {
    const apiKeys = this.configService.get('esp32.apiKeys', { infer: true });
    
    if (apiKeys) {
      Object.entries(apiKeys).forEach(([deviceId, apiKey]) => {
        if (apiKey) {
          this.esp32ApiKeys.set(deviceId, apiKey);
          this.logger.log(`Registered device: ${deviceId}`);
        }
      });
    }
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    this.client?.end();
  }

  private async connect() {
    const mqttConfig = this.configService.get('mqtt', { infer: true });
    
    if (!mqttConfig) {
      this.logger.error('MQTT configuration not found');
      return;
    }

    const options: mqtt.IClientOptions = {
      port: 1883,
    };

    if (mqttConfig.username && mqttConfig.password) {
      options.username = mqttConfig.username;
      options.password = mqttConfig.password;
    }

    this.client = mqtt.connect(mqttConfig.url, options);

    this.client.on('connect', () => {
      this.logger.log('Connected to MQTT broker');
      
      this.client.subscribe('esp32/+/response', (err) => {
        if (!err) this.logger.log('📡 Subscribed to ESP32 responses');
      });
    });

    this.client.on('error', (error) => {
      this.logger.error('MQTT error:', error);
    });

    this.client.on('message', (topic, message) => {
      this.handleIncomingMessage(topic, message.toString());
    });
  }

  private handleIncomingMessage(topic: string, message: string) {
    this.logger.debug(`MQTT message: ${topic} - ${message}`);
    
    if (topic.startsWith('esp32/') && topic.endsWith('/response')) {
      const deviceId = topic.split('/')[1];
      this.logger.log(`Response from ${deviceId}: ${message}`);
    }
  }

  async sendCommand(deviceId: string, apiKey: string, command: string, payload?: any): Promise<boolean> {
    if (!this.validateApiKey(deviceId, apiKey)) {
      this.logger.error(`Invalid API key for device: ${deviceId}`);
      return false;
    }

    const topic = `esp32/${deviceId}/command`;
    const message = JSON.stringify({
      command,
      payload,
      timestamp: new Date().toISOString()
    });

    return new Promise((resolve) => {
      this.client.publish(topic, message, (error) => {
        if (error) {
          this.logger.error(`Failed to send command to ${deviceId}:`, error);
          resolve(false);
        } else {
          this.logger.log(`Command sent to ${deviceId}: ${command}`);
          resolve(true);
        }
      });
    });
  }

  private validateApiKey(deviceId: string, apiKey: string): boolean {
    const storedKey = this.esp32ApiKeys.get(deviceId);
    return storedKey === apiKey;
  }

  registerDevice(deviceId: string, apiKey: string) {
    this.esp32ApiKeys.set(deviceId, apiKey);
    this.logger.log(`Registered device: ${deviceId}`);
  }
}