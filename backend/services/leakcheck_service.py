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
                    if not is_pro:
                        logger.debug(f"LeakCheck public query for {email}: {data.get('error')}")
                    else:
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

                    # Technical evidence metadata only - Zero Credential Storage (Measure 21)
                    evidence_metadata = {
                        "provider": "leakcheck",
                        "source_name": source,
                        "evidence_type": "infostealer_telemetry" if is_stealer else "breach_record",
                        "has_credentials": bool("password" in r or is_stealer),
                        "confidence": "high" if (is_stealer or "password" in r) else "moderate",
                        "compromise_date": r.get("date")
                    }

                    normalized.append({
                        "source_name": source,
                        "source_type": source_type,
                        "data_classes": data_classes,
                        "credential_type": cred_type,
                        "breach_date": r.get("date"),
                        "raw_data": evidence_metadata
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
