import { Test } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

type PrismaMock = {
  hRUser: {
    findUnique: jest.Mock;
    create: jest.Mock;
  };
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaMock;
  let jwtService: { signAsync: jest.Mock };

  beforeEach(async () => {
    prisma = {
      hRUser: { findUnique: jest.fn(), create: jest.fn() },
    };
    jwtService = { signAsync: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const dto = {
      email: 'hr@acme.com',
      password: 'correct-horse-battery-staple',
      name: 'Priya HR',
    };

    it('hashes the password before storing it, and never returns the hash', async () => {
      let capturedPasswordHash = '';
      prisma.hRUser.findUnique.mockResolvedValue(null);
      prisma.hRUser.create.mockImplementation(
        (args: {
          data: { email: string; passwordHash: string; name: string };
        }) => {
          capturedPasswordHash = args.data.passwordHash;
          return Promise.resolve({
            id: 'user-1',
            email: args.data.email,
            passwordHash: args.data.passwordHash,
            name: args.data.name,
            createdAt: new Date(),
          });
        },
      );

      const result = await service.register(dto);

      expect(capturedPasswordHash).not.toBe(dto.password);
      await expect(
        bcrypt.compare(dto.password, capturedPasswordHash),
      ).resolves.toBe(true);
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).toEqual(
        expect.objectContaining({ email: dto.email, name: dto.name }),
      );
    });

    it('throws ConflictException when the email is already registered', async () => {
      prisma.hRUser.findUnique.mockResolvedValue({
        id: 'existing',
        email: dto.email,
        passwordHash: 'irrelevant',
        name: 'Existing User',
        createdAt: new Date(),
      });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(prisma.hRUser.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const email = 'hr@acme.com';
    const password = 'correct-horse-battery-staple';

    it('returns an access token for correct credentials', async () => {
      const passwordHash = await bcrypt.hash(password, 10);
      prisma.hRUser.findUnique.mockResolvedValue({
        id: 'user-1',
        email,
        passwordHash,
        name: 'Priya HR',
        createdAt: new Date(),
      });
      jwtService.signAsync.mockResolvedValue('signed.jwt.token');

      const result = await service.login({ email, password });

      expect(result).toEqual({ accessToken: 'signed.jwt.token' });
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: 'user-1',
        email,
      });
    });

    it('throws UnauthorizedException for a wrong password', async () => {
      const passwordHash = await bcrypt.hash('a-different-password', 10);
      prisma.hRUser.findUnique.mockResolvedValue({
        id: 'user-1',
        email,
        passwordHash,
        name: 'Priya HR',
        createdAt: new Date(),
      });

      await expect(service.login({ email, password })).rejects.toThrow(
        UnauthorizedException,
      );
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException for an unknown email', async () => {
      prisma.hRUser.findUnique.mockResolvedValue(null);

      await expect(service.login({ email, password })).rejects.toThrow(
        UnauthorizedException,
      );
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('validateUserById', () => {
    it('returns a sanitized user (no passwordHash) when found', async () => {
      prisma.hRUser.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'hr@acme.com',
        passwordHash: 'hash',
        name: 'Priya HR',
        createdAt: new Date(),
      });

      const result = await service.validateUserById('user-1');

      expect(result).not.toHaveProperty('passwordHash');
      expect(result).toEqual(
        expect.objectContaining({ id: 'user-1', email: 'hr@acme.com' }),
      );
    });

    it('returns null when the user no longer exists', async () => {
      prisma.hRUser.findUnique.mockResolvedValue(null);

      await expect(service.validateUserById('missing')).resolves.toBeNull();
    });
  });
});
