# 🔮 GhostIntel

**Autonomous Company Intelligence and Knowledge Graph System**

GhostIntel is an autonomous company intelligence system that converts a company domain into structured, explainable, and graph-based business intelligence. It uses deterministic rules, heuristics, and graph-based logic for all extraction, validation, classification, and reasoning.

![GhostIntel](https://img.shields.io/badge/GhostIntel-v1.0.0-5b6cf1?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-3.13+-3776ab?style=for-the-badge&logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-18-61dafb?style=for-the-badge&logo=react&logoColor=black)

## ✨ Features

- **🕷️ Intelligent Crawling** - Automatically crawls and discovers all accessible pages using Crawl4AI
- **🤖 Groq LLM Extraction** - Powered by Groq for fast, intelligent entity extraction and classification
- **🏭 SIC Classification** - Industry classification using standardized SIC taxonomy
- **🔗 Knowledge Graph** - Builds relationships between companies, industries, and technologies
- **📈 Batch Processing** - Analyze up to 150 companies at once
- **🎨 Beautiful UI** - Modern React interface with Tailwind CSS
- **⚡ Lightning Fast** - Groq's ultra-fast inference for rapid company analysis

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Crawl Layer   │ → │  Groq LLM       │ → │  Classification │
│   (Crawl4AI)    │    │  Extraction     │    │  (SIC Codes)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React UI      │ ← │  FastAPI        │ ← │  Knowledge      │
│   (Tailwind)    │    │  Backend        │    │  Graph          │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Python 3.13+
- Node.js 18+ (for frontend)
- uv package manager

### Backend Setup

```bash
# Install dependencies
uv sync

# Run the API server
uv run python main.py
```

The API will be available at `http://localhost:8000`

### Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

The UI will be available at `http://localhost:5173`

## 📖 API Documentation

Once running, visit `http://localhost:8000/docs` for interactive API documentation.

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analyze` | POST | Analyze a company domain |
| `/api/companies` | GET | List all analyzed companies |
| `/api/companies/{domain}` | GET | Get company details |
| `/api/taxonomy` | GET | Get SIC taxonomy |
| `/api/graph` | GET | Get knowledge graph |
| `/api/analytics/summary` | GET | Get analytics summary |

### Example: Analyze a Company

```bash
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"domain": "example.com", "max_pages": 50}'
```

## 📁 Project Structure

```
ghostintel/
├── ghostintel/
│   ├── __init__.py
│   ├── main.py              # Entry point
│   ├── api/                  # FastAPI routes
│   ├── crawler/              # Crawl4AI integration
│   ├── extraction/           # Entity extraction
│   ├── classification/       # SIC classification
│   ├── graph/                # Knowledge graph
│   ├── llm/                  # Groq LLM integration
│   ├── models/               # Pydantic schemas
│   └── data/
│       └── sic_taxonomy.json # SIC codes reference
├── frontend/
│   ├── src/
│   │   ├── pages/           # React pages
│   │   ├── components/      # React components
│   │   └── api.js           # API client
│   └── package.json
├── main.py
├── pyproject.toml
└── README.md
```

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GROQ_API_KEY` | - | Your Groq API key (required) |
| `HOST` | `0.0.0.0` | API host |
| `PORT` | `8000` | API port |

## 📊 Output Schema

### Company Intelligence Output

```json
{
  "domain": "example.com",
  "company_name": "Example Corp",
  "long_description": "...",
  "short_description": "...",
  "sic_code": "7372",
  "sic_text": "Prepackaged Software",
  "sub_industry": "Software Products",
  "industry": "Information Technology",
  "sector": "Services",
  "tags": ["software", "saas"],
  "technologies": [...],
  "products": [...],
  "locations": [...],
  "overall_confidence": 0.85,
  "pages_analyzed": 25
}
```

### SIC Taxonomy Reference

```json
{
  "sic_code": "7372",
  "sic_description": "Prepackaged Software",
  "sub_industry": "Software Products",
  "industry": "Information Technology",
  "sector": "Services"
}
```

## 🎯 Key Principles

1. **Groq-powered extraction** - Lightning-fast LLM inference for intelligent data extraction
2. **Evidence-based** - Every extraction includes confidence and source
3. **SIC-based classification** - Standardized, auditable industry coding
4. **Graph-native** - Relationships modeled as knowledge graph
5. **Scalable** - Batch process hundreds of companies efficiently

## 📈 Batch Processing

GhostIntel supports batch analysis of 100-150 companies:

```bash
curl -X POST http://localhost:8000/api/batch/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "domains": ["company1.com", "company2.com", "company3.com"],
    "max_pages_per_domain": 30
  }'
```

## 🛠️ Development

```bash
# Install dev dependencies
uv sync --dev

# Run tests
uv run pytest

# Format code
uv run black ghostintel
```

## 📜 License

MIT License - see LICENSE file for details.

---

Built with 🔮 by the GhostIntel Team
