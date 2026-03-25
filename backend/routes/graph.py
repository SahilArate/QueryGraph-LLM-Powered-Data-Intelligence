from fastapi import APIRouter
from db.postgres import execute_query

router = APIRouter()


@router.get("/graph/nodes")
async def get_graph_data():
    nodes = []
    edges = []

    orders = execute_query("SELECT sales_order, sold_to_party, total_net_amount, overall_delivery_status FROM sales_order_headers LIMIT 50")
    for o in orders:
        nodes.append({"id": f"so_{o['sales_order']}", "label": f"SO {o['sales_order']}", "type": "sales_order", "data": o})

    partners = execute_query("SELECT business_partner, full_name FROM business_partners")
    for p in partners:
        nodes.append({"id": f"bp_{p['business_partner']}", "label": p["full_name"] or p["business_partner"], "type": "business_partner", "data": p})
        edges.append({"source": f"bp_{p['business_partner']}", "target": f"so_{p['business_partner']}", "label": "places"})

    deliveries = execute_query("SELECT DISTINCT di.reference_sd_document, di.delivery_document FROM outbound_delivery_items di LIMIT 50")
    for d in deliveries:
        nodes.append({"id": f"del_{d['delivery_document']}", "label": f"DEL {d['delivery_document']}", "type": "delivery", "data": d})
        edges.append({"source": f"so_{d['reference_sd_document']}", "target": f"del_{d['delivery_document']}", "label": "delivered_via"})

    billings = execute_query("SELECT DISTINCT bi.reference_sd_document, bi.billing_document FROM billing_document_items bi LIMIT 50")
    for b in billings:
        nodes.append({"id": f"bill_{b['billing_document']}", "label": f"BILL {b['billing_document']}", "type": "billing", "data": b})
        edges.append({"source": f"del_{b['reference_sd_document']}", "target": f"bill_{b['billing_document']}", "label": "billed_as"})

    return {"nodes": nodes, "edges": edges}


@router.get("/graph/clusters")
async def get_graph_clusters():
    customers = execute_query("""
        SELECT bp.business_partner, bp.full_name,
               COUNT(DISTINCT s.sales_order) as order_count,
               SUM(s.total_net_amount) as total_value,
               COUNT(DISTINCT b.billing_document) as billing_count,
               COUNT(DISTINCT d.delivery_document) as delivery_count
        FROM business_partners bp
        LEFT JOIN sales_order_headers s ON s.sold_to_party = bp.business_partner
        LEFT JOIN outbound_delivery_items di ON di.reference_sd_document = s.sales_order
        LEFT JOIN outbound_delivery_headers d ON d.delivery_document = di.delivery_document
        LEFT JOIN billing_document_items bi ON bi.reference_sd_document = d.delivery_document
        LEFT JOIN billing_document_headers b ON b.billing_document = bi.billing_document
        GROUP BY bp.business_partner, bp.full_name
        ORDER BY total_value DESC NULLS LAST
    """)

    clusters = []
    for c in customers:
        total = float(c["total_value"] or 0)
        orders = int(c["order_count"] or 0)
        billings = int(c["billing_count"] or 0)
        deliveries = int(c["delivery_count"] or 0)

        if total > 50000 or orders > 20:
            tier = "HIGH"
            color = "#ef4444"
        elif total > 20000 or orders > 10:
            tier = "MEDIUM"
            color = "#f59e0b"
        else:
            tier = "LOW"
            color = "#10b981"

        clusters.append({
            "customer": c["business_partner"],
            "name": c["full_name"],
            "tier": tier,
            "color": color,
            "order_count": orders,
            "total_value": round(total, 2),
            "billing_count": billings,
            "delivery_count": deliveries,
            "has_broken_flow": orders > 0 and billings == 0
        })

    summary = {
        "total_customers": len(clusters),
        "high_value": len([c for c in clusters if c["tier"] == "HIGH"]),
        "medium_value": len([c for c in clusters if c["tier"] == "MEDIUM"]),
        "low_value": len([c for c in clusters if c["tier"] == "LOW"]),
        "broken_flows": len([c for c in clusters if c["has_broken_flow"]])
    }

    return {"clusters": clusters, "summary": summary}


