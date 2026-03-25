# QueryGraph — LLM-Powered SAP O2C Intelligence

> A context graph system that unifies fragmented SAP Order-to-Cash data into an interactive knowledge graph with a natural language query interface powered by Groq's LLaMA 3.3 70B.

**Live Demo:** `https://query-graph-llm-powered-data-intell.vercel.app/`  
**Backend API:** `https://querygraph-llm-powered-data-intelligence.onrender.com`  
**GitHub:** `https://github.com/SahilArate/QueryGraph-LLM-Powered-Data-Intelligence`

---

## What This Builds

In real SAP environments, business data is fragmented across dozens of tables — orders, deliveries, invoices, payments — with no unified way to trace how they connect. This system solves that by:

1. **Unifying** the SAP O2C dataset into a graph of interconnected entities
2. **Visualizing** that graph interactively — hover for metadata, click to pin, edges show relationships
3. **Querying** the graph with natural language — the LLM generates SQL dynamically, executes it, and returns data-backed answers
4. **Analyzing** customer clusters, broken flows, and product performance automatically

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js 14)                     │
│                                                                   │
│  ┌─────────────────────┐    ┌──────────────────────────────────┐ │
│  │   Graph Panel        │    │  Chat + Analytics Panel          │ │
│  │   Cytoscape.js       │    │  Streaming SSE responses         │ │
│  │   Hover tooltips     │    │  Graph clustering view           │ │
│  │   Node highlighting  │    │  Top products analysis           │ │
│  └─────────────────────┘    └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │ REST + SSE
┌─────────────────────────────────────────────────────────────────┐
│                       BACKEND (FastAPI)                           │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  /api/query  │  │  /api/graph  │  │  /api/query/stream   │   │
│  │  NL → SQL    │  │  nodes       │  │  SSE streaming       │   │
│  │  Guardrails  │  │  clusters    │  │  Token by token      │   │
│  │  Trace flow  │  │  analytics   │  │  response delivery   │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐  │
│  │     Groq LLM Client      │  │       Guardrail Engine       │  │
│  │  llama-3.3-70b-versatile │  │  LLM-based domain classifier │  │
│  │  SQL generation          │  │  Blocks off-topic queries    │  │
│  │  Answer synthesis        │  │  Zero hallucination policy   │  │
│  └──────────────────────────┘  └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                    │                        │
        ┌───────────┘                        └───────────┐
        ▼                                                ▼
┌──────────────────┐                      ┌─────────────────────┐
│   PostgreSQL     │                      │    Neo4j AuraDB     │
│   (Neon.tech)    │                      │   (Free Tier)       │
│                  │                      │                     │
│  Raw data store  │                      │  Graph relationships│
│  SQL analytics   │                      │  Node traversal     │
│  Aggregations    │                      │  Cypher queries     │
│  Broken flows    │                      │  Path finding       │
└──────────────────┘                      └─────────────────────┘
```

---

## Database Architecture Decisions

### Why Two Databases?

This is the most important architectural decision in the project. I chose a **dual-database architecture** — PostgreSQL for analytical queries and Neo4j for graph relationships — because they solve fundamentally different problems.

#### PostgreSQL (Neon.tech Serverless)

**Used for:** Raw data storage, SQL analytics, aggregations, broken flow detection.

PostgreSQL excels at the analytical queries this system needs most:

```sql
-- Broken flow detection — sales orders delivered but never billed
SELECT DISTINCT s.sales_order, s.sold_to_party, s.total_net_amount
FROM sales_order_headers s
INNER JOIN outbound_delivery_items odi ON odi.reference_sd_document = s.sales_order
WHERE s.sales_order NOT IN (
    SELECT DISTINCT bdi.reference_sd_document
    FROM billing_document_items bdi
    INNER JOIN outbound_delivery_headers odh 
        ON odh.delivery_document = bdi.reference_sd_document
)
```

This kind of multi-table aggregation is exactly what relational databases are built for. Trying to do this in a graph database would be more complex with worse performance.

**Why Neon over local PostgreSQL:** Neon is serverless PostgreSQL — it scales to zero when idle (critical for a demo deployment), has a generous free tier, and supports standard `psycopg2` connections without configuration overhead.

#### Neo4j AuraDB (Free Tier)

**Used for:** Storing and traversing the graph structure — nodes and their relationships.

Neo4j's Cypher language makes relationship traversal natural:

```cypher
-- Trace complete O2C flow for a business partner
MATCH (bp:BusinessPartner)-[:PLACED]->(so:SalesOrder)
      -[:HAS_DELIVERY]->(del:Delivery)
      -[:HAS_BILLING]->(bill:BillingDocument)
      -[:HAS_PAYMENT]->(pay:Payment)
