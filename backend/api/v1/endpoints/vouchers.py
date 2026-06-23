from datetime import date
from decimal import Decimal, ROUND_HALF_UP
import re
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status, Request

from core.helpers import get_profile_context, resolve_target_firm_id
from core.security import get_verified_jwt
from core.supabase import get_supabase
from models.voucher import (
    AccountingLineCreate,
    BillAllocationCreate,
    BillRefType,
    InventoryLineCreate,
    Voucher,
    VoucherCategory,
    VoucherCreate,
    VoucherDetail,
    VoucherDetail,
    VoucherUpdate,
)
from models.base import BulkDeleteRequest

from core.limiter import limiter
from core.rate_limits import LIMIT_VOUCHER_WRITES

async def _check_period_block_for_merchant(
    profile: dict[str, Any],
    firm_id: str,
    voucher_date: date,
    category: VoucherCategory,
) -> None:
    """If the user is a merchant, check if the period is blocked for this category."""
    if profile.get("role") != "merchant":
        return

    supabase = await get_supabase()
    year = voucher_date.year
    month = voucher_date.month

    resp = (
        await supabase.table("period_blocks")
        .select("*")
        .eq("firm_id", firm_id)
        .eq("year", year)
        .eq("month", month)
        .execute()
    )
    if not resp.data:
        return

    block = resp.data[0]
    
    blocked = False
    if category == VoucherCategory.SALES and block.get("block_sales"):
        blocked = True
    elif category == VoucherCategory.PURCHASE and block.get("block_purchases"):
        blocked = True
    elif category == VoucherCategory.DEBIT_NOTE and block.get("block_debit_notes"):
        blocked = True
    elif category == VoucherCategory.CREDIT_NOTE and block.get("block_credit_notes"):
        blocked = True

    if blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"The period for {category.value} in {year}-{month:02d} is blocked."
        )

router = APIRouter()

_NO_PARTY_CATEGORIES = {VoucherCategory.JOURNAL, VoucherCategory.CONTRA}


async def _validate_accounting_lines(
    lines: list[AccountingLineCreate],
    target_firm_id: str,
) -> None:
    if not lines:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A voucher must have at least one accounting line",
        )

    supabase = await get_supabase()
    ledger_ids = [str(line.ledger_id) for line in lines]
    rows = (
        await supabase.table("ledgers")
        .select("id, firm_id")
        .in_("id", ledger_ids)
        .execute()
    ).data or []

    found_ids = {row["id"] for row in rows}
    for ledger_id in ledger_ids:
        if ledger_id not in found_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Ledger {ledger_id} not found",
            )

    for row in rows:
        if str(row["firm_id"]) != target_firm_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Ledger {row['id']} does not belong to the target firm",
            )

    total_debit = Decimal("0.00")
    total_credit = Decimal("0.00")

    for line in lines:
        if not (
            (line.debit_amount > 0 and line.credit_amount == 0)
            or (line.credit_amount > 0 and line.debit_amount == 0)
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Line {line.line_number}: exactly one of debit_amount or "
                    "credit_amount must be > 0"
                ),
            )
        total_debit += Decimal(str(line.debit_amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total_credit += Decimal(str(line.credit_amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    if total_debit != total_credit:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Double entry failed: Total debits ({total_debit}) must equal "
                f"total credits ({total_credit})"
            ),
        )


async def _validate_party_ledger(
    category: VoucherCategory,
    party_ledger_id: Any,
    target_firm_id: str,
) -> None:
    if category in _NO_PARTY_CATEGORIES:
        return

    if not party_ledger_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"party_ledger_id is required for {category} vouchers",
        )

    supabase = await get_supabase()
    party_resp = (
        await supabase.table("ledgers")
        .select("firm_id")
        .eq("id", str(party_ledger_id))
        .single()
        .execute()
    )
    if not party_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Party ledger not found",
        )
    if str(party_resp.data["firm_id"]) != target_firm_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Party ledger does not belong to the target firm",
        )


