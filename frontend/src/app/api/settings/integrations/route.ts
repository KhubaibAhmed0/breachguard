import { NextResponse } from 'next/server';

let currentSettings = {
  slack_webhook_url: 'https://example.com',
  siem_webhook_url: 'https://siem.corp.internal/api/v1/alerts',
  logo_url: '',
};

export async function GET() {
  return NextResponse.json(currentSettings);
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    if (body.slack_webhook_url !== undefined) {
      currentSettings.slack_webhook_url = body.slack_webhook_url;
    }
    if (body.siem_webhook_url !== undefined) {
      currentSettings.siem_webhook_url = body.siem_webhook_url;
    }
    return NextResponse.json({
      status: 'success',
      ...currentSettings,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to update integrations' }, { status: 400 });
  }
}