WHERE bp.id = '310000108'
RETURN bp, so, del, bill, pay
```

The same query in PostgreSQL would require 4 JOINs across 5 tables. For the graph visualization layer, Neo4j is the right tool.

**The Tradeoff:** Running two databases adds operational complexity. The decision to accept this complexity is justified because each database is used for what it does best — PostgreSQL for "give me counts and aggregations", Neo4j for "show me how these entities connect".

---

## Graph Modelling

### Entity Nodes

| Node Type | Source Table | Key Properties |
|---|---|---|
| `BusinessPartner` | `business_partners` | id, name, is_blocked |
| `SalesOrder` | `sales_order_headers` | id, amount, delivery_status, billing_status |
| `SalesOrderItem` | `sales_order_items` | id, amount |
| `Product` | `products` | id, old_id, group, type |
| `Delivery` | `outbound_delivery_headers` | id, goods_status, picking_status |
| `BillingDocument` | `billing_document_headers` | id, amount, is_cancelled, acct_doc |
| `Payment` | `payments_accounts_receivable` | id, amount, customer |

### Relationships (Edges)

```
BusinessPartner ──[PLACED]──────────────► SalesOrder
SalesOrder      ──[HAS_ITEM]────────────► SalesOrderItem
SalesOrderItem  ──[IS_PRODUCT]──────────► Product
SalesOrder      ──[HAS_DELIVERY]────────► Delivery
Delivery        ──[HAS_BILLING]─────────► BillingDocument
BillingDocument ──[HAS_PAYMENT]─────────► Payment
```

This models the complete SAP Order-to-Cash flow: a customer places an order → items are picked from products → goods are delivered → an invoice is raised → payment is collected.

### Why This Modelling Matters

The relationship chain `BusinessPartner → SalesOrder → Delivery → BillingDocument → Payment` directly maps to the O2C business process. A "broken flow" is simply a node in this chain that has no outgoing edge where one is expected — for example, a `SalesOrder` node with a `HAS_DELIVERY` edge but no `HAS_BILLING` edge downstream.

---

## LLM Integration & Prompting Strategy

### The NL → SQL Pipeline

```
User Question
     │
     ▼
┌─────────────────┐
│  Guardrail Check │  ← LLM classifies: ALLOWED or BLOCKED
└─────────────────┘
     │ ALLOWED
     ▼
┌─────────────────┐
│  Trace Detector  │  ← Regex: does question mention "trace/flow/track"?
└─────────────────┘
     │ Standard query
     ▼
┌─────────────────┐
│  SQL Generator   │  ← LLM generates SELECT query with schema context
└─────────────────┘
     │
     ▼
┌─────────────────┐
│  Query Executor  │  ← psycopg2 executes against PostgreSQL
└─────────────────┘
     │
     ▼
┌─────────────────┐
│ Answer Synthesizer│ ← LLM converts raw results to natural language
└─────────────────┘
     │
     ▼
Streamed response to UI (token by token via SSE)
```

### System Prompt Design

The SQL generation prompt includes:
- **Full schema context** — all 10 table definitions with column names
- **Explicit relationship mappings** — `outbound_delivery_items.reference_sd_document → sales_order_headers.sales_order`
- **Example queries** — for broken flows, traces, and aggregations
- **Hard rules** — `SELECT only`, `LIMIT 100`, `no markdown in output`

```python
SCHEMA_CONTEXT = """
You are an expert SQL assistant for a SAP Order-to-Cash (O2C) database.
...
RULES:
- Only generate SELECT queries, never INSERT/UPDATE/DELETE/DROP
- Return ONLY the SQL query, no explanation, no markdown, no backticks
"""
```

The key insight here is **few-shot prompting via examples** — embedding example SQL for common query patterns (especially broken flows) dramatically reduces LLM errors on complex multi-table queries.

### Why Groq over OpenAI/Gemini

- **Speed:** Groq's LPU architecture delivers ~10x faster inference than OpenAI — critical for streaming UX
- **Free tier:** No cost for this assignment
- **llama-3.3-70b-versatile:** Strong SQL generation capability, better than smaller models for complex JOIN logic

### Streaming Implementation

Responses stream token-by-token using FastAPI's `StreamingResponse` with Server-Sent Events:

```python
async def stream_response():
    stream = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[...],
        stream=True  # ← Groq streams tokens
    )
    for chunk in stream:
        token = chunk.choices[0].delta.content
        if token:
            yield f"data: {json.dumps({'token': token, 'done': False})}\n\n"
    yield f"data: {json.dumps({'done': True, 'sql': sql, 'results': results})}\n\n"