async def _build_inventory_line_payloads(
    lines: list[InventoryLineCreate],
    target_firm_id: str,
    voucher_id: str,
) -> list[dict[str, Any]]:
    if not lines:
        return []

    supabase = await get_supabase()
    item_ids = [str(line.item_id) for line in lines]
    items_resp = (
        await supabase.table("items")
        .select("id, firm_id, name, hsn_code, uom_id, taxability")
        .in_("id", item_ids)
        .execute()
    ).data or []

    item_map = {row["id"]: row for row in items_resp}

    uom_ids = list({row["uom_id"] for row in items_resp if row.get("uom_id")})
    uom_map: dict[str, str] = {}

    if uom_ids:
        uom_rows = (
            await supabase.table("uom")
            .select("id, name")
            .in_("id", uom_ids)
            .execute()
        ).data or []
        uom_map = {row["id"]: row["name"] for row in uom_rows}

    payloads: list[dict[str, Any]] = []
    for line in lines:
        item_id = str(line.item_id)
        item = item_map.get(item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Item {item_id} not found",
            )

        if str(item["firm_id"]) != target_firm_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Item {item_id} does not belong to the target firm",
            )

        # unit_price is stored as NUMERIC(15,2) in the DB. Inclusive-tax calcs can
        # produce values like 84.745762…  Round NOW so the DB constraint
        # ROUND(qty*unit_price-discount, 2) == taxable_amount always holds.
        rounded_unit_price = Decimal(str(line.unit_price)).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        expected_taxable = max(
            Decimal("0.00"),
            (
                Decimal(str(line.quantity)) * rounded_unit_price
                - Decimal(str(line.discount_amount))
            )
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        actual_taxable = Decimal(str(line.taxable_amount)).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )

        if expected_taxable != actual_taxable:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Line {line.line_number}: taxable_amount mismatch. "
                    f"Expected {expected_taxable}, got {actual_taxable}"
                ),
            )

        hsn_code = item.get("hsn_code") or ""
        uom_name = uom_map.get(str(item["uom_id"])) or ""

        payloads.append({
            "voucher_id": voucher_id,
            "firm_id": target_firm_id,
            "item_id": item_id,
            "line_number": line.line_number,
            "item_name": item["name"],
            "hsn_code": hsn_code,
            "uom": uom_name,
            "taxability": item["taxability"],
            "quantity": float(line.quantity),
            "unit_price": float(rounded_unit_price),   # use rounded value
            "discount_amount": float(line.discount_amount),
            "taxable_amount": float(actual_taxable),
            "igst_rate": line.igst_rate,
            "cgst_rate": line.cgst_rate,
            "sgst_rate": line.sgst_rate,
            "igst_amount": line.igst_amount,
            "cgst_amount": line.cgst_amount,
            "sgst_amount": line.sgst_amount,
        })

    return payloads


def _build_header_payload(voucher_in: VoucherCreate, target_firm_id: str) -> dict[str, Any]:
    payload = voucher_in.model_dump(mode="json", exclude={"accounting_lines", "inventory_lines", "bill_allocations"})
    payload["firm_id"] = target_firm_id
    payload["voucher_date"] = str(voucher_in.voucher_date)
    if voucher_in.party_ledger_id:
        payload["party_ledger_id"] = str(voucher_in.party_ledger_id)
    if voucher_in.original_invoice_number:
        payload["original_invoice_number"] = voucher_in.original_invoice_number
    if voucher_in.original_invoice_date:
        payload["original_invoice_date"] = str(voucher_in.original_invoice_date)
    return payload


def _build_accounting_line_payloads(
    voucher_in: VoucherCreate,
    target_firm_id: str,
    voucher_id: str,
) -> list[dict[str, Any]]:
    return [
        {
            "voucher_id": voucher_id,
            "firm_id": target_firm_id,
            "ledger_id": str(line.ledger_id),
            "line_number": line.line_number,
            "debit_amount": line.debit_amount,
            "credit_amount": line.credit_amount,
        }
        for line in voucher_in.accounting_lines
    ]


