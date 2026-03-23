import os, json, glob
from pathlib import Path
import psycopg2
from psycopg2.extras import execute_batch
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DATABASE_URL")
DATA_DIR = Path(__file__).parent.parent.parent / "data" / "sap-o2c-data"

def get_conn():
    return psycopg2.connect(DB_URL)

def load_jsonl(folder):
    records = []
    for f in glob.glob(str(DATA_DIR / folder / "*.jsonl")):
        with open(f) as fh:
            for line in fh:
                line = line.strip()
                if line:
                    records.append(json.loads(line))
    return records

def safe(val, cast=None):
    if val is None or val == "":
        return None
    try:
        return cast(val) if cast else val
    except:
        return None

def create_tables(conn):
    schema = (Path(__file__).parent / "schema.sql").read_text()
    with conn.cursor() as cur:
        cur.execute(schema)
    conn.commit()
    print("✅ Tables created")

def ingest_business_partners(conn):
    rows = load_jsonl("business_partners")
    data = [(
        r["businessPartner"], r.get("customer"),
        r.get("businessPartnerFullName"), r.get("businessPartnerGrouping"),
        r.get("businessPartnerIsBlocked"), r.get("isMarkedForArchiving"),
        safe(r.get("creationDate"))
    ) for r in rows]
    with conn.cursor() as cur:
        execute_batch(cur, """
            INSERT INTO business_partners VALUES (%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (business_partner) DO NOTHING
        """, data)
    conn.commit()
    print(f"✅ business_partners: {len(data)} rows")

def ingest_products(conn):
    rows = load_jsonl("products")
    data = [(
        r["product"], r.get("productType"), r.get("productOldId"),
        r.get("productGroup"), r.get("baseUnit"),
        safe(r.get("grossWeight"), float), safe(r.get("netWeight"), float),
        r.get("weightUnit"), r.get("division")
    ) for r in rows]
    with conn.cursor() as cur:
        execute_batch(cur, """
            INSERT INTO products VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (product) DO NOTHING
        """, data)
    conn.commit()
    print(f"✅ products: {len(data)} rows")

def ingest_sales_order_headers(conn):
    rows = load_jsonl("sales_order_headers")
    data = [(
        r["salesOrder"], r.get("salesOrderType"), r.get("soldToParty"),
        safe(r.get("creationDate")), safe(r.get("totalNetAmount"), float),
        r.get("transactionCurrency"), r.get("overallDeliveryStatus"),
        r.get("overallOrdReltdBillgStatus"), safe(r.get("requestedDeliveryDate"))
    ) for r in rows]
    with conn.cursor() as cur:
        execute_batch(cur, """
            INSERT INTO sales_order_headers VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (sales_order) DO NOTHING
        """, data)
    conn.commit()
    print(f"✅ sales_order_headers: {len(data)} rows")

def ingest_sales_order_items(conn):
    rows = load_jsonl("sales_order_items")
    data = [(
        r["salesOrder"], r["salesOrderItem"], r.get("material"),
        safe(r.get("requestedQuantity"), float), r.get("requestedQuantityUnit"),
        safe(r.get("netAmount"), float), r.get("productionPlant"), r.get("storageLocation")
    ) for r in rows]
    with conn.cursor() as cur:
        execute_batch(cur, """
            INSERT INTO sales_order_items VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (sales_order, sales_order_item) DO NOTHING
        """, data)
    conn.commit()
    print(f"✅ sales_order_items: {len(data)} rows")

def ingest_delivery_headers(conn):
    rows = load_jsonl("outbound_delivery_headers")
    data = [(
        r["deliveryDocument"], safe(r.get("creationDate")),
        r.get("shippingPoint"), r.get("overallGoodsMovementStatus"),
        r.get("overallPickingStatus"), r.get("deliveryBlockReason")
    ) for r in rows]
    with conn.cursor() as cur:
        execute_batch(cur, """
            INSERT INTO outbound_delivery_headers VALUES (%s,%s,%s,%s,%s,%s)
            ON CONFLICT (delivery_document) DO NOTHING
        """, data)
    conn.commit()
    print(f"✅ outbound_delivery_headers: {len(data)} rows")