```

The frontend reads the SSE stream and appends each token to the message in real time — identical to ChatGPT's typing effect.

---

## Guardrails

Guardrails are an explicit evaluation criterion. Here's how they work:

### Layer 1 — LLM Domain Classifier

Every query goes through an LLM-based classifier before any SQL is generated:

```python
GUARDRAIL_PROMPT = """
You are a strict classifier. Determine if the user's question is related to 
SAP Order-to-Cash business data (sales orders, deliveries, billing, payments, products, customers).

Reply with only one word: ALLOWED or BLOCKED

Question: {question}
"""
```

This approach is more robust than keyword filtering — it understands intent, not just surface words. "Show me the matrix" → BLOCKED. "Show me the billing matrix for customer X" → ALLOWED.

### Layer 2 — SQL Injection Prevention

The SQL generation prompt explicitly restricts output:
- `SELECT` only — no `INSERT`, `UPDATE`, `DELETE`, `DROP`
- Results capped at 100 rows
- All queries executed in read-only mode

### Layer 3 — Dedicated Trace Endpoint

Trace queries (`"trace the full flow of billing document X"`) are routed to a dedicated endpoint that runs hand-crafted SQL — bypassing LLM SQL generation entirely for the most complex query pattern. This eliminates a class of LLM errors on multi-hop JOIN queries.

### What Gets Blocked

| Query | Response |
|---|---|
| "Who is the president of India?" | BLOCKED |
| "Write me a poem" | BLOCKED |
| "What is 2+2?" | BLOCKED |
| "Show me all orders" | ALLOWED |
| "Which products have most billings?" | ALLOWED |

---

## Graph Clustering & Analytics

### Customer Clustering

Customers are automatically segmented into three tiers based on total order value and order count:

| Tier | Criteria | Color |
|---|---|---|
| HIGH | Revenue > ₹50K or Orders > 20 | Red |
| MEDIUM | Revenue > ₹20K or Orders > 10 | Amber |
| LOW | Below medium thresholds | Green |

Broken flow detection is overlaid — customers with orders but zero billing documents are flagged automatically.

### Analytics Endpoints

- `GET /api/graph/clusters` — customer segmentation with summary stats
- `GET /api/graph/analytics` — top products by billing count, broken flow count, total revenue, cancelled billings

---

## Example Queries

### 1. Products with highest billing documents
```
Which products are associated with the highest number of billing documents?
```
**Generated SQL:**
```sql
SELECT bi.material, p.product_old_id, 
       COUNT(DISTINCT bi.billing_document) as billing_count
