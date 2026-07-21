import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { Server } from 'node:http';
import request from 'supertest';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { AuthenticatedUser } from './jwt-payload.interface';

const TEST_SECRET = 'test-jwt-secret';

@Controller('test')
class ProtectedTestController {
  @Get('protected')
  getProtected() {
    return { ok: true };
  }

  @Public()
  @Get('public')
  getPublic() {
    return { ok: true };
  }
}

describe('JwtAuthGuard', () => {
  describe('isPublic bypass (unit)', () => {
    it('allows the request through without invoking passport when the route is @Public()', () => {
      const reflector = new Reflector();
      const guard = new JwtAuthGuard(reflector);
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      const context = {
        getHandler: () => ({}),
        getClass: () => ({}),
      } as never;

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('protected routes (integration, mocked AuthService — no real DB)', () => {
    let app: INestApplication;
    let httpServer: Server;
    let jwtService: JwtService;
    const mockUser: AuthenticatedUser = {
      id: 'user-1',
      email: 'hr@acme.com',
      name: 'Priya HR',
      createdAt: new Date(),
    };
    const authService = {
      validateUserById: jest.fn(),
    };

    beforeAll(async () => {
      process.env.JWT_SECRET = TEST_SECRET;

      @Module({
        imports: [
          PassportModule,
          JwtModule.register({
            secret: TEST_SECRET,
            signOptions: { expiresIn: '1h' },
          }),
        ],
        controllers: [ProtectedTestController],
        providers: [
          JwtStrategy,
          { provide: AuthService, useValue: authService },
          { provide: APP_GUARD, useClass: JwtAuthGuard },
        ],
      })
      class TestModule {}

      const moduleRef = await Test.createTestingModule({
        imports: [TestModule],
      }).compile();

      app = moduleRef.createNestApplication();
      jwtService = moduleRef.get(JwtService);
      await app.init();
      httpServer = app.getHttpServer() as Server;
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    afterAll(async () => {
      await app.close();
    });

    it('rejects a request with no Authorization header', async () => {
      await request(httpServer).get('/test/protected').expect(401);
    });

    it('rejects a request with a malformed/invalid token', async () => {
      await request(httpServer)
        .get('/test/protected')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);
    });

    it('rejects a valid token whose user no longer exists', async () => {
      authService.validateUserById.mockResolvedValue(null);
      const token = await jwtService.signAsync({
        sub: mockUser.id,
        email: mockUser.email,
      });

      await request(httpServer)
        .get('/test/protected')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('allows a request with a valid token for an existing user', async () => {
      authService.validateUserById.mockResolvedValue(mockUser);
      const token = await jwtService.signAsync({
        sub: mockUser.id,
        email: mockUser.email,
      });

      await request(httpServer)
        .get('/test/protected')
        .set('Authorization', `Bearer ${token}`)
        .expect(200, { ok: true });
    });

    it('allows a request to a @Public() route with no token', async () => {
      await request(httpServer).get('/test/public').expect(200, {
        ok: true,
      });
    });
  });
});
