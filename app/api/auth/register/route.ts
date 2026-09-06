import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { User } from '@/lib/models';
import { hash } from '@/lib/security';
import { setSession } from '@/lib/session';

export async function POST(req: Request) {
  try {
    const f = await req.formData();

    const name = String(f.get('name') || '').trim();
    const email = String(f.get('email') || '').trim().toLowerCase();
    const phone = String(f.get('phone') || '').trim();
    const password = String(f.get('password') || '');

console.log("REGISTER RAW FORM:", {
  name: f.get("name"),
  email: f.get("email"),
  phone: f.get("phone"),
});

console.log("REGISTER DATA:", {
  name,
  email,
  phone,
phoneNumber: phone,
});

    if (!name || !email || !phone || password.length < 8) {
      return NextResponse.json(
        { error: 'Invalid registration' },
        { status: 400 }
      );
    }

    await db();

    const existingEmail = await User.findOne({ email });

    if (existingEmail) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 409 }
      );
    }

    const existingPhone = await User.findOne({ phone });

    if (existingPhone) {
      return NextResponse.json(
        { error: 'Phone number already exists' },
        { status: 409 }
      );
    }

    const adminEmail = (process.env.ADMIN_EMAIL || '')
      .trim()
      .toLowerCase();

    const role =
      adminEmail && email === adminEmail
        ? 'admin'
        : 'customer';

    const passwordHash = await hash(password);

console.log("REGISTER PHONE:", phone);

    const user = await User.create({
  name,
  email,
  phone,
  phoneNumber: phone,
  passwordHash,
  role,
});

    // Keep the user logged in after registration.
    await setSession(String(user._id));

    // New users go directly to PIN setup.
    return NextResponse.redirect(
      new URL('/setup-pin', req.url)
    );
  } catch (error: any) {
    console.error('REGISTER ERROR:', error);

    if (error?.code === 11000) {
      if (error?.keyPattern?.email) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 409 }
        );
      }

      if (error?.keyPattern?.phone) {
        return NextResponse.json(
          { error: 'Phone number already exists' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
}