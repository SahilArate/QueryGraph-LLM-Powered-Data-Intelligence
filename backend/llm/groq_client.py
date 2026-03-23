import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

SCHEMA_CONTEXT = """
You are an expert SQL assistant for a SAP Order-to-Cash (O2C) database.

TABLES AVAILABLE:
- business_partners(business_partner, customer, full_name, grouping, is_blocked, creation_date)
- products(product, product_type, product_old_id, product_group, base_unit, gross_weight, net_weight)
- sales_order_headers(sales_order, sales_order_type, sold_to_party, creation_date, total_net_amount, transaction_currency, overall_delivery_status, overall_billing_status)
- sales_order_items(sales_order, sales_order_item, material, requested_quantity, net_amount, production_plant, storage_location)
- outbound_delivery_headers(delivery_document, creation_date, shipping_point, overall_goods_movement_status, overall_picking_status)
- outbound_delivery_items(delivery_document, delivery_document_item, reference_sd_document, reference_sd_document_item, plant, storage_location, actual_delivery_quantity)
- billing_document_headers(billing_document, billing_document_type, sold_to_party, creation_date, total_net_amount, is_cancelled, accounting_document)
- billing_document_items(billing_document, billing_document_item, material, billing_quantity, net_amount, reference_sd_document, reference_sd_document_item)
- payments_accounts_receivable(accounting_document, accounting_document_item, customer, amount_in_transaction_currency, posting_date, clearing_date, clearing_accounting_document)
- journal_entry_items(accounting_document, accounting_document_item, customer, gl_account, reference_document, amount_in_transaction_currency, posting_date, clearing_date, accounting_document_type)

KEY RELATIONSHIPS:
- sales_order_headers.sold_to_party -> business_partners.business_partner
- sales_order_items.sales_order -> sales_order_headers.sales_order
- sales_order_items.material -> products.product
- outbound_delivery_items.reference_sd_document -> sales_order_headers.sales_order (delivery links to sales order)
- billing_document_items.reference_sd_document -> outbound_delivery_headers.delivery_document (billing links to delivery)
- billing_document_headers.accounting_document -> journal_entry_items.accounting_document
- payments_accounts_receivable.accounting_document -> billing_document_headers.accounting_document

EXAMPLE QUERIES FOR COMMON QUESTIONS:

1. Products with most billing documents:
SELECT bi.material, p.product_old_id, COUNT(DISTINCT bi.billing_document) as billing_count
FROM billing_document_items bi
LEFT JOIN products p ON p.product = bi.material
GROUP BY bi.material, p.product_old_id
ORDER BY billing_count DESC
LIMIT 10;

2. Sales orders delivered but NOT billed (broken flow):
SELECT DISTINCT s.sales_order, s.sold_to_party, s.total_net_amount, s.overall_delivery_status
FROM sales_order_headers s
INNER JOIN outbound_delivery_items odi ON odi.reference_sd_document = s.sales_order
WHERE s.sales_order NOT IN (
    SELECT DISTINCT bdi.reference_sd_document
    FROM billing_document_items bdi
    INNER JOIN outbound_delivery_headers odh ON odh.delivery_document = bdi.reference_sd_document
    WHERE bdi.reference_sd_document IS NOT NULL
)
LIMIT 50;

3. Billed without delivery (broken flow):
SELECT DISTINCT b.billing_document, b.sold_to_party, b.total_net_amount
FROM billing_document_headers b
INNER JOIN billing_document_items bi ON bi.billing_document = b.billing_document
WHERE bi.reference_sd_document NOT IN (
    SELECT delivery_document FROM outbound_delivery_headers
)
LIMIT 50;

4. Full customer order summary:
SELECT bp.full_name, COUNT(DISTINCT s.sales_order) as order_count,
       SUM(s.total_net_amount) as total_value
FROM sales_order_headers s
JOIN business_partners bp ON bp.business_partner = s.sold_to_party
GROUP BY bp.full_name
ORDER BY total_value DESC;

RULES:
- Only generate SELECT queries, never INSERT/UPDATE/DELETE/DROP
- Always use table aliases for clarity
- Limit results to 100 rows unless asked otherwise
- Return ONLY the SQL query, no explanation, no markdown, no backticks
- For broken flow queries always use the NOT IN or LEFT JOIN ... IS NULL pattern
"""

GUARDRAIL_PROMPT = """
You are a strict classifier. Determine if the user's question is related to 
SAP Order-to-Cash business data (sales orders, deliveries, billing, payments, products, customers).

Reply with only one word: ALLOWED or BLOCKED

Question: {question}
"""


def check_guardrail(question: str) -> bool:
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": GUARDRAIL_PROMPT.format(question=question)}],
        max_tokens=10,
        temperature=0
    )
    result = response.choices[0].message.content.strip().upper()
    return result == "ALLOWED"


def generate_sql(question: str, conversation_history: list = []) -> str:
    messages = [{"role": "system", "content": SCHEMA_CONTEXT}]
    messages += conversation_history
    messages.append({"role": "user", "content": f"Generate SQL for: {question}"})

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        max_tokens=500,
        temperature=0
    )
    return response.choices[0].message.content.strip()


def generate_answer(question: str, sql: str, results: list) -> str:
    prompt = f"""
You are a helpful SAP data analyst. The user asked a question, we ran a SQL query, and got results.
Give a clear, concise natural language answer based only on the data provided.

User question: {question}
SQL executed: {sql}
Query results: {results}

Answer in 2-4 sentences. Be specific with numbers and names from the data.
If results are empty, say no matching records were found and suggest rephrasing.
"""
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=300,
        temperature=0.3
    )
    return response.choices[0].message.content.strip()


def should_use_trace(question: str) -> bool:
    keywords = ["trace", "full flow", "end to end", "track", "journey"]
    return any(k in question.lower() for k in keywords)


def extract_billing_id(question: str) -> str | None:
    import re
    match = re.search(r'\b9\d{7}\b', question)
    return match.group(0) if match else None