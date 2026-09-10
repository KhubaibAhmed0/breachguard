import logging
import asyncio
import httpx
from typing import List, Dict, Any
from core.config import settings

logger = logging.getLogger(__name__)

async def check_email(email: str) -> List[Dict[str, Any]]:
    """
    Check an email against LeakCheck API.
    """
    is_pro = bool(settings.LEAKCHECK_API_KEY)
    
    if is_pro:
        url = f"https://leakcheck.io/api/v2/query/{email}"
        headers = {"X-API-Key": settings.LEAKCHECK_API_KEY, "User-Agent": "BreachGuard-App/1.0"}
    else:
        url = f"https://leakcheck.io/api/public?check={email}"
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers, timeout=15.0)
            if response.status_code == 200:
                data = response.json()
                if not data.get("success"):
                    if data.get("error") == "Not found":
                        return []
                    logger.error(f"LeakCheck API returned error: {data.get('error')}")
                    return []
                
                results = data.get("sources", []) if not is_pro else data.get("result", [])
                normalized = []
                for r in results:
                    source = r.get("name") if not is_pro else r.get("sources", ["Unknown"])[0]
                    
                    # Smart classification based on source
                    is_stealer = "stealer" in source.lower() or "malware" in source.lower()
                    if is_stealer:
                        source_type = "stealer_log"
                        cred_type = "plaintext"
                        data_classes = ["Email", "Passwords", "Browser Cookies"]
                    else:
                        source_type = "breach"
                        cred_type = "plaintext" if is_pro and "password" in r and not r.get("hashed") else "hashed"
                        data_classes = ["Email", "Passwords"] if "password" in r or not is_pro else ["Email"]

                    # Sanitize sensitive fields before storage
                    sanitized_r = dict(r) if isinstance(r, dict) else {}
                    if "password" in sanitized_r and sanitized_r["password"]:
                        p = str(sanitized_r["password"])
                        sanitized_r["password"] = f"{p[:2]}****{p[-1]}" if len(p) > 3 else "****"
                    if "hash" in sanitized_r and sanitized_r["hash"]:
                        h = str(sanitized_r["hash"])
                        sanitized_r["hash"] = f"{h[:4]}****{h[-2:]}" if len(h) > 6 else "****"

                    normalized.append({
                        "source_name": source,
                        "source_type": source_type,
                        "data_classes": data_classes,
                        "credential_type": cred_type,
                        "breach_date": r.get("date"),
                        "raw_data": sanitized_r
                    })
                return normalized
            elif response.status_code == 429:
                logger.warning(f"LeakCheck rate limited for {email}")
                return []
            else:
                logger.error(f"LeakCheck API error {response.status_code} for {email}")
                return []
        except Exception as e:
            logger.error(f"Error calling LeakCheck for {email}: {str(e)}")
            return []
