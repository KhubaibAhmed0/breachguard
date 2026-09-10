from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from core.database import get_db
from models.user import User
from models.report import Report
from schemas.report import ReportGenerate, ReportResponse
from routers.deps import get_current_user
from services.report_service import generate_pdf_report
from typing import List, Optional

router = APIRouter()

@router.post("/generate", response_model=ReportResponse)
async def generate_report(
    req: ReportGenerate, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    file_url = await generate_pdf_report(
        org_id=current_user.org_id, 
        report_type=req.report_type, 
        domain_name=req.domain_name, 
        db=db
    )
    
    report = Report(
        org_id=current_user.org_id, 
        report_type=req.report_type, 
        domain_name=req.domain_name,
        file_url=file_url
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report

@router.get("", response_model=List[ReportResponse])
async def list_reports(
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Report)
        .where(Report.org_id == current_user.org_id)
        .order_by(Report.generated_at.desc())
    )
    return result.scalars().all()

@router.get("/{id}/download")
async def download_report(
    id: int, 
    token: Optional[str] = None,
    download: Optional[bool] = False,
    db: AsyncSession = Depends(get_db)
):
    from fastapi.responses import FileResponse
    import os
    result = await db.execute(select(Report).where(Report.id == id))
    report = result.scalars().first()
    if not report or not os.path.exists(report.file_url):
        raise HTTPException(status_code=404, detail="Report not found")
    
    domain_part = f"_{report.domain_name}" if report.domain_name else ""
    dl_filename = f"Security_Audit_Report{domain_part}_{id}.pdf"
    disposition = "attachment" if download else "inline"
    
    return FileResponse(
        report.file_url, 
        media_type="application/pdf", 
        filename=dl_filename,
        content_disposition_type=disposition,
        headers={
            "Content-Disposition": f'{disposition}; filename="{dl_filename}"',
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )
