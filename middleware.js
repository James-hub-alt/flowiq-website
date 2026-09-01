import { next } from '@vercel/functions';

export const config = {
  matcher: '/',
};

export default function middleware(request) {
  const country = request.headers.get('x-vercel-ip-country') || '';
  return next({
    headers: {
      'Set-Cookie': `flowiq_country=${country}; Path=/; Max-Age=86400; SameSite=Lax`,
    },
  });
}
