from tasks.celery_app import celery_app
import asyncio

@celery_app.task
def run_domain_scan_task(domain_id: int):
    # In a real app we'd call the async service from here
    print(f"Task: Scanning domain {domain_id}")
    return {"status": "success", "domain_id": domain_id}
