import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get('provider');

    if (!provider) {
      return NextResponse.json({ error: 'Missing provider' }, { status: 400 });
    }

    // Redirect to NextAuth native sign-in endpoint for the provider
    // Specifying callbackUrl to redirect back to connectors page after authentication completes
    const redirectUrl = new URL(`/api/auth/signin/${provider}`, req.url);
    redirectUrl.searchParams.set('callbackUrl', '/connectors');
    
    return NextResponse.redirect(redirectUrl);
  } catch (err: any) {
    console.error('OAuth connection redirect failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
