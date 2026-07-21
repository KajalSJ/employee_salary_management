import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser, JwtPayload } from './jwt-payload.interface';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthenticatedUser> {
    const existing = await this.prisma.hRUser.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException(
        `An HR user with email "${dto.email}" already exists`,
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.hRUser.create({
      data: { email: dto.email, passwordHash, name: dto.name },
    });

    return this.toAuthenticatedUser(user);
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const user = await this.prisma.hRUser.findUnique({
      where: { email: dto.email },
    });

    // Same error for "no such user" and "wrong password" so a caller can't
    // use the response to enumerate registered emails.
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: JwtPayload = { sub: user.id, email: user.email };
    return { accessToken: await this.jwtService.signAsync(payload) };
  }

  async validateUserById(id: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.hRUser.findUnique({ where: { id } });
    return user ? this.toAuthenticatedUser(user) : null;
  }

  private toAuthenticatedUser(user: {
    id: string;
    email: string;
    name: string;
    createdAt: Date;
  }): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }
}
