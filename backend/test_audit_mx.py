import dns.resolver
from services.client_hunter_service import INDUSTRY_CONFIGS

res = dns.resolver.Resolver()
res.nameservers = ['8.8.8.8', '1.1.1.1']

for ind_key, cfg in INDUSTRY_CONFIGS.items():
    label = cfg['label']
    print(f"\n=== {label} ===")
    for t in cfg['real_targets']:
        domain = t['domain']
        email = t['email']
        comp = t['company']
        try:
            answers = res.resolve(domain, 'MX')
            mx_hosts = [r.exchange.to_text().lower() for r in answers]
            is_parked = any('secureserver' in m or 'parking' in m for m in mx_hosts)
            if is_parked:
                print(f"  [PARKED MX] {comp}: {domain} -> {mx_hosts[0]}")
            else:
                print(f"  [VALID MX]  {comp}: {email} via {mx_hosts[0][:35]}")
        except Exception as e:
            print(f"  [NO MX]     {comp}: {domain} -> {e}")
