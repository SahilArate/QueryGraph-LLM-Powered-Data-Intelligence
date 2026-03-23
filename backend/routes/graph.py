from fastapi import APIRouter
from db.postgres import execute_query

router = APIRouter()


@router.get("/graph/nodes")
async def get_graph_data():
    nodes = []
    edges = []

    orders = execute_query(
        "SELECT sales_order, sold_to_party, total_net_amount, overall_delivery_status "
        "FROM sales_order_headers LIMIT 50"
    )
    for o in orders:
        nodes.append({
            "id": f"so_{o['sales_order']}",
            "label": f"SO {o['sales_order']}",
            "type": "sales_order",
            "data": o
        })

    partners = execute_query("SELECT business_partner, full_name FROM business_partners")
    for p in partners:
        nodes.append({
            "id": f"bp_{p['business_partner']}",
            "label": p["full_name"] or p["business_partner"],
            "type": "business_partner",
            "data": p
        })
        edges.append({
            "source": f"bp_{p['business_partner']}",
            "target": f"so_{p['business_partner']}",
            "label": "places"
        })

    deliveries = execute_query(
        "SELECT DISTINCT di.reference_sd_document, di.delivery_document "
        "FROM outbound_delivery_items di LIMIT 50"
    )
    for d in deliveries:
        nodes.append({
            "id": f"del_{d['delivery_document']}",
            "label": f"DEL {d['delivery_document']}",
            "type": "delivery",
            "data": d
        })
        edges.append({
            "source": f"so_{d['reference_sd_document']}",
            "target": f"del_{d['delivery_document']}",
            "label": "delivered_via"
        })

    billings = execute_query(
        "SELECT DISTINCT bi.reference_sd_document, bi.billing_document "
        "FROM billing_document_items bi LIMIT 50"
    )
    for b in billings:
        nodes.append({
            "id": f"bill_{b['billing_document']}",
            "label": f"BILL {b['billing_document']}",
            "type": "billing",
            "data": b
        })
        edges.append({
            "source": f"del_{b['reference_sd_document']}",
            "target": f"bill_{b['billing_document']}",
            "label": "billed_as"
        })

    return {"nodes": nodes, "edges": edges}


@router.get("/graph/trace/{billing_document}")
async def trace_billing_flow(billing_document: str):
    billing = execute_query(
        f"SELECT b.billing_document, b.billing_document_type, "
        f"b.total_net_amount, b.is_cancelled, "
        f"b.sold_to_party, b.accounting_document, "
        f"bp.full_name as customer_name "
        f"FROM billing_document_headers b "
        f"LEFT JOIN business_partners bp ON bp.business_partner = b.sold_to_party "
        f"WHERE b.billing_document = '{billing_document}'"
    )

    if not billing:
        return {"error": f"Billing document {billing_document} not found"}

    billing_items = execute_query(
        f"SELECT billing_document_item, material, billing_quantity, "
        f"net_amount, reference_sd_document "
        f"FROM billing_document_items "
        f"WHERE billing_document = '{billing_document}'"
    )

    delivery_docs = list(set([
        item["reference_sd_document"]
        for item in billing_items
        if item["reference_sd_document"]
    ]))

    deliveries = []
    sales_orders = []

    for del_doc in delivery_docs:
        del_header = execute_query(
            f"SELECT delivery_document, creation_date, "
            f"overall_goods_movement_status, overall_picking_status "
            f"FROM outbound_delivery_headers "
            f"WHERE delivery_document = '{del_doc}'"
        )
        if del_header:
            deliveries.extend(del_header)

        del_items = execute_query(
            f"SELECT DISTINCT reference_sd_document "
            f"FROM outbound_delivery_items "
            f"WHERE delivery_document = '{del_doc}'"
        )

        for di in del_items:
            so = di["reference_sd_document"]
            if so:
                so_data = execute_query(
                    f"SELECT s.sales_order, s.total_net_amount, "
                    f"s.overall_delivery_status, s.overall_billing_status, "
                    f"s.creation_date, bp.full_name as customer_name "
                    f"FROM sales_order_headers s "
                    f"LEFT JOIN business_partners bp ON bp.business_partner = s.sold_to_party "
                    f"WHERE s.sales_order = '{so}'"
                )
                sales_orders.extend(so_data)

    acct_doc = billing[0].get("accounting_document")

    journal = execute_query(
        f"SELECT accounting_document, amount_in_transaction_currency, "
        f"posting_date, clearing_date, accounting_document_type "
        f"FROM journal_entry_items "
        f"WHERE accounting_document = '{acct_doc}'"
    ) if acct_doc else []

    payments = execute_query(
        f"SELECT accounting_document, amount_in_transaction_currency, "
        f"posting_date, clearing_date, clearing_accounting_document "
        f"FROM payments_accounts_receivable "
        f"WHERE accounting_document = '{acct_doc}'"
    ) if acct_doc else []

    return {
        "flow": {
            "billing_document": billing[0],
            "billing_items": billing_items,
            "deliveries": deliveries,
            "sales_orders": sales_orders,
            "journal_entries": journal,
            "payments": payments
        }
    }