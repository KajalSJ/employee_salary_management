import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      // Fails fast with a clear message instead of letting pg attempt to
      // connect with an undefined connection string, which surfaces later
      // as an opaque "client password must be a string" SASL error on the
      // first query rather than at startup.
      throw new Error(
        'DATABASE_URL is not set. Copy backend/.env.example to backend/.env and fill in a real connection string.',
      );
    }
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
