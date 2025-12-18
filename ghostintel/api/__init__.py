"""
GhostIntel FastAPI Backend
Main API endpoints for company intelligence
"""

import asyncio
import uuid
import os
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

# Load environment variables from .env file
load_dotenv()

from ..models.schemas import (
    CompanyIntelligence,
    SICTaxonomy,
    AnalysisRequest,
    AnalysisResponse,
    BatchAnalysisRequest,
    BatchAnalysisResponse,
    CrawlStatus,
)
from ..crawler import crawl_company_domain
from ..extraction import extract_company_intelligence
from ..classification import SICClassifier, classify_company
from ..graph import get_knowledge_graph, reset_knowledge_graph


# In-memory storage for results and tasks
analysis_results: dict[str, CompanyIntelligence] = {}
batch_tasks: dict[str, BatchAnalysisResponse] = {}
analysis_queue: dict[str, dict] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Initialize classifier on startup
    print("🔮 GhostIntel starting up...")
    classifier = SICClassifier()
    print(f"📊 Loaded {len(classifier.taxonomy)} SIC codes")
    yield
    # Cleanup on shutdown
    print("👋 GhostIntel shutting down...")


app = FastAPI(
    title="GhostIntel API",
    description="Autonomous Company Intelligence and Knowledge Graph System",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ Health & Info Endpoints ============

@app.get("/")
async def root():
    """Root endpoint with API info"""
    return {
        "name": "GhostIntel API",
        "version": "1.0.0",
        "description": "Autonomous Company Intelligence and Knowledge Graph System",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


# ============ Company Analysis Endpoints ============

async def process_domain_analysis(domain: str, max_pages: int = 2):
    """Background task to process domain analysis"""
    try:
        # Update status to in progress
        analysis_queue[domain] = {"status": "crawling", "progress": 0}
        
        # Step 1: Crawl the domain
        snapshot = await crawl_company_domain(domain, max_pages=max_pages)
        
        if snapshot.status == CrawlStatus.FAILED:
            analysis_queue[domain] = {
                "status": "failed",
                "error": snapshot.error_message
            }
            return
        
        analysis_queue[domain] = {"status": "extracting", "progress": 50}
        
        # Step 2: Extract intelligence
        intelligence = extract_company_intelligence(snapshot)
        
        analysis_queue[domain] = {"status": "classifying", "progress": 75}
        
        # Step 3: Classify with SIC codes
        intelligence = classify_company(intelligence)
        
        # Step 4: Add to knowledge graph
        kg = get_knowledge_graph()
        kg.add_company(intelligence)
        
        # Store result
        analysis_results[domain] = intelligence
        analysis_queue[domain] = {"status": "completed", "progress": 100}
        
    except Exception as e:
        analysis_queue[domain] = {"status": "failed", "error": str(e)}


@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze_company(request: AnalysisRequest, background_tasks: BackgroundTasks):
    """
    Analyze a company domain and extract intelligence.
    Returns immediately and processes in background.
    """
    domain = request.domain.lower().strip()
    
    # Check if already processing
    if domain in analysis_queue and analysis_queue[domain].get("status") not in ("completed", "failed"):
        return AnalysisResponse(
            status="in_progress",
            message=f"Analysis already in progress for {domain}",
            task_id=domain,
        )
    
    # Check if already analyzed
    if domain in analysis_results:
        return AnalysisResponse(
            status="completed",
            message=f"Analysis complete for {domain}",
            result=analysis_results[domain],
        )
    
    # Start background processing
    analysis_queue[domain] = {"status": "pending", "progress": 0}
    background_tasks.add_task(process_domain_analysis, domain, request.max_pages)
    
    return AnalysisResponse(
        status="started",
        message=f"Analysis started for {domain}",
        task_id=domain,
    )


@app.get("/api/analyze/{domain}/status")
async def get_analysis_status(domain: str):
    """Get the status of an ongoing analysis"""
    domain = domain.lower().strip()
    
    if domain in analysis_results:
        return {
            "domain": domain,
            "status": "completed",
            "progress": 100,
            "result": analysis_results[domain],
        }
    
    if domain in analysis_queue:
        queue_info = analysis_queue[domain]
        response = {
            "domain": domain,
            "status": queue_info.get("status", "unknown"),
            "progress": queue_info.get("progress", 0),
        }
        if "error" in queue_info:
            response["error"] = queue_info["error"]
        return response
    
    raise HTTPException(status_code=404, detail=f"No analysis found for {domain}")


@app.get("/api/companies", response_model=list[CompanyIntelligence])
async def list_companies():
    """List all analyzed companies"""
    return list(analysis_results.values())


@app.get("/api/companies/{domain}", response_model=CompanyIntelligence)
async def get_company(domain: str):
    """Get intelligence for a specific company"""
    domain = domain.lower().strip()
    
    if domain not in analysis_results:
        raise HTTPException(status_code=404, detail=f"Company {domain} not found")
    
    return analysis_results[domain]


@app.delete("/api/companies/{domain}")
async def delete_company(domain: str):
    """Delete a company from results"""
    domain = domain.lower().strip()
    
    if domain in analysis_results:
        del analysis_results[domain]
    if domain in analysis_queue:
        del analysis_queue[domain]
    
    return {"status": "deleted", "domain": domain}


# ============ Batch Analysis Endpoints ============

async def process_single_domain(task_id: str, domain: str, max_pages: int, semaphore: asyncio.Semaphore):
    """Process a single domain with semaphore for concurrency control"""
    async with semaphore:
        try:
            # Skip if already analyzed
            if domain in analysis_results:
                batch_tasks[task_id].completed += 1
                batch_tasks[task_id].results.append(analysis_results[domain])
                return
            
            # Process domain
            await process_domain_analysis(domain, max_pages)
            
            if domain in analysis_results:
                batch_tasks[task_id].completed += 1
                batch_tasks[task_id].results.append(analysis_results[domain])
            else:
                batch_tasks[task_id].failed += 1
                
        except Exception as e:
            batch_tasks[task_id].failed += 1


async def process_batch_analysis(task_id: str, domains: list[str], max_pages: int):
    """Process batch analysis of multiple domains in parallel"""
    batch_tasks[task_id].status = "in_progress"
    
    # Limit concurrent requests to avoid overwhelming servers
    max_concurrent = 5
    semaphore = asyncio.Semaphore(max_concurrent)
    
    # Create tasks for all domains
    tasks = [
        process_single_domain(task_id, domain, max_pages, semaphore)
        for domain in domains
    ]
    
    # Run all tasks in parallel (with semaphore limiting concurrency)
    await asyncio.gather(*tasks, return_exceptions=True)
    
    batch_tasks[task_id].status = "completed"


@app.post("/api/batch/analyze", response_model=BatchAnalysisResponse)
async def batch_analyze(request: BatchAnalysisRequest, background_tasks: BackgroundTasks):
    """
    Analyze multiple company domains in batch.
    """
    task_id = str(uuid.uuid4())
    
    # Normalize domains
    domains = [d.lower().strip() for d in request.domains]
    
    # Create batch task
    batch_tasks[task_id] = BatchAnalysisResponse(
        status="started",
        message=f"Batch analysis started for {len(domains)} domains",
        task_id=task_id,
        total_domains=len(domains),
    )
    
    # Start background processing
    background_tasks.add_task(
        process_batch_analysis, 
        task_id, 
        domains, 
        request.max_pages_per_domain
    )
    
    return batch_tasks[task_id]


@app.get("/api/batch/{task_id}", response_model=BatchAnalysisResponse)
async def get_batch_status(task_id: str):
    """Get status of a batch analysis task"""
    if task_id not in batch_tasks:
        raise HTTPException(status_code=404, detail=f"Batch task {task_id} not found")
    
    return batch_tasks[task_id]


# ============ Taxonomy Endpoints ============

@app.get("/api/taxonomy")
async def get_taxonomy():
    """Get the complete SIC taxonomy"""
    classifier = SICClassifier()
    results = classifier.get_all_taxonomy()
    return [r.model_dump() for r in results]


@app.get("/api/taxonomy/{sic_code}")
async def get_taxonomy_entry(sic_code: str):
    """Get a specific taxonomy entry"""
    classifier = SICClassifier()
    entry = classifier.get_taxonomy(sic_code)
    
    if not entry:
        raise HTTPException(status_code=404, detail=f"SIC code {sic_code} not found")
    
    return entry.model_dump()


@app.get("/api/taxonomy/search/{query}")
async def search_taxonomy(query: str):
    """Search the taxonomy by keyword"""
    classifier = SICClassifier()
    results = classifier.search_taxonomy(query)
    # Convert Pydantic models to dicts for proper JSON serialization
    return [r.model_dump() for r in results]


# ============ Knowledge Graph Endpoints ============

@app.get("/api/graph")
async def get_full_graph():
    """Get the complete knowledge graph"""
    kg = get_knowledge_graph()
    return kg.get_full_graph()


@app.get("/api/graph/company/{domain}")
async def get_company_graph(domain: str):
    """Get the knowledge graph subgraph for a specific company"""
    kg = get_knowledge_graph()
    return kg.get_company_subgraph(domain.lower().strip())


@app.get("/api/graph/statistics")
async def get_graph_statistics():
    """Get knowledge graph statistics"""
    kg = get_knowledge_graph()
    return kg.get_statistics()


@app.get("/api/graph/industries")
async def get_industry_distribution():
    """Get distribution of companies across industries"""
    kg = get_knowledge_graph()
    return kg.get_industry_distribution()


@app.get("/api/graph/technologies")
async def get_technology_trends():
    """Get technology usage trends across companies"""
    kg = get_knowledge_graph()
    return kg.get_technology_trends()


@app.get("/api/graph/similar/{domain}")
async def get_similar_companies(domain: str, limit: int = 10):
    """Find companies similar to the given domain"""
    kg = get_knowledge_graph()
    return kg.find_similar_companies(domain.lower().strip(), limit)


@app.post("/api/graph/reset")
async def reset_graph():
    """Reset the knowledge graph"""
    reset_knowledge_graph()
    return {"status": "reset", "message": "Knowledge graph has been reset"}


# ============ Analytics Endpoints ============

@app.get("/api/analytics/summary")
async def get_analytics_summary():
    """Get overall analytics summary"""
    kg = get_knowledge_graph()
    stats = kg.get_statistics()
    
    # Calculate additional metrics
    total_companies = len(analysis_results)
    
    # Average confidence
    avg_confidence = 0.0
    if total_companies > 0:
        avg_confidence = sum(c.overall_confidence for c in analysis_results.values()) / total_companies
    
    # Classification rate
    classified = sum(1 for c in analysis_results.values() if c.sic_code is not None)
    classification_rate = classified / total_companies if total_companies > 0 else 0
    
    return {
        "total_companies": total_companies,
        "graph_statistics": stats,
        "average_confidence": round(avg_confidence, 2),
        "classification_rate": round(classification_rate, 2),
        "industry_distribution": kg.get_industry_distribution(),
        "technology_trends": dict(list(kg.get_technology_trends().items())[:10]),
    }


def create_app() -> FastAPI:
    """Factory function to create the FastAPI app"""
    return app
