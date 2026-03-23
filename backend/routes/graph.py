from fastapi import APIRouter
from db.postgres import execute_query

router = APIRouter()

@router.get("/graph/nodes")
async def get_graph_data():
    nodes = []
    edges = []

    # Sales orders
    orders = execute_query("SELECT sales_order, sold_to_party, total_net_amount, overall_delivery_status FROM sales_order_headers LIMIT 50")
    for o in orders:
        nodes.append({"id": f"so_{o['sales_order']}", "label": f"SO {o['sales_order']}", "type": "sales_order", "data": o})

    # Business partners
    partners = execute_query("SELECT business_partner, full_name FROM business_partners")
    for p in partners:
        nodes.append({"id": f"bp_{p['business_partner']}", "label": p['full_name'] or p['business_partner'], "type": "business_partner", "data": p})
        edges.append({"source": f"bp_{p['business_partner']}", "target": f"so_{p['business_partner']}", "label": "places"})

    # Deliveries
    deliveries = execute_query("SELECT DISTINCT di.reference_sd_document, di.delivery_document FROM outbound_delivery_items di LIMIT 50")
    for d in deliveries:
        nodes.append({"id": f"del_{d['delivery_document']}", "label": f"DEL {d['delivery_document']}", "type": "delivery", "data": d})
        edges.append({"source": f"so_{d['reference_sd_document']}", "target": f"del_{d['delivery_document']}", "label": "delivered_via"})

    # Billing docs
    billings = execute_query("SELECT DISTINCT bi.reference_sd_document, bi.billing_document FROM billing_document_items bi LIMIT 50")
    for b in billings:
        nodes.append({"id": f"bill_{b['billing_document']}", "label": f"BILL {b['billing_document']}", "type": "billing", "data": b})
        edges.append({"source": f"del_{b['reference_sd_document']}", "target": f"bill_{b['billing_document']}", "label": "billed_as"})

    return {"nodes": nodes, "edges": edges}