async def _replace_voucher_lines(
    voucher_id: str,
    voucher_in: VoucherCreate,
    target_firm_id: str,
) -> None:
    supabase = await get_supabase()
    # Build payloads first to trigger any validation errors BEFORE deleting existing lines
    acc_payloads = _build_accounting_line_payloads(voucher_in, target_firm_id, voucher_id)

    inv_payloads = []
    if voucher_in.inventory_lines:
        inv_payloads = await _build_inventory_line_payloads(
            voucher_in.inventory_lines,
            target_firm_id,
            voucher_id,
        )

    await supabase.table("voucher_accounting_lines").delete().eq("voucher_id", voucher_id).execute()
    await supabase.table("voucher_inventory_lines").delete().eq("voucher_id", voucher_id).execute()

    if acc_payloads:
        await supabase.table("voucher_accounting_lines").insert(acc_payloads).execute()

    if inv_payloads:
        await supabase.table("voucher_inventory_lines").insert(inv_payloads).execute()


async def _fetch_voucher_detail(voucher_id: str) -> dict[str, Any]:
    supabase = await get_supabase()
    voucher_resp = (
        await supabase.table("vouchers")
        .select("*")
        .eq("id", voucher_id)
        .single()
        .execute()
    )
    acc_lines_resp = (
        await supabase.table("voucher_accounting_lines")
        .select("*")
        .eq("voucher_id", voucher_id)
        .order("line_number")
        .execute()
    )
    inv_lines_resp = (
        await supabase.table("voucher_inventory_lines")
        .select("*")
        .eq("voucher_id", voucher_id)
        .order("line_number")
        .execute()
    )
    bill_alloc_resp = (
        await supabase.table("bill_allocations")
        .select("*")
        .eq("voucher_id", voucher_id)
        .execute()
    )

    result = voucher_resp.data
    result["accounting_lines"] = acc_lines_resp.data or []
    result["inventory_lines"] = inv_lines_resp.data or []
    result["bill_allocations"] = bill_alloc_resp.data or []
    return result


async def _find_party_accounting_line_id(
    voucher_id: str,
    party_ledger_id: str,
) -> str | None:
    """Find the accounting line ID for the party ledger in a voucher."""
    supabase = await get_supabase()
    resp = (
        await supabase.table("voucher_accounting_lines")
        .select("id")
        .eq("voucher_id", voucher_id)
        .eq("ledger_id", party_ledger_id)
        .limit(1)
        .execute()
    )
    if resp.data:
        return resp.data[0]["id"]
    return None


async def _persist_bill_allocations(
    voucher_id: str,
    firm_id: str,
    party_ledger_id: str,
    accounting_line_id: str,
    allocations: list[BillAllocationCreate],
) -> None:
    """Insert bill_allocations rows for a voucher."""
    if not allocations:
        return

    supabase = await get_supabase()
    payloads = [
        {
            "voucher_id": voucher_id,
            "firm_id": firm_id,
            "party_ledger_id": party_ledger_id,
            "accounting_line_id": accounting_line_id,
            "ref_type": alloc.ref_type.value,
            "ref_name": alloc.ref_name,
            "amount": float(alloc.amount),
            "amount_type": alloc.amount_type.value if hasattr(alloc.amount_type, 'value') else alloc.amount_type,
            "due_date": str(alloc.due_date) if alloc.due_date else None,
        }
        for alloc in allocations
    ]
    await supabase.table("bill_allocations").insert(payloads).execute()


async def _delete_bill_allocations(voucher_id: str) -> None:
    """Delete all bill_allocations for a voucher."""
    supabase = await get_supabase()
    await supabase.table("bill_allocations").delete().eq("voucher_id", voucher_id).execute()


