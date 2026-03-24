import os
import psycopg2
from psycopg2.extras import RealDictCursor
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()

pg_conn = psycopg2.connect(os.getenv("DATABASE_URL"))
neo4j_driver = GraphDatabase.driver(
    os.getenv("NEO4J_URI"),
    auth=(os.getenv("NEO4J_USERNAME"), os.getenv("NEO4J_PASSWORD"))
)

def pg_query(sql):
    with pg_conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql)
        return [dict(r) for r in cur.fetchall()]

def ingest_to_neo4j():
    with neo4j_driver.session() as session:

        # Clear existing data
        session.run("MATCH (n) DETACH DELETE n")
        print("✅ Cleared existing Neo4j data")

        # Create Business Partner nodes
        partners = pg_query("SELECT business_partner, full_name, is_blocked FROM business_partners")
        for p in partners:
            session.run("""
                MERGE (bp:BusinessPartner {id: $id})
                SET bp.name = $name, bp.is_blocked = $is_blocked
            """, id=p["business_partner"], name=p["full_name"], is_blocked=p["is_blocked"])
        print(f"✅ Created {len(partners)} BusinessPartner nodes")

        # Create Product nodes
        products = pg_query("SELECT product, product_old_id, product_group, product_type FROM products")
        for p in products:
            session.run("""
                MERGE (pr:Product {id: $id})
                SET pr.old_id = $old_id, pr.group = $group, pr.type = $type
            """, id=p["product"], old_id=p["product_old_id"],
                group=p["product_group"], type=p["product_type"])
        print(f"✅ Created {len(products)} Product nodes")

        # Create SalesOrder nodes + relationships
        orders = pg_query("SELECT sales_order, sold_to_party, total_net_amount, overall_delivery_status, overall_billing_status FROM sales_order_headers")
        for o in orders:
            session.run("""
                MERGE (so:SalesOrder {id: $id})
                SET so.amount = $amount,
                    so.delivery_status = $delivery_status,
                    so.billing_status = $billing_status
            """, id=o["sales_order"], amount=float(o["total_net_amount"] or 0),
                delivery_status=o["overall_delivery_status"],
                billing_status=o["overall_billing_status"])

            # SalesOrder → BusinessPartner
            if o["sold_to_party"]:
                session.run("""
                    MATCH (so:SalesOrder {id: $so_id})
                    MATCH (bp:BusinessPartner {id: $bp_id})
                    MERGE (bp)-[:PLACED]->(so)
                """, so_id=o["sales_order"], bp_id=o["sold_to_party"])
        print(f"✅ Created {len(orders)} SalesOrder nodes + PLACED relationships")

        # Create SalesOrderItem nodes + relationships
        items = pg_query("SELECT sales_order, sales_order_item, material, net_amount FROM sales_order_items")
        for i in items:
            item_id = f"{i['sales_order']}-{i['sales_order_item']}"
            session.run("""
                MERGE (soi:SalesOrderItem {id: $id})
                SET soi.amount = $amount
            """, id=item_id, amount=float(i["net_amount"] or 0))

            # SalesOrder → SalesOrderItem
            session.run("""
                MATCH (so:SalesOrder {id: $so_id})
                MATCH (soi:SalesOrderItem {id: $item_id})
                MERGE (so)-[:HAS_ITEM]->(soi)
            """, so_id=i["sales_order"], item_id=item_id)

            # SalesOrderItem → Product
            if i["material"]:
                session.run("""
                    MATCH (soi:SalesOrderItem {id: $item_id})
                    MATCH (pr:Product {id: $product_id})
                    MERGE (soi)-[:IS_PRODUCT]->(pr)
                """, item_id=item_id, product_id=i["material"])
        print(f"✅ Created {len(items)} SalesOrderItem nodes")

        # Create Delivery nodes + relationships
        deliveries = pg_query("SELECT delivery_document, overall_goods_movement_status, overall_picking_status FROM outbound_delivery_headers")
        for d in deliveries:
            session.run("""
                MERGE (del:Delivery {id: $id})
                SET del.goods_status = $goods_status,
                    del.picking_status = $picking_status
            """, id=d["delivery_document"],
                goods_status=d["overall_goods_movement_status"],
                picking_status=d["overall_picking_status"])
        print(f"✅ Created {len(deliveries)} Delivery nodes")

        # SalesOrder → Delivery relationships
        del_items = pg_query("SELECT DISTINCT delivery_document, reference_sd_document FROM outbound_delivery_items WHERE reference_sd_document IS NOT NULL")
        for di in del_items:
            session.run("""
                MATCH (so:SalesOrder {id: $so_id})
                MATCH (del:Delivery {id: $del_id})
                MERGE (so)-[:HAS_DELIVERY]->(del)
            """, so_id=di["reference_sd_document"], del_id=di["delivery_document"])
        print(f"✅ Created SalesOrder→Delivery relationships")

        # Create Billing nodes + relationships
        billings = pg_query("SELECT billing_document, total_net_amount, is_cancelled, accounting_document FROM billing_document_headers")
        for b in billings:
            session.run("""
                MERGE (bill:BillingDocument {id: $id})
                SET bill.amount = $amount,
                    bill.is_cancelled = $is_cancelled,
                    bill.accounting_document = $acct_doc
            """, id=b["billing_document"],
                amount=float(b["total_net_amount"] or 0),
                is_cancelled=b["is_cancelled"],
                acct_doc=b["accounting_document"])
        print(f"✅ Created {len(billings)} BillingDocument nodes")

        # Delivery → Billing relationships
        bill_items = pg_query("SELECT DISTINCT billing_document, reference_sd_document FROM billing_document_items WHERE reference_sd_document IS NOT NULL")
        for bi in bill_items:
            session.run("""
                MATCH (del:Delivery {id: $del_id})
                MATCH (bill:BillingDocument {id: $bill_id})
                MERGE (del)-[:HAS_BILLING]->(bill)
            """, del_id=bi["reference_sd_document"], bill_id=bi["billing_document"])
        print(f"✅ Created Delivery→Billing relationships")

        # Create Payment nodes + relationships
        payments = pg_query("SELECT DISTINCT accounting_document, customer, amount_in_transaction_currency, clearing_date FROM payments_accounts_receivable")
        for p in payments:
            session.run("""
                MERGE (pay:Payment {id: $id})
                SET pay.amount = $amount, pay.customer = $customer
            """, id=p["accounting_document"],
                amount=float(p["amount_in_transaction_currency"] or 0),
                customer=p["customer"])

            # BillingDocument → Payment
            session.run("""
                MATCH (bill:BillingDocument {accounting_document: $acct_doc})
                MATCH (pay:Payment {id: $pay_id})
                MERGE (bill)-[:HAS_PAYMENT]->(pay)
            """, acct_doc=p["accounting_document"], pay_id=p["accounting_document"])
        print(f"✅ Created {len(payments)} Payment nodes")

    print("\n🎉 Neo4j graph fully populated!")

if __name__ == "__main__":
    print("Testing Neo4j connection...")
    with neo4j_driver.session() as session:
        result = session.run("RETURN 1 as test")
        print(f"✅ Neo4j connected!")
    ingest_to_neo4j()
    pg_conn.close()
    neo4j_driver.close()