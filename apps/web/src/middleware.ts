import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const target = legacyNotificationTarget(request.nextUrl.pathname);
  if (!target) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = target.pathname;
  url.search = target.search;
  return NextResponse.redirect(url);
}

function legacyNotificationTarget(pathname: string): { pathname: string; search: string } | null {
  const productQuestion = pathname.match(/^\/products\/([^/]+)\/questions\/([^/]+)$/);
  if (productQuestion) return inboxTarget(productQuestion[1]!, productQuestion[2]!);

  const singularProductQuestion = pathname.match(/^\/product\/([^/]+)\/questions\/([^/]+)$/);
  if (singularProductQuestion)
    return inboxTarget(singularProductQuestion[1]!, singularProductQuestion[2]!);

  const question = pathname.match(/^\/questions\/([^/]+)$/);
  if (question) return inboxTarget(null, question[1]!);

  const singularProduct = pathname.match(/^\/product\/([^/]+)(?:\/(ask|own))?$/);
  if (singularProduct) {
    const suffix = singularProduct[2] ? `/${singularProduct[2]}` : '';
    return {
      pathname: `/products/${encodeURIComponent(singularProduct[1]!)}${suffix}`,
      search: '',
    };
  }

  return null;
}

function inboxTarget(
  productId: string | null,
  questionId: string,
): { pathname: string; search: string } {
  const params = new URLSearchParams();
  if (productId) params.set('product', productId);
  params.set('question', questionId);
  return { pathname: '/me/inbox', search: `?${params.toString()}` };
}

export const config = {
  matcher: ['/questions/:path*', '/products/:id/questions/:path*', '/product/:path*'],
};