async def _auto_create_new_ref(
    voucher_id: str,
    firm_id: str,
    voucher_in: VoucherCreate,
) -> None:
    """Auto-create a 'New Ref' allocation for Sales/Purchase vouchers."""
    party_ledger_id = str(voucher_in.party_ledger_id) if voucher_in.party_ledger_id else None
    if not party_ledger_id:
        return

    supabase = await get_supabase()
    # Check if party has maintain_bill_by_bill enabled
    party_resp = (
        await supabase.table("ledger_party_details")
        .select("maintain_bill_by_bill, default_credit_days")
        .eq("ledger_id", party_ledger_id)
        .maybe_single()
        .execute()
    )
    if not party_resp.data or not party_resp.data.get("maintain_bill_by_bill"):
        return

    # Find the party's accounting line
    acc_line_id = await _find_party_accounting_line_id(voucher_id, party_ledger_id)
    if not acc_line_id:
        return

    # Calculate grand total from the party's accounting line
    party_line = (
        await supabase.table("voucher_accounting_lines")
        .select("debit_amount, credit_amount")
        .eq("id", acc_line_id)
        .single()
        .execute()
    ).data
    amount = float(party_line["debit_amount"] or party_line["credit_amount"])

    # Determine Dr/Cr direction:
    # Sales/Debit Note → party is debited (Dr)
    # Purchase/Credit Note → party is credited (Cr)
    is_sales_type = voucher_in.category in (
        VoucherCategory.SALES,
        VoucherCategory.DEBIT_NOTE,
    )
    amount_type = "Dr" if is_sales_type else "Cr"

    # Calculate due date
    credit_days = party_resp.data.get("default_credit_days") or 0
    voucher_date = voucher_in.voucher_date
    from datetime import timedelta
    due_date = voucher_date + timedelta(days=credit_days) if credit_days else voucher_date

    await _persist_bill_allocations(
        voucher_id=voucher_id,
        firm_id=firm_id,
        party_ledger_id=party_ledger_id,
        accounting_line_id=acc_line_id,
        allocations=[
            BillAllocationCreate(
                ref_type=BillRefType.NEW_REF,
                ref_name=voucher_in.voucher_number,
                amount=amount,
                amount_type=amount_type,
                due_date=due_date,
            )
        ],
    )


@router.get("/", response_model=list[Voucher])
async def list_vouchers(
    firm_id: Optional[str] = None,
    category: Optional[str] = None,
    voucher_number: Optional[str] = None,
    party_ledger_id: Optional[str] = None,
    from_date: Optional[date] = Query(default=None),
    to_date: Optional[date] = Query(default=None),
    jwt: str = Depends(get_verified_jwt),
) -> Any:
    supabase = await get_supabase()
    profile = await get_profile_context(jwt)
    target_firm_id = await resolve_target_firm_id(profile, firm_id)

    query = (
        supabase.table("vouchers")
        .select("*")
        .eq("firm_id", target_firm_id)
        .eq("is_cancelled", False)
    )

    if category:
        query = query.eq("category", category)
    if voucher_number:
        query = query.eq("voucher_number", voucher_number)
    if party_ledger_id:
        query = query.eq("party_ledger_id", party_ledger_id)
    if from_date:
        query = query.gte("voucher_date", str(from_date))
    if to_date:
        query = query.lte("voucher_date", str(to_date))

    return (await query.order("voucher_date", desc=True).execute()).data or []


