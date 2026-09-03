import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { User } from '@/lib/models';
import { setSession } from '@/lib/session';
import { verify } from '@/lib/security';

export async function POST(req: Request) {
  try {
    const f = await req.formData();

    const identifier = String(
      f.get('identifier') || ''
    ).trim();

    const password = String(
      f.get('password') || ''
    );

    if (!identifier || !password) {
      return NextResponse.json(
        {
          error: 'Email/phone and password are required',
        },
        { status: 400 }
      );
    }

    await db();

    const normalizedIdentifier = identifier.toLowerCase();

    const user = await User.findOne({
      $or: [
        {
          email: normalizedIdentifier,
        },
        {
          phoneNumber: identifier,
        },
      ],
    });

    if (!user) {
      return NextResponse.json(
        {
          error: 'Invalid email/phone or password',
        },
        { status: 401 }
      );
    }

    const validPassword = await verify(
      password,
      user.passwordHash
    );

    if (!validPassword) {
      return NextResponse.json(
        {
          error: 'Invalid email/phone or password',
        },
        { status: 401 }
      );
    }

    await setSession(String(user._id));

    return NextResponse.redirect(
      new URL('/dashboard', req.url)
    );
  } catch (error) {
    console.error('LOGIN ERROR:', error);

    return NextResponse.json(
      { error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}