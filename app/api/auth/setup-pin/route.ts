import { NextResponse } from 'next/server';
import { currentUserId } from '@/lib/session';
import { db } from '@/lib/db';
import { User } from '@/lib/models';
import { hash } from '@/lib/security';

export async function POST(req: Request) {
  try {
    const id = await currentUserId();

    if (!id) {
      return NextResponse.redirect(
        new URL('/login', req.url)
      );
    }

    const f = await req.formData();

    const pin = String(f.get('pin') || '').trim();
    const confirm = String(f.get('confirm') || '').trim();

    if (!/^[0-9]{4}$/.test(pin)) {
      return NextResponse.json(
        { error: 'PIN must be exactly 4 digits' },
        { status: 400 }
      );
    }

    if (pin !== confirm) {
      return NextResponse.json(
        { error: 'PINs do not match' },
        { status: 400 }
      );
    }

    await db();

    const user = await User.findById(id);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (user.pinHash) {
      return NextResponse.json(
        {
          error: 'Transaction PIN has already been created',
        },
        { status: 400 }
      );
    }

    user.pinHash = await hash(pin);

    await user.save();

    // PIN created successfully.
    // The registration session is still active.
    return NextResponse.redirect(
      new URL('/dashboard', req.url)
    );
  } catch (error) {
    console.error('SETUP PIN ERROR:', error);

    return NextResponse.json(
      { error: 'Unable to create transaction PIN' },
      { status: 500 }
    );
  }
}