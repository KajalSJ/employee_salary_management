import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // Fails fast at startup rather than letting every request 401 with no
  // explanation — mirrors PrismaService's DATABASE_URL check.
  throw new Error(
    'JWT_SECRET is not set. Copy backend/.env.example to backend/.env and fill in a real secret.',
  );
}

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: JWT_SECRET,
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