FROM billing_document_items bi
LEFT JOIN products p ON p.product = bi.material
GROUP BY bi.material, p.product_old_id
ORDER BY billing_count DESC LIMIT 10;
```

### 2. Trace full O2C flow
```
Trace the full flow of billing document 90504204
```
Routes to dedicated `/api/graph/trace/{id}` endpoint — traverses:
`BillingDocument → Delivery → SalesOrder → BusinessPartner → JournalEntry → Payment`

### 3. Broken flows
```
Show sales orders delivered but not billed
```
**Generated SQL:**
```sql
SELECT DISTINCT s.sales_order, s.sold_to_party, s.total_net_amount
FROM sales_order_headers s
INNER JOIN outbound_delivery_items odi ON odi.reference_sd_document = s.sales_order
WHERE s.sales_order NOT IN (
    SELECT DISTINCT bdi.reference_sd_document
    FROM billing_document_items bdi
    INNER JOIN outbound_delivery_headers odh 
        ON odh.delivery_document = bdi.reference_sd_document
    WHERE bdi.reference_sd_document IS NOT NULL
)
```

---

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | Next.js 14 + TypeScript | React server components, easy Vercel deployment |
| Graph Viz | Cytoscape.js | Industry-standard for enterprise graph visualization |
| Styling | Tailwind CSS + inline styles | Rapid dark theme UI development |
| Backend | Python FastAPI | Best ecosystem for AI/LLM tooling, async support |
| Primary DB | PostgreSQL (Neon.tech) | Relational analytics, serverless, free tier |
| Graph DB | Neo4j AuraDB | Native graph storage and traversal |
| LLM | Groq (llama-3.3-70b) | Fastest inference, free tier, strong SQL generation |
| Streaming | FastAPI SSE | Native streaming without WebSocket overhead |
| Deployment | Vercel + Render | Zero-config deployment, free tiers |

---

## Project Structure

```
QueryGraph-LLM-Powered-Data-Intelligence/
├── frontend/                    # Next.js 14 application
│   ├── app/
│   │   └── page.tsx             # Main 2-panel layout
│   └── components/
│       ├── GraphPanel.tsx       # Cytoscape graph + hover tooltips
│       ├── ChatPanel.tsx        # Streaming chat interface
│       └── AnalyticsPanel.tsx   # Clustering + analytics view
│
├── backend/                     # FastAPI application
│   ├── main.py                  # App entry point + CORS
│   ├── routes/
│   │   ├── query.py             # NL→SQL pipeline + streaming
│   │   └── graph.py             # Graph data, trace, clusters, analytics
│   ├── db/
│   │   ├── postgres.py          # PostgreSQL connection + query executor
│   │   ├── neo4j_client.py      # Neo4j driver wrapper
│   │   ├── schema.sql           # PostgreSQL table definitions
│   │   ├── ingest.py            # JSONL → PostgreSQL ingestion
│   │   └── neo4j_ingest.py      # PostgreSQL → Neo4j graph population
│   └── llm/
│       └── groq_client.py       # Groq client, prompts, guardrails
│
├── data/                        # SAP O2C dataset (not committed)
│   └── sap-o2c-data/
│
└── .env.example                 # Environment variable template
```

---

## Setup & Running Locally

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL connection string (Neon.tech free tier)
- Neo4j AuraDB connection (free tier)
- Groq API key (free at console.groq.com)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
source venv/bin/activate       # Mac/Linux

pip install -r requirements.txt

# Copy and fill in your credentials
cp .env.example .env

# Ingest data into PostgreSQL
python db/ingest.py

# Populate Neo4j graph
python db/neo4j_ingest.py

# Start the API server
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install

# Create environment file
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

npm run dev
```

Open **http://localhost:3000**

---

## Environment Variables

```env
# PostgreSQL (Neon.tech)
DATABASE_URL=postgresql://username:password@host/dbname?sslmode=require

# Neo4j AuraDB
NEO4J_URI=neo4j+s://xxxxxxxx.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password

# Groq
GROQ_API_KEY=gsk_your_groq_api_key_here
```

---

## Deployment

**Frontend → Vercel**
- Root directory: `frontend`
- Environment variable: `NEXT_PUBLIC_API_URL=https://your-render-url.onrender.com`

**Backend → Render**
- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Add all 5 environment variables in Render dashboard

---

## AI Coding Session

This project was built using **Claude (Anthropic)** as the primary AI coding assistant. The complete session transcript covering architecture decisions, debugging workflow, and iteration patterns is included in the repository as `AI_SESSION_LOGS.md`.

Key areas where AI assistance was used:
- Schema design and relationship modelling decisions
- LLM prompt engineering for SQL generation and guardrails
- Debugging PostgreSQL connection issues and indentation errors
- Frontend component architecture and streaming SSE implementation
- Neo4j graph ingestion strategy

---

## Evaluation Criteria Coverage

| Criteria | Implementation |
|---|---|
| **Code quality & architecture** | Modular FastAPI routes, typed TypeScript components, clear separation of concerns |
| **Graph modelling** | 7 node types, 6 relationship types, dual-DB architecture matching query patterns to DB strengths |
| **Database / storage choice** | PostgreSQL for analytics + Neo4j for graph traversal — documented tradeoffs above |
| **LLM integration & prompting** | Schema-aware system prompt, few-shot examples, streaming SSE, conversation history |
| **Guardrails** | LLM domain classifier + SQL injection prevention + dedicated trace endpoint |

---

## Bonus Features Implemented

- ✅ **Natural language to SQL translation** — shown in query pipeline
- ✅ **Node highlighting** — chat responses highlight referenced nodes on graph
- ✅ **Streaming responses** — token-by-token SSE streaming via Groq
- ✅ **Conversation memory** — full history passed on each request
- ✅ **Graph clustering** — customer segmentation by value tier with broken flow detection
- ✅ **Graph analytics** — top products, revenue stats, cancelled billing count

---

*Built for Dodge AI Forward Deployed Engineer Assignment — March 2026*