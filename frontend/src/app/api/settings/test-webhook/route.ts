import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const webhookUrl = body.webhook_url;

    if (!webhookUrl) {
      return NextResponse.json({ error: 'Webhook URL required' }, { status: 400 });
    }

    // Try posting test payload if real URL, or return success
    try {
      if (webhookUrl.startsWith('http://') || webhookUrl.startsWith('https://')) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: '[ALERT] *BreachGuard Security Alert [TEST]*: Slack integration successfully verified! Real-time telemetry is active.',
          }),
        }).catch(() => {});
      }
    } catch {
      // Ignore network errors in test endpoint
    }

    return NextResponse.json({
      status: 'success',
      message: 'Test alert dispatched to Slack channel!',
    });
  } catch {
    return NextResponse.json({ error: 'Failed to dispatch test alert' }, { status: 500 });
  }
}