@router.post("/", response_model=VoucherDetail, status_code=status.HTTP_201_CREATED)
@limiter.limit(LIMIT_VOUCHER_WRITES)
async def create_voucher(
    request: Request,
    voucher_in: VoucherCreate,
    jwt: str = Depends(get_verified_jwt),
) -> Any:
    supabase = await get_supabase()
    profile = await get_profile_context(jwt)
    target_firm_id = await resolve_target_firm_id(profile, str(voucher_in.firm_id))

    await _validate_party_ledger(voucher_in.category, voucher_in.party_ledger_id, target_firm_id)
    await _validate_accounting_lines(voucher_in.accounting_lines, target_firm_id)
    await _check_period_block_for_merchant(profile, target_firm_id, voucher_in.voucher_date, voucher_in.category)

    header_resp = await supabase.table("vouchers").insert(
        _build_header_payload(voucher_in, target_firm_id)
    ).execute()
    if not header_resp.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create voucher. Voucher number may already exist.",
        )

    voucher_id = header_resp.data[0]["id"]
    try:
        await _replace_voucher_lines(voucher_id, voucher_in, target_firm_id)

        # ── Bill allocations ──
        party_id = str(voucher_in.party_ledger_id) if voucher_in.party_ledger_id else None
        if party_id and voucher_in.bill_allocations:
            # User-supplied allocations (Payment/Receipt or manual)
            acc_line_id = await _find_party_accounting_line_id(voucher_id, party_id)
            if acc_line_id:
                await _persist_bill_allocations(
                    voucher_id, target_firm_id, party_id, acc_line_id,
                    voucher_in.bill_allocations,
                )
        elif voucher_in.category in (
            VoucherCategory.SALES, VoucherCategory.PURCHASE,
            VoucherCategory.DEBIT_NOTE, VoucherCategory.CREDIT_NOTE,
        ):
            # Auto-create New Ref for invoice-family vouchers
            await _auto_create_new_ref(voucher_id, target_firm_id, voucher_in)

    except HTTPException:
        await supabase.table("vouchers").delete().eq("id", voucher_id).execute()
        raise
    except Exception as exc:
        await supabase.table("vouchers").delete().eq("id", voucher_id).execute()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Voucher creation failed: {exc}",
        ) from exc

    return await _fetch_voucher_detail(voucher_id)


@router.get("/next-number")
async def get_next_number(
    firm_id: str,
    category: VoucherCategory,
    jwt: str = Depends(get_verified_jwt),
) -> dict[str, str]:
    supabase = await get_supabase()
    profile = await get_profile_context(jwt)
    target_firm_id = await resolve_target_firm_id(profile, firm_id)

    # 1. Fetch the prefix setting from the firm
    firm_resp = await supabase.table("firms").select("*").eq("id", target_firm_id).maybe_single().execute()
    if not firm_resp or not firm_resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Firm not found")
    firm = firm_resp.data

    prefix = ""
    if category == VoucherCategory.SALES:
        prefix = firm.get("sales_prefix") or ""
    elif category == VoucherCategory.PURCHASE:
        prefix = firm.get("purchase_prefix") or ""
    elif category == VoucherCategory.PAYMENT:
        prefix = firm.get("payment_prefix") or ""
    elif category == VoucherCategory.RECEIPT:
        prefix = firm.get("receipt_prefix") or ""

    # 2. Query existing vouchers for this firm and category
    vouchers_resp = (
        await supabase.table("vouchers")
        .select("voucher_number")
        .eq("firm_id", target_firm_id)
        .eq("category", category.value)
        .execute()
    )
    existing_numbers = [v["voucher_number"] for v in vouchers_resp.data or []]

    # 3. Parse the prefix — the user may include a starting number at the end
    #    e.g. "SALE/26-27/1" → base_prefix="SALE/26-27/", start_val=1, padding=1
    #    e.g. "INV-"         → base_prefix="INV-",          start_val=1, padding=1
    match = re.search(r"(\d+)$", prefix)
    if match:
        base_prefix = prefix[:match.start()]
        start_num_str = match.group(1)
        start_val = int(start_num_str)
        padding = len(start_num_str)
    else:
        base_prefix = prefix
        start_val = 1
        padding = 1

    # 4. If NO prefix is configured at all, just increment from the highest
    #    purely-numeric voucher number (ignore non-numeric ones).
    if not prefix:
        max_bare = 0
        for num in existing_numbers:
            if num.isdigit():
                max_bare = max(max_bare, int(num))
        return {"next_number": str(max_bare + 1)}

    # 5. A prefix IS configured — only consider vouchers that already use it.
    #    This prevents old bare-number vouchers from polluting the counter.
    matching_numbers = [num for num in existing_numbers if num.startswith(base_prefix)]

    if not matching_numbers:
        # No vouchers with this prefix yet — return the configured starting point.
        return {"next_number": prefix if match else f"{base_prefix}1"}

    max_val = start_val - 1
    best_padding = padding

    for num in matching_numbers:
        suffix = num[len(base_prefix):]
        m = re.match(r"^(\d+)", suffix)
        if m:
            val_str = m.group(1)
            val = int(val_str)
            if val > max_val:
                max_val = val
                best_padding = len(val_str)

    next_val = max_val + 1
    next_val_str = str(next_val).zfill(best_padding)
    return {"next_number": f"{base_prefix}{next_val_str}"}