def ingest_delivery_items(conn):
    rows = load_jsonl("outbound_delivery_items")
    data = [(
        r["deliveryDocument"], r["deliveryDocumentItem"],
        r.get("referenceSdDocument"), r.get("referenceSdDocumentItem"),
        r.get("plant"), r.get("storageLocation"),
        safe(r.get("actualDeliveryQuantity"), float)
    ) for r in rows]
    with conn.cursor() as cur:
        execute_batch(cur, """
            INSERT INTO outbound_delivery_items VALUES (%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (delivery_document, delivery_document_item) DO NOTHING
        """, data)
    conn.commit()
    print(f"✅ outbound_delivery_items: {len(data)} rows")

def ingest_billing_headers(conn):
    rows = load_jsonl("billing_document_headers")
    data = [(
        r["billingDocument"], r.get("billingDocumentType"), r.get("soldToParty"),
        safe(r.get("creationDate")), safe(r.get("billingDocumentDate")),
        safe(r.get("totalNetAmount"), float), r.get("transactionCurrency"),
        r.get("billingDocumentIsCancelled"), r.get("accountingDocument"),
        r.get("fiscalYear"), r.get("companyCode")
    ) for r in rows]
    with conn.cursor() as cur:
        execute_batch(cur, """
            INSERT INTO billing_document_headers VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (billing_document) DO NOTHING
        """, data)
    conn.commit()
    print(f"✅ billing_document_headers: {len(data)} rows")

def ingest_billing_items(conn):
    rows = load_jsonl("billing_document_items")
    data = [(
        r["billingDocument"], r["billingDocumentItem"], r.get("material"),
        safe(r.get("billingQuantity"), float), safe(r.get("netAmount"), float),
        r.get("referenceSdDocument"), r.get("referenceSdDocumentItem")
    ) for r in rows]
    with conn.cursor() as cur:
        execute_batch(cur, """
            INSERT INTO billing_document_items VALUES (%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (billing_document, billing_document_item) DO NOTHING
        """, data)
    conn.commit()
    print(f"✅ billing_document_items: {len(data)} rows")

def ingest_payments(conn):
    rows = load_jsonl("payments_accounts_receivable")
    data = [(
        r["accountingDocument"], r["accountingDocumentItem"],
        r.get("companyCode"), r.get("fiscalYear"), r.get("customer"),
        safe(r.get("amountInTransactionCurrency"), float),
        r.get("transactionCurrency"), safe(r.get("postingDate")),
        safe(r.get("clearingDate")), r.get("clearingAccountingDocument"),
        r.get("glAccount")
    ) for r in rows]
    with conn.cursor() as cur:
        execute_batch(cur, """
            INSERT INTO payments_accounts_receivable VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (accounting_document, accounting_document_item) DO NOTHING
        """, data)
    conn.commit()
    print(f"✅ payments: {len(data)} rows")

def ingest_journal_entries(conn):
    rows = load_jsonl("journal_entry_items_accounts_receivable")
    data = [(
        r["accountingDocument"], r["accountingDocumentItem"],
        r.get("companyCode"), r.get("fiscalYear"), r.get("customer"),
        r.get("glAccount"), r.get("referenceDocument"),
        safe(r.get("amountInTransactionCurrency"), float),
        r.get("transactionCurrency"), safe(r.get("postingDate")),
        safe(r.get("clearingDate")), r.get("clearingAccountingDocument"),
        r.get("accountingDocumentType")
    ) for r in rows]
    with conn.cursor() as cur:
        execute_batch(cur, """
            INSERT INTO journal_entry_items VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (accounting_document, accounting_document_item) DO NOTHING
        """, data)
    conn.commit()
    print(f"✅ journal_entries: {len(data)} rows")

if __name__ == "__main__":
    conn = get_conn()
    create_tables(conn)
    ingest_business_partners(conn)
    ingest_products(conn)
    ingest_sales_order_headers(conn)
    ingest_sales_order_items(conn)
    ingest_delivery_headers(conn)
    ingest_delivery_items(conn)
    ingest_billing_headers(conn)
    ingest_billing_items(conn)
    ingest_payments(conn)
    ingest_journal_entries(conn)
    conn.close()
    print("\n🎉 All data ingested successfully!")