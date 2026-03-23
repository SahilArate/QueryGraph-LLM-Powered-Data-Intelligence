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
- sales_order_headers.sold_to_party → business_partners.business_partner
- sales_order_items.sales_order → sales_order_headers.sales_order
- sales_order_items.material → products.product
- outbound_delivery_items.reference_sd_document → sales_order_headers.sales_order
- billing_document_items.reference_sd_document → outbound_delivery_headers.delivery_document
- billing_document_headers.accounting_document → journal_entry_items.accounting_document
- payments_accounts_receivable.accounting_document → billing_document_headers.accounting_document

RULES:
- Only generate SELECT queries, never INSERT/UPDATE/DELETE/DROP
- Always use table aliases for clarity
- Limit results to 100 rows unless asked otherwise
- Return ONLY the SQL query, no explanation, no markdown, no backticks
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
"""
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=300,
        temperature=0.3
    )
    return response.choices[0].message.content.strip()