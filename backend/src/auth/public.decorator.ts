import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route (or whole controller) as exempt from the global JwtAuthGuard,
 * e.g. /auth/register, /auth/login, /health.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
