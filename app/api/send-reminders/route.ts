import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');

// Supabase client with admin capabilities
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
  // 1. Verify Vercel Cron authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // 2. Retrieve registered user emails from Supabase Auth
    const { data: usersData, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const recipientEmails = usersData.users
      .map((user) => user.email)
      .filter((email): email is string => Boolean(email));

    if (recipientEmails.length === 0) {
      return NextResponse.json({ message: 'No registered users found.' });
    }

    // 3. Send reminder email to each registered user via Resend
    const emailPromises = recipientEmails.map((email) =>
      resend.emails.send({
        from: 'Financial Tracker <onboarding@resend.dev>',
        to: email,
        subject: "📌 Daily Reminder: Don't forget to log your spending!",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; max-width: 500px; margin: 0 auto; border: 1px solid #334155; border-radius: 12px; background-color: #0f172a; color: #f8fafc;">
            <h2 style="color: #10b981; margin-top: 0;">Daily Budget Check-in 👋</h2>
            <p style="font-size: 15px; line-height: 1.5; color: #cbd5e1;">
              Did you buy anything or make any transactions today?
            </p>
            <p style="font-size: 14px; line-height: 1.5; color: #94a3b8;">
              Take 30 seconds to record your income and expenses to keep your monthly budget accurate!
            </p>
            <div style="margin-top: 24px;">
              <a href="https://financial-tracker-nine-chi.vercel.app" 
                 style="background-color: #10b981; color: #022c22; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                 Open Money Planner
              </a>
            </div>
          </div>
        `,
      })
    );

    await Promise.all(emailPromises);

    return NextResponse.json({
      success: true,
      recipientsSent: recipientEmails.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}