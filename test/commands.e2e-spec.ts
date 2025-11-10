import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext, UnauthorizedException, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import request from 'supertest';
import { CommandsController } from 'src/controllers/commands.controlller';
import { MqttService } from 'src/services/mqtt.service';
import { FingerprintService } from 'src/services/fingerprint.service';
import { JwtAuthGuard } from 'src/auth/auth.guard';
import { AdminGuard } from 'src/auth/admin_guard';

const MOCK_USER_ID = '60d0fe4f346b7a001c9b6348';
const MOCK_FINGERPRINT_ID = 42;
const MOCK_DEVICE_ID = 'esp32-001';
const MOCK_API_KEY = 'test-device-api-key-123';

const mockFingerprintService = {
  claimNewFingerprintId: jest.fn().mockResolvedValue(MOCK_FINGERPRINT_ID),
  releaseFingerprintId: jest.fn().mockResolvedValue(undefined),
};

const mockMqttService = {
  sendCommand: jest.fn().mockResolvedValue(true),
};

// Mock JwtAuthGuard to pass through and set a user ID
const mockJwtAuthGuard = {
  canActivate: jest.fn((context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    request.user = { userId: MOCK_USER_ID, username: 'test_user', isAdmin: false };
    return true;
  }),
};

// Mock AdminGuard to pass for successful admin test
const mockAdminGuard = {
  canActivate: jest.fn(() => true),
};

// -----------------------------------------------------------------

describe('CommandsController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CommandsController],
      providers: [
        {
          provide: MqttService,
          useValue: mockMqttService,
        },
        {
          provide: FingerprintService,
          useValue: mockFingerprintService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(AdminGuard)
      .useValue(mockAdminGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /commands/send', () => {
    it('should successfully send a general command', async () => {
      mockMqttService.sendCommand.mockResolvedValueOnce(true);

      const response = await request(app.getHttpServer())
        .post('/commands/send')
        .set('Authorization', 'Bearer dummy-token')
        .set('x-api-key', MOCK_API_KEY)
        .send({
          deviceId: MOCK_DEVICE_ID,
          command: 'STATUS',
          payload: { timestamp: Date.now() },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockMqttService.sendCommand).toHaveBeenCalledWith(
        MOCK_DEVICE_ID,
        MOCK_API_KEY,
        'STATUS',
        { timestamp: expect.any(Number) },
      );
    });

    it('should return 401 if x-api-key is missing', async () => {
      await request(app.getHttpServer())
        .post('/commands/send')
        .set('Authorization', 'Bearer dummy-token')
        .send({
          deviceId: MOCK_DEVICE_ID,
          command: 'STATUS',
        })
        .expect(401); 
    });
  });

  describe('POST /commands/enroll', () => {
    it('should claim a new FID and send the ENROLL command', async () => {
      mockFingerprintService.claimNewFingerprintId.mockResolvedValueOnce(MOCK_FINGERPRINT_ID);
      mockMqttService.sendCommand.mockResolvedValueOnce(true);

      const response = await request(app.getHttpServer())
        .post('/commands/enroll')
        .set('Authorization', 'Bearer valid-token')
        .set('x-api-key', MOCK_API_KEY)
        .send({ deviceId: MOCK_DEVICE_ID })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.fingerprintId).toBe(MOCK_FINGERPRINT_ID);
      
      expect(mockFingerprintService.claimNewFingerprintId).toHaveBeenCalledWith(MOCK_USER_ID);
      
      expect(mockMqttService.sendCommand).toHaveBeenCalledWith(
        MOCK_DEVICE_ID,
        MOCK_API_KEY,
        'ENROLL',
        { fingerprintId: MOCK_FINGERPRINT_ID },
      );
    });

    it('should return 500 if fingerprint service fails to claim ID (e.g., storage full)', async () => {
      mockFingerprintService.claimNewFingerprintId.mockRejectedValueOnce(new ConflictException('Storage full')); 

      await request(app.getHttpServer())
        .post('/commands/enroll')
        .set('Authorization', 'Bearer valid-token')
        .set('x-api-key', MOCK_API_KEY)
        .send({ deviceId: MOCK_DEVICE_ID })
        .expect(409);
      expect(mockMqttService.sendCommand).not.toHaveBeenCalled();
    });
  });


  describe('DELETE /commands/fingerprint/:id', () => {
    it('should successfully release FID and send DELETE command', async () => {
      mockFingerprintService.releaseFingerprintId.mockResolvedValueOnce(undefined);
      
      const response = await request(app.getHttpServer())
        .delete(`/commands/fingerprint/${MOCK_FINGERPRINT_ID}`)
        .set('Authorization', 'Bearer valid-token')
        .set('x-api-key', MOCK_API_KEY)
        .send({ deviceId: MOCK_DEVICE_ID })
        .expect(200);

      expect(response.body.success).toBe(true);
      
      expect(mockFingerprintService.releaseFingerprintId).toHaveBeenCalledWith(
        MOCK_USER_ID, 
        MOCK_FINGERPRINT_ID
      );
      
      expect(mockMqttService.sendCommand).toHaveBeenCalledWith(
        MOCK_DEVICE_ID,
        MOCK_API_KEY,
        'DELETE',
        { fingerprintId: MOCK_FINGERPRINT_ID },
      );
    });
    
    it('should return 404 if the user does not own the FID', async () => {
      mockFingerprintService.releaseFingerprintId.mockRejectedValueOnce(
        new NotFoundException('Fingerprint ID not found or not owned.')
      );

      await request(app.getHttpServer())
        .delete(`/commands/fingerprint/${MOCK_FINGERPRINT_ID}`)
        .set('Authorization', 'Bearer valid-token')
        .set('x-api-key', MOCK_API_KEY)
        .send({ deviceId: MOCK_DEVICE_ID })
        .expect(404);
        
      expect(mockMqttService.sendCommand).not.toHaveBeenCalled();
    });

    it('should return 400 if the ID is not a number', async () => {
      await request(app.getHttpServer())
        .delete('/commands/fingerprint/invalid-id')
        .set('Authorization', 'Bearer valid-token')
        .set('x-api-key', MOCK_API_KEY)
        .send({ deviceId: MOCK_DEVICE_ID })
        .expect(400);

      expect(mockFingerprintService.releaseFingerprintId).not.toHaveBeenCalled();
      expect(mockMqttService.sendCommand).not.toHaveBeenCalled();
    });
  });

  describe('POST /commands/emergency-lock (Admin Required)', () => {
    it('should successfully send emergency lock command when authenticated and authorized', async () => {
      mockMqttService.sendCommand.mockResolvedValueOnce(true);
      
      const response = await request(app.getHttpServer())
        .post('/commands/emergency-lock')
        .set('Authorization', 'Bearer admin-token')
        .set('x-api-key', MOCK_API_KEY)
        .send({ deviceId: MOCK_DEVICE_ID })
        .expect(200);
        
      expect(mockAdminGuard.canActivate).toHaveBeenCalled();
      expect(response.body.success).toBe(true);
      expect(mockMqttService.sendCommand).toHaveBeenCalledWith(
        MOCK_DEVICE_ID,
        MOCK_API_KEY,
        'EMERGENCY_LOCK'
      );
    });
    
    it('should return 401 if JWT is missing', async () => {
      mockJwtAuthGuard.canActivate.mockReturnValueOnce(false); 
      
      await request(app.getHttpServer())
        .post('/commands/emergency-lock')
        .set('x-api-key', MOCK_API_KEY)
        .send({ deviceId: MOCK_DEVICE_ID })
        .expect(401);
    });
  });
});