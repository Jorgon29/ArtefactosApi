import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext, HttpCode, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { UsersController } from 'src/controllers/user.controller';
import { UserService } from 'src/services/user.service';
import { JwtAuthGuard } from '../src/auth/auth.guard';
import { OwnershipGuard } from '../src/auth/ownership.guard';

const MOCK_USER_ID = '60d0fe4f346b7a001c9b6348';
const OTHER_USER_ID = '60d0fe4f346b7a001c9b6349';
const MOCK_TOKEN = 'mock.jwt.token.12345';
const MOCK_NEW_USER_ID = 'new-user-id-123';

const mockUser = (id: string, name: string) => ({
  _id: id,
  name: name,
  password: 'hashedpassword',
  fingerprints: [],
});

const mockUserService = {
  create: jest.fn().mockImplementation((dto) => Promise.resolve(mockUser(MOCK_NEW_USER_ID, dto.name))),
  findAll: jest.fn().mockResolvedValue([
    mockUser(MOCK_USER_ID, 'Alice'),
    mockUser(OTHER_USER_ID, 'Bob'),
  ]),
  findById: jest.fn().mockImplementation((id) => {
    if (id === MOCK_USER_ID) return Promise.resolve(mockUser(MOCK_USER_ID, 'Alice'));
    return Promise.resolve(null);
  }),
  update: jest.fn().mockImplementation((id, dto) => Promise.resolve({ ...mockUser(id, 'Alice'), ...dto })),
  delete: jest.fn().mockResolvedValue(undefined),
  validateUser: jest.fn().mockImplementation((name, password) => {
    if (name === 'Alice' && password === 'correct') {
      return Promise.resolve(MOCK_TOKEN);
    }
    return Promise.resolve(null);
  }),
};

const mockJwtAuthGuard = {
  canActivate: jest.fn((context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    request.user = { userId: MOCK_USER_ID };
    return true;
  }),
};

const mockOwnershipGuard = {
    canActivate: jest.fn(() => true), 
};
// ------------------------------------

