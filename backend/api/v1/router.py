from fastapi import APIRouter
from .endpoints import health, firms, ledgers, uom, items, vouchers, workspace, reconciliation, profiles, period_blocks, feedback

api_router = APIRouter()

# Group all /api routes logically
api_router.include_router(health.router,    prefix="/api/health",    tags=["health"])
api_router.include_router(firms.router,     prefix="/api/firms",     tags=["firms"])
api_router.include_router(ledgers.router,   prefix="/api/ledgers",   tags=["ledgers"])
api_router.include_router(uom.router,       prefix="/api/uom",       tags=["uom"])
api_router.include_router(items.router,     prefix="/api/items",     tags=["items"])
api_router.include_router(vouchers.router,  prefix="/api/vouchers",  tags=["vouchers"])
api_router.include_router(workspace.router, prefix="/api/workspace", tags=["workspace"])
api_router.include_router(reconciliation.router, prefix="/api/reconciliation", tags=["reconciliation"])
api_router.include_router(profiles.router, prefix="/api/profiles", tags=["profiles"])
api_router.include_router(period_blocks.router, prefix="/api", tags=["period-blocks"])
api_router.include_router(feedback.router, prefix="/api/feedback", tags=["feedback"])
