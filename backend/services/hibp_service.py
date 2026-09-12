import logging
import asyncio
import httpx
from typing import List, Dict, Any, Optional
from core.config import settings

logger = logging.getLogger(__name__)

HIBP_BASE_URL = "https://haveibeenpwned.com/api/v3"

async def check_domain_breaches(domain: str) -> List[Dict[str, Any]]:
    """
    Get all breaches for a domain using HIBP.
    """
    url = f"{HIBP_BASE_URL}/breaches"
    params = {"domain": domain}
    headers = {
        "user-agent": "BreachGuard-Security-Scanner/1.0"
    }
    if settings.HIBP_API_KEY:
        headers["hibp-api-key"] = settings.HIBP_API_KEY
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params, headers=headers, timeout=10.0)
            if response.status_code == 200:
                breaches = response.json()
                normalized = []
                for b in breaches:
                    normalized.append({
                        "source_name": b.get("Name"),
                        "source_type": "breach",
                        "data_classes": b.get("DataClasses", []),
                        "breach_date": b.get("BreachDate"),
                        "added_date": b.get("AddedDate"),
                        "is_verified": b.get("IsVerified", False),
                        "description": b.get("Description", "")
                    })
                return normalized
            elif response.status_code == 404:
                return []
            elif response.status_code == 429:
                logger.warning(f"HIBP rate limited on domain {domain}")
                return []
            else:
                logger.error(f"HIBP API error {response.status_code} for domain {domain}")
                return []
        except Exception as e:
            logger.error(f"Error calling HIBP for domain {domain}: {str(e)}")
            return []

async def check_email_breaches(email: str) -> List[Dict[str, Any]]:
    """
    Get all breaches for an email using HIBP.
    Includes rate limiting and retry logic.
    """
    if not settings.HIBP_API_KEY:
        logger.debug(f"HIBP_API_KEY not configured, skipping email breach query for {email}")
        return []

    url = f"{HIBP_BASE_URL}/breachedaccount/{email}"
    params = {"truncateResponse": "false"}
    headers = {
        "hibp-api-key": settings.HIBP_API_KEY,
        "user-agent": "DarkWebMonitor-App"
    }

    max_retries = 3
    base_delay = 6.0 # HIBP standard is 1.5s but we play it safe with 6s for 10/min

    async with httpx.AsyncClient() as client:
        for attempt in range(max_retries):
            try:
                response = await client.get(url, params=params, headers=headers, timeout=10.0)
                if response.status_code == 200:
                    breaches = response.json()
                    normalized = []
                    for b in breaches:
                        normalized.append({
                            "source_name": b.get("Name"),
                            "source_type": "breach",
                            "data_classes": b.get("DataClasses", []),
                            "breach_date": b.get("BreachDate"),
                            "added_date": b.get("AddedDate"),
                            "is_verified": b.get("IsVerified", False),
                            "description": b.get("Description", "")
                        })
                    await asyncio.sleep(base_delay)
                    return normalized
                elif response.status_code == 404:
                    await asyncio.sleep(base_delay)
                    return []
                elif response.status_code == 429:
                    retry_after = float(response.headers.get("retry-after", base_delay))
                    logger.warning(f"HIBP rate limited on email {email}, waiting {retry_after}s")
                    await asyncio.sleep(retry_after + 1.0)
                else:
                    logger.error(f"HIBP API error {response.status_code} for email {email}")
                    await asyncio.sleep(base_delay)
                    return []
            except Exception as e:
                logger.error(f"Error calling HIBP for email {email}: {str(e)}")
                await asyncio.sleep(base_delay)
                return []
    
    return []