describe('UsersController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(OwnershipGuard)
      .useValue(mockOwnershipGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset ownership guard to pass by default
    mockOwnershipGuard.canActivate.mockReturnValue(true); 
    mockJwtAuthGuard.canActivate.mockReturnValue(true);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /users', () => {
    it('should successfully create a new user', async () => {
      const newUser = { name: 'Charlie', password: 'securepassword' };
      
      const response = await request(app.getHttpServer())
        .post('/users')
        .send(newUser)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Charlie');
      expect(mockUserService.create).toHaveBeenCalledWith(newUser);
    });

    it('should return success: false when UserService throws an error (e.g., duplicate name)', async () => {
      const error = new Error('Duplicate key error');
      mockUserService.create.mockRejectedValueOnce(error);

      const response = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Duplicate', password: 'p' })
        .expect(201);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Duplicate key error');
    });
  });
  
  describe('POST /users/auth/login', () => {
    it('should return a token on successful login', async () => {
      const response = await request(app.getHttpServer())
        .post('/users/auth/login')
        .send({ name: 'Alice', password: 'correct' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBe(MOCK_TOKEN);
      expect(mockUserService.validateUser).toHaveBeenCalled();
    });

    it('should return success: false on invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/users/auth/login')
        .send({ name: 'Alice', password: 'wrong' })
        .expect(201);

      expect(mockUserService.validateUser).toHaveBeenCalled();
      const failedResponse = await request(app.getHttpServer())
        .post('/users/auth/login')
        .send({ name: 'Alice', password: 'wrong' });
        
      expect(failedResponse.body.success).toBe(false);
      expect(failedResponse.body.error).toBe('Invalid credentials');
    });
  });

  describe('Auth Required Routes', () => {
    const testUnauthorized = (method: 'get' | 'put' | 'delete', path: string) => {
      it(`should return 401 Unauthorized for ${method.toUpperCase()} ${path} if no token is provided`, async () => {
        mockJwtAuthGuard.canActivate.mockImplementationOnce(() => {
            throw new UnauthorizedException(); 
        });

        await request(app.getHttpServer())
          [method](path)
          .expect(401);
      });
    };
    
    describe('GET /users', () => {
      testUnauthorized('get', '/users');
      
      it('should return a list of all users when authenticated', async () => {
        const response = await request(app.getHttpServer())
          .get('/users')
          .set('Authorization', 'Bearer token')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.length).toBe(2);
        expect(response.body.data[0].name).toBe('Alice');
        expect(mockUserService.findAll).toHaveBeenCalled();
      });
    });

    describe('GET /users/:id', () => {
      testUnauthorized('get', `/users/${MOCK_USER_ID}`);

      it('should return user details for a found user', async () => {
        const response = await request(app.getHttpServer())
          .get(`/users/${MOCK_USER_ID}`)
          .set('Authorization', 'Bearer token')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(MOCK_USER_ID);
        expect(mockUserService.findById).toHaveBeenCalledWith(MOCK_USER_ID);
      });

      it('should return success: false for a user not found', async () => {
        await request(app.getHttpServer())
          .get(`/users/${OTHER_USER_ID}`)
          .set('Authorization', 'Bearer token')
          .expect(200); 

        const failedResponse = await request(app.getHttpServer())
          .get(`/users/${OTHER_USER_ID}`)
          .set('Authorization', 'Bearer token');
          
        expect(failedResponse.body.success).toBe(false);
        expect(failedResponse.body.error).toBe('User not found');
      });
    });
  });

  describe('Ownership Required Routes (PUT/DELETE)', () => {
    // --- /users/:id (PUT) - Update User ---
    describe('PUT /users/:id', () => {
      testUnauthorized('put', `/users/${MOCK_USER_ID}`);

      it('should update the user when OwnershipGuard passes', async () => {
        const updateDto = { name: 'Alice_New' };
        
        const response = await request(app.getHttpServer())
          .put(`/users/${MOCK_USER_ID}`)
          .set('Authorization', 'Bearer token')
          .send(updateDto)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('Alice_New');
        expect(mockUserService.update).toHaveBeenCalledWith(MOCK_USER_ID, updateDto);
        expect(mockOwnershipGuard.canActivate).toHaveBeenCalledTimes(1);
      });

      it('should return 403 Forbidden when OwnershipGuard blocks the action', async () => {
        mockOwnershipGuard.canActivate.mockImplementationOnce(() => {
             throw new ForbiddenException(); 
        });

        await request(app.getHttpServer())
          .put(`/users/${OTHER_USER_ID}`)
          .set('Authorization', 'Bearer token')
          .send({ name: 'Hacker' })
          .expect(403);
          
        expect(mockUserService.update).not.toHaveBeenCalled();
      });
    });

    // --- /users/:id (DELETE) - Remove User ---
    describe('DELETE /users/:id', () => {
      testUnauthorized('delete', `/users/${MOCK_USER_ID}`);

      it('should delete the user when OwnershipGuard passes', async () => {
        await request(app.getHttpServer())
          .delete(`/users/${MOCK_USER_ID}`)
          .set('Authorization', 'Bearer token')
          .expect(200);

        expect(mockUserService.delete).toHaveBeenCalledWith(MOCK_USER_ID);
        expect(mockOwnershipGuard.canActivate).toHaveBeenCalledTimes(1);
      });

      it('should return 403 Forbidden when OwnershipGuard blocks the action', async () => {
        mockOwnershipGuard.canActivate.mockImplementationOnce(() => {
             throw new ForbiddenException();
        });

        await request(app.getHttpServer())
          .delete(`/users/${OTHER_USER_ID}`)
          .set('Authorization', 'Bearer token')
          .expect(403);
          
        expect(mockUserService.delete).not.toHaveBeenCalled();
      });
    });
  });
});