@router.get("/graph/analytics")
async def get_graph_analytics():
    top_products = execute_query("""
        SELECT bi.material, p.product_old_id,
               COUNT(DISTINCT bi.billing_document) as billing_count,
               SUM(bi.net_amount) as total_revenue
        FROM billing_document_items bi
        LEFT JOIN products p ON p.product = bi.material
        GROUP BY bi.material, p.product_old_id
        ORDER BY billing_count DESC LIMIT 5
    """)

    broken_flows = execute_query("""
        SELECT COUNT(DISTINCT s.sales_order) as count
        FROM sales_order_headers s
        INNER JOIN outbound_delivery_items odi ON odi.reference_sd_document = s.sales_order
        WHERE s.sales_order NOT IN (
            SELECT DISTINCT bdi.reference_sd_document FROM billing_document_items bdi
            INNER JOIN outbound_delivery_headers odh ON odh.delivery_document = bdi.reference_sd_document
            WHERE bdi.reference_sd_document IS NOT NULL
        )
    """)

    total_revenue = execute_query("SELECT SUM(total_net_amount) as total FROM sales_order_headers")
    cancelled = execute_query("SELECT COUNT(*) as count FROM billing_document_headers WHERE is_cancelled = true")

    return {
        "top_products": top_products,
        "broken_flow_count": int(broken_flows[0]["count"] if broken_flows else 0),
        "total_revenue": float(total_revenue[0]["total"] or 0) if total_revenue else 0,
        "cancelled_billings": int(cancelled[0]["count"] if cancelled else 0)
    }


@router.get("/graph/trace/{billing_document}")
async def trace_billing_flow(billing_document: str):
    billing = execute_query(
        f"SELECT b.billing_document, b.billing_document_type, b.total_net_amount, b.is_cancelled, "
        f"b.sold_to_party, b.accounting_document, bp.full_name as customer_name "
        f"FROM billing_document_headers b "
        f"LEFT JOIN business_partners bp ON bp.business_partner = b.sold_to_party "
        f"WHERE b.billing_document = '{billing_document}'"
    )

    if not billing:
        return {"error": f"Billing document {billing_document} not found"}

    billing_items = execute_query(
        f"SELECT billing_document_item, material, billing_quantity, net_amount, reference_sd_document "
        f"FROM billing_document_items WHERE billing_document = '{billing_document}'"
    )

    delivery_docs = list(set([i["reference_sd_document"] for i in billing_items if i["reference_sd_document"]]))
    deliveries = []
    sales_orders = []

    for del_doc in delivery_docs:
        del_header = execute_query(
            f"SELECT delivery_document, creation_date, overall_goods_movement_status, overall_picking_status "
            f"FROM outbound_delivery_headers WHERE delivery_document = '{del_doc}'"
        )
        if del_header:
            deliveries.extend(del_header)

        del_items = execute_query(
            f"SELECT DISTINCT reference_sd_document FROM outbound_delivery_items WHERE delivery_document = '{del_doc}'"
        )
        for di in del_items:
            so = di["reference_sd_document"]
            if so:
                so_data = execute_query(
                    f"SELECT s.sales_order, s.total_net_amount, s.overall_delivery_status, s.overall_billing_status, "
                    f"s.creation_date, bp.full_name as customer_name "
                    f"FROM sales_order_headers s "
                    f"LEFT JOIN business_partners bp ON bp.business_partner = s.sold_to_party "
                    f"WHERE s.sales_order = '{so}'"
                )
                sales_orders.extend(so_data)

    acct_doc = billing[0].get("accounting_document")
    journal = execute_query(
        f"SELECT accounting_document, amount_in_transaction_currency, posting_date, clearing_date, accounting_document_type "
        f"FROM journal_entry_items WHERE accounting_document = '{acct_doc}'"
    ) if acct_doc else []

    payments = execute_query(
        f"SELECT accounting_document, amount_in_transaction_currency, posting_date, clearing_date, clearing_accounting_document "
        f"FROM payments_accounts_receivable WHERE accounting_document = '{acct_doc}'"
    ) if acct_doc else []

    return {"flow": {"billing_document": billing[0], "billing_items": billing_items, "deliveries": deliveries, "sales_orders": sales_orders, "journal_entries": journal, "payments": payments}}