@router.get("/outstanding-bills")
async def get_outstanding_bills(
    firm_id: str,
    party_ledger_id: str,
    jwt: str = Depends(get_verified_jwt),
) -> list[dict[str, Any]]:
    """
    Return all pending (non-zero-balance) bills for a party ledger.
    Computes outstanding by grouping allocations by ref_name and netting Dr vs Cr.
    """
    supabase = await get_supabase()
    profile = await get_profile_context(jwt)
    target_firm_id = await resolve_target_firm_id(profile, firm_id)

    # Fetch all allocations for this party, excluding cancelled vouchers
    alloc_resp = (
        await supabase.table("bill_allocations")
        .select("ref_name, ref_type, amount, amount_type, due_date, voucher_id")
        .eq("firm_id", target_firm_id)
        .eq("party_ledger_id", party_ledger_id)
        .execute()
    )
    allocations = alloc_resp.data or []
    
    print(f"FETCHED ALLOCATIONS for party {party_ledger_id}:", allocations)

    if not allocations:
        return []

    # Fetch voucher statuses to exclude cancelled vouchers
    voucher_ids = list({str(a["voucher_id"]) for a in allocations})
    voucher_resp = (
        await supabase.table("vouchers")
        .select("id, is_cancelled, voucher_date")
        .in_("id", voucher_ids)
        .execute()
    )
    voucher_map = {
        str(v["id"]): v for v in (voucher_resp.data or [])
    }

    # Group by ref_name and compute net balance
    refs: dict[str, dict[str, Any]] = {}
    for alloc in allocations:
        voucher = voucher_map.get(str(alloc["voucher_id"]))
        if not voucher or voucher.get("is_cancelled"):
            continue

        ref_name = alloc["ref_name"]
        if ref_name not in refs:
            refs[ref_name] = {
                "ref_name": ref_name,
                "ref_type": alloc["ref_type"],
                "bill_date": voucher.get("voucher_date"),
                "due_date": alloc.get("due_date") or voucher.get("voucher_date"),
                "total_dr": 0.0,
                "total_cr": 0.0,
            }

        amount = float(alloc["amount"])
        if alloc["amount_type"] == "Dr":
            refs[ref_name]["total_dr"] += amount
        else:
            refs[ref_name]["total_cr"] += amount

    # Build result — only return refs with non-zero balance
    result = []
    for ref in refs.values():
        balance = round(ref["total_dr"] - ref["total_cr"], 2)
        if balance == 0:
            continue

        balance_type = "Dr" if balance > 0 else "Cr"
        result.append({
            "ref_name": ref["ref_name"],
            "ref_type": ref["ref_type"],
            "bill_date": ref["bill_date"],
            "due_date": ref["due_date"],
            "balance": abs(balance),
            "balance_type": balance_type,
        })

    return result


@router.get("/{voucher_id}", response_model=VoucherDetail)
async def get_voucher(
    voucher_id: str,
    jwt: str = Depends(get_verified_jwt),
) -> Any:
    supabase = await get_supabase()
    profile = await get_profile_context(jwt)
    voucher_resp = (
        await supabase.table("vouchers")
        .select("*")
        .eq("id", voucher_id)
        .single()
        .execute()
    )
    if not voucher_resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voucher not found")

    await resolve_target_firm_id(profile, str(voucher_resp.data["firm_id"]))
    return await _fetch_voucher_detail(voucher_id)


