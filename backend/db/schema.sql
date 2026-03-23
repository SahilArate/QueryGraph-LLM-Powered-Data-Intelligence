CREATE TABLE IF NOT EXISTS business_partners (
    business_partner TEXT PRIMARY KEY,
    customer TEXT,
    full_name TEXT,
    grouping TEXT,
    is_blocked BOOLEAN,
    is_archived BOOLEAN,
    creation_date TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    product TEXT PRIMARY KEY,
    product_type TEXT,
    product_old_id TEXT,
    product_group TEXT,
    base_unit TEXT,
    gross_weight NUMERIC,
    net_weight NUMERIC,
    weight_unit TEXT,
    division TEXT
);

CREATE TABLE IF NOT EXISTS sales_order_headers (
    sales_order TEXT PRIMARY KEY,
    sales_order_type TEXT,
    sold_to_party TEXT REFERENCES business_partners(business_partner),
    creation_date TIMESTAMP,
    total_net_amount NUMERIC,
    transaction_currency TEXT,
    overall_delivery_status TEXT,
    overall_billing_status TEXT,
    requested_delivery_date TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales_order_items (
    sales_order TEXT REFERENCES sales_order_headers(sales_order),
    sales_order_item TEXT,
    material TEXT REFERENCES products(product),
    requested_quantity NUMERIC,
    quantity_unit TEXT,
    net_amount NUMERIC,
    production_plant TEXT,
    storage_location TEXT,
    PRIMARY KEY (sales_order, sales_order_item)
);

CREATE TABLE IF NOT EXISTS outbound_delivery_headers (
    delivery_document TEXT PRIMARY KEY,
    creation_date TIMESTAMP,
    shipping_point TEXT,
    overall_goods_movement_status TEXT,
    overall_picking_status TEXT,
    delivery_block_reason TEXT
);

CREATE TABLE IF NOT EXISTS outbound_delivery_items (
    delivery_document TEXT REFERENCES outbound_delivery_headers(delivery_document),
    delivery_document_item TEXT,
    reference_sd_document TEXT,
    reference_sd_document_item TEXT,
    plant TEXT,
    storage_location TEXT,
    actual_delivery_quantity NUMERIC,
    PRIMARY KEY (delivery_document, delivery_document_item)
);

CREATE TABLE IF NOT EXISTS billing_document_headers (
    billing_document TEXT PRIMARY KEY,
    billing_document_type TEXT,
    sold_to_party TEXT,
    creation_date TIMESTAMP,
    billing_document_date TIMESTAMP,
    total_net_amount NUMERIC,
    transaction_currency TEXT,
    is_cancelled BOOLEAN,
    accounting_document TEXT,
    fiscal_year TEXT,
    company_code TEXT
);

CREATE TABLE IF NOT EXISTS billing_document_items (
    billing_document TEXT REFERENCES billing_document_headers(billing_document),
    billing_document_item TEXT,
    material TEXT,
    billing_quantity NUMERIC,
    net_amount NUMERIC,
    reference_sd_document TEXT,
    reference_sd_document_item TEXT,
    PRIMARY KEY (billing_document, billing_document_item)
);

CREATE TABLE IF NOT EXISTS payments_accounts_receivable (
    accounting_document TEXT,
    accounting_document_item TEXT,
    company_code TEXT,
    fiscal_year TEXT,
    customer TEXT,
    amount_in_transaction_currency NUMERIC,
    transaction_currency TEXT,
    posting_date TIMESTAMP,
    clearing_date TIMESTAMP,
    clearing_accounting_document TEXT,
    gl_account TEXT,
    PRIMARY KEY (accounting_document, accounting_document_item)
);

CREATE TABLE IF NOT EXISTS journal_entry_items (
    accounting_document TEXT,
    accounting_document_item TEXT,
    company_code TEXT,
    fiscal_year TEXT,
    customer TEXT,
    gl_account TEXT,
    reference_document TEXT,
    amount_in_transaction_currency NUMERIC,
    transaction_currency TEXT,
    posting_date TIMESTAMP,
    clearing_date TIMESTAMP,
    clearing_accounting_document TEXT,
    accounting_document_type TEXT,
    PRIMARY KEY (accounting_document, accounting_document_item)
);