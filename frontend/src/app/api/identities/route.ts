import { NextResponse } from 'next/server';

let mockIdentities = [
  { id: '1', domain_id: 1, domain: 'acme-corp.com', email: 'ciso@acme-corp.com', role: 'Chief Information Security Officer', status: 'monitored', created_at: '2024-01-15T08:30:00Z', is_vip: true },
  { id: '2', domain_id: 1, domain: 'acme-corp.com', email: 'devops-lead@acme-corp.com', role: 'DevOps & Cloud Administrator', status: 'monitored', created_at: '2024-01-20T11:15:00Z', is_vip: true },
  { id: '3', domain_id: 1, domain: 'acme-corp.com', email: 'finance-dir@acme-corp.com', role: 'Executive / Finance Director', status: 'monitored', created_at: '2024-02-01T14:45:00Z', is_vip: true },
];

export async function GET() {
  return NextResponse.json(mockIdentities);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newId = String(Date.now());
    const newEntry = {
      id: newId,
      domain_id: body.domain_id || 1,
      domain: body.domain || 'acme-corp.com',
      email: body.email,
      role: body.role || 'Privileged Identity',
      status: 'monitored',
      created_at: new Date().toISOString(),
      is_vip: true,
    };
    mockIdentities.push(newEntry);
    return NextResponse.json(newEntry);
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
