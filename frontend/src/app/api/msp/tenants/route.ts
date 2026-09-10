import { NextResponse } from 'next/server';

let tenantsList = [
  {
    id: 'primary',
    name: 'Acme MSP (Primary)',
    type: 'primary',
    plan: 'Enterprise / MSP',
    domain_count: 3,
    exposure_count: 18,
    created_at: '2023-01-01T00:00:00Z',
  },
  {
    id: 'client-1',
    name: 'Client: MedTech Clinic',
    type: 'client',
    plan: 'Business Client',
    domain_count: 2,
    exposure_count: 7,
    created_at: '2023-08-15T00:00:00Z',
  },
  {
    id: 'client-2',
    name: 'Client: Apex Law',
    type: 'client',
    plan: 'Business Client',
    domain_count: 1,
    exposure_count: 4,
    created_at: '2023-09-20T00:00:00Z',
  },
];

export async function GET() {
  return NextResponse.json(tenantsList);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawName = body.name || 'New Client Organization';
    const name = rawName.startsWith('Client:') ? rawName : `Client: ${rawName}`;
    const newTenant = {
      id: `client-${Date.now()}`,
      name,
      type: 'client',
      plan: 'Business Client',
      domain_count: body.primary_domain ? 1 : 0,
      exposure_count: 0,
      created_at: new Date().toISOString(),
    };
    tenantsList.push(newTenant);
    return NextResponse.json(newTenant);
  } catch {
    return NextResponse.json({ error: 'Failed to create tenant' }, { status: 400 });
  }
}