@router.put("/{voucher_id}", response_model=VoucherDetail)
@limiter.limit(LIMIT_VOUCHER_WRITES)
async def replace_voucher(
    request: Request,
    voucher_id: str,
    voucher_in: VoucherCreate,
    jwt: str = Depends(get_verified_jwt),
) -> Any:
    supabase = await get_supabase()
    profile = await get_profile_context(jwt)
    existing_resp = (
        await supabase.table("vouchers")
        .select("*")
        .eq("id", voucher_id)
        .single()
        .execute()
    )
    existing = existing_resp.data
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voucher not found")
    if existing["is_cancelled"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot edit a cancelled voucher",
        )

    target_firm_id = await resolve_target_firm_id(profile, str(existing["firm_id"]))
    if str(voucher_in.firm_id) != target_firm_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="firm_id cannot be changed during edit",
        )

    await _validate_party_ledger(voucher_in.category, voucher_in.party_ledger_id, target_firm_id)
    await _validate_accounting_lines(voucher_in.accounting_lines, target_firm_id)

    orig_date = date.fromisoformat(str(existing["voucher_date"])) if existing.get("voucher_date") else None
    if orig_date:
        await _check_period_block_for_merchant(profile, target_firm_id, orig_date, existing["category"])
        
    if voucher_in.voucher_date and voucher_in.voucher_date != orig_date:
        await _check_period_block_for_merchant(profile, target_firm_id, voucher_in.voucher_date, voucher_in.category)

    previous_accounting = (
        await supabase.table("voucher_accounting_lines")
        .select("*")
        .eq("voucher_id", voucher_id)
        .order("line_number")
        .execute()
    ).data or []
    previous_inventory = (
        await supabase.table("voucher_inventory_lines")
        .select("*")
        .eq("voucher_id", voucher_id)
        .order("line_number")
        .execute()
    ).data or []
    previous_header = {
        "party_ledger_id": existing.get("party_ledger_id"),
        "category": existing["category"],
        "voucher_number": existing["voucher_number"],
        "voucher_date": existing["voucher_date"],
        "narration": existing.get("narration"),
    }

    try:
        await supabase.table("vouchers").update(
            _build_header_payload(voucher_in, target_firm_id)
        ).eq("id", voucher_id).execute()
        await _replace_voucher_lines(voucher_id, voucher_in, target_firm_id)

        # ── Replace bill allocations ──
        await _delete_bill_allocations(voucher_id)
        party_id = str(voucher_in.party_ledger_id) if voucher_in.party_ledger_id else None
        if party_id and voucher_in.bill_allocations:
            acc_line_id = await _find_party_accounting_line_id(voucher_id, party_id)
            if acc_line_id:
                await _persist_bill_allocations(
                    voucher_id, target_firm_id, party_id, acc_line_id,
                    voucher_in.bill_allocations,
                )
        elif voucher_in.category in (
            VoucherCategory.SALES, VoucherCategory.PURCHASE,
            VoucherCategory.DEBIT_NOTE, VoucherCategory.CREDIT_NOTE,
        ):
            await _auto_create_new_ref(voucher_id, target_firm_id, voucher_in)

    except HTTPException:
        await supabase.table("vouchers").update(previous_header).eq("id", voucher_id).execute()
        raise
    except Exception as exc:
        await supabase.table("vouchers").update(previous_header).eq("id", voucher_id).execute()
        await supabase.table("voucher_accounting_lines").delete().eq("voucher_id", voucher_id).execute()
        await supabase.table("voucher_inventory_lines").delete().eq("voucher_id", voucher_id).execute()
        if previous_accounting:
            await supabase.table("voucher_accounting_lines").insert(previous_accounting).execute()
        if previous_inventory:
            await supabase.table("voucher_inventory_lines").insert(previous_inventory).execute()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Voucher replacement failed: {exc}",
        ) from exc

    return await _fetch_voucher_detail(voucher_id)


@router.patch("/{voucher_id}", response_model=Voucher)
@limiter.limit(LIMIT_VOUCHER_WRITES)
async def update_voucher(
    request: Request,
    voucher_id: str,
    voucher_in: VoucherUpdate,
    jwt: str = Depends(get_verified_jwt),
) -> Any:
    supabase = await get_supabase()
    profile = await get_profile_context(jwt)

    existing = (
        await supabase.table("vouchers")
        .select("firm_id, is_cancelled")
        .eq("id", voucher_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voucher not found")
    if existing.data["is_cancelled"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot edit a cancelled voucher",
        )

    await resolve_target_firm_id(profile, str(existing.data["firm_id"]))

    orig_date = date.fromisoformat(str(existing.data["voucher_date"])) if "voucher_date" in existing.data else None
    
    if orig_date and "category" in existing.data:
        await _check_period_block_for_merchant(profile, str(existing.data["firm_id"]), orig_date, existing.data["category"])
        
        if voucher_in.voucher_date and voucher_in.voucher_date != orig_date:
            await _check_period_block_for_merchant(profile, str(existing.data["firm_id"]), voucher_in.voucher_date, existing.data["category"])

    payload = voucher_in.model_dump(mode="json", exclude_none=True)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update",
        )
    if "voucher_date" in payload:
        payload["voucher_date"] = str(payload["voucher_date"])

    response = await supabase.table("vouchers").update(payload).eq("id", voucher_id).execute()
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to update voucher",
        )
    return response.data[0]


@router.delete("/{voucher_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_voucher(
    voucher_id: str,
    jwt: str = Depends(get_verified_jwt),
) -> None:
    supabase = await get_supabase()
    profile = await get_profile_context(jwt)

    existing = (
        await supabase.table("vouchers")
        .select("firm_id, is_cancelled")
        .eq("id", voucher_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voucher not found")
    if existing.data["is_cancelled"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Voucher is already cancelled",
        )

    await resolve_target_firm_id(profile, str(existing.data["firm_id"]))
    
    orig_date = date.fromisoformat(str(existing.data["voucher_date"])) if "voucher_date" in existing.data else None
    if orig_date and "category" in existing.data:
        await _check_period_block_for_merchant(profile, str(existing.data["firm_id"]), orig_date, existing.data["category"])

    await supabase.table("vouchers").update({"is_cancelled": True}).eq("id", voucher_id).execute()


@router.post("/bulk-delete", status_code=status.HTTP_200_OK)
async def bulk_cancel_vouchers(
    request: BulkDeleteRequest,
    jwt: str = Depends(get_verified_jwt),
) -> dict[str, Any]:
    supabase = await get_supabase()
    profile = await get_profile_context(jwt)

    if not request.ids:
        return {"success": [], "failed": []}

    existing = (
        await supabase.table("vouchers")
        .select("id, firm_id, voucher_number, voucher_date, category, is_cancelled")
        .in_("id", request.ids)
        .execute()
    )
    
    if not existing.data:
        return {"success": [], "failed": [{"id": id, "reason": "Not found"} for id in request.ids]}

    firm_ids = {str(item["firm_id"]) for item in existing.data}
    if not firm_ids:
        return {"success": [], "failed": [{"id": id, "reason": "Not found"} for id in request.ids]}
        
    await resolve_target_firm_id(profile, list(firm_ids)[0])

    valid_items = existing.data
    item_map = {item["id"]: item["voucher_number"] for item in existing.data}
    
    success = []
    failed = []

    for item in valid_items:
        item_id = item["id"]
        if item.get("is_cancelled"):
            failed.append({"id": item_id, "name": item_map.get(item_id, item_id), "reason": "Already cancelled"})
            continue
            
        orig_date = date.fromisoformat(str(item["voucher_date"])) if item.get("voucher_date") else None
        try:
            if orig_date and "category" in item:
                await _check_period_block_for_merchant(profile, str(item["firm_id"]), orig_date, item["category"])
                
            await supabase.table("vouchers").update({"is_cancelled": True}).eq("id", item_id).execute()
            success.append(item_id)
        except HTTPException as e:
            failed.append({"id": item_id, "name": item_map.get(item_id, item_id), "reason": e.detail})
        except Exception as e:
            failed.append({"id": item_id, "name": item_map.get(item_id, item_id), "reason": "Database error"})

    found_ids = {item["id"] for item in existing.data}
    for id in set(request.ids) - found_ids:
        failed.append({"id": id, "name": id, "reason": "Not found or permission denied"})

    return {"success": success, "failed": failed}
