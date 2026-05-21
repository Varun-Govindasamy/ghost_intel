"""
Pydantic schemas for GhostIntel data models
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, HttpUrl


class CrawlStatus(str, Enum):
    """Status of a crawl operation"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class ExtractionEvidence(BaseModel):
    """Evidence supporting an extracted field"""
    source_url: str = Field(..., description="URL where the evidence was found")
    text_snippet: str = Field(..., description="Relevant text snippet")
    extraction_method: str = Field(..., description="Method used for extraction")
    timestamp: datetime = Field(default_factory=datetime.now)


class ConfidenceScore(BaseModel):
    """Confidence score for an extracted field"""
    value: float = Field(..., ge=0.0, le=1.0, description="Confidence value between 0 and 1")
    evidence: list[ExtractionEvidence] = Field(default_factory=list)


class SICTaxonomy(BaseModel):
    """Industry taxonomy reference based on SIC codes"""
    sic_code: str = Field(..., description="Standard Industrial Classification code")
    sic_description: str = Field(..., description="Official SIC activity description")
    sub_industry: str = Field(..., description="Normalized sub-industry grouping")
    industry: str = Field(..., description="Normalized industry grouping")
    sector: str = Field(..., description="Top-level sector grouping")


class Contradiction(BaseModel):
    """Detected contradiction in company data"""
    field_name: str = Field(..., description="Name of the field with contradiction")
    values: list[str] = Field(..., description="Conflicting values found")
    sources: list[str] = Field(..., description="Source URLs for each value")
    severity: str = Field(..., description="Severity level: low, medium, high")
    description: str = Field(..., description="Description of the contradiction")


class ExtractedProduct(BaseModel):
    """Extracted product or service"""
    name: str
    description: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0)


class ExtractedTechnology(BaseModel):
    """Detected technology used by the company"""
    name: str
    category: str  # e.g., "framework", "platform", "language", "tool"
    confidence: float = Field(ge=0.0, le=1.0)


class ExtractedPerson(BaseModel):
    """Extracted person/leadership info"""
    name: str
    title: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0, default=0.5)


class ExtractedLocation(BaseModel):
    """Extracted company location"""
    full_address: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    is_headquarters: bool = False
    confidence: float = Field(ge=0.0, le=1.0)


class SocialMediaLinks(BaseModel):
    """Social media and web presence links"""
    linkedin: Optional[str] = None
    facebook: Optional[str] = None
    instagram: Optional[str] = None
    twitter: Optional[str] = None  # X/Twitter
    youtube: Optional[str] = None
    blog: Optional[str] = None


class CompanyIntelligence(BaseModel):
    """Complete company intelligence output"""
    # Core identifiers
    domain: str = Field(..., description="Primary key - company domain")
    company_name: Optional[str] = Field(None, description="Extracted company name")
    
    # Descriptions
    long_description: Optional[str] = Field(None, description="Detailed company description")
    long_description_confidence: Optional[ConfidenceScore] = None
    short_description: Optional[str] = Field(None, description="Concise summary")
    short_description_confidence: Optional[ConfidenceScore] = None
    
    # Industry classification (SIC-based)
    sic_code: Optional[str] = Field(None, description="Standard Industrial Classification code")
    sic_text: Optional[str] = Field(None, description="Human-readable SIC description")
    sub_industry: Optional[str] = Field(None, description="Normalized sub-industry label")
    industry: Optional[str] = Field(None, description="Mid-level industry grouping")
    sector: Optional[str] = Field(None, description="Top-level sector grouping")
    classification_confidence: Optional[ConfidenceScore] = None
    
    # Enrichment data
    tags: list[str] = Field(default_factory=list, description="Keyword-based enrichment signals")
    products: list[ExtractedProduct] = Field(default_factory=list)
    technologies: list[ExtractedTechnology] = Field(default_factory=list)
    locations: list[ExtractedLocation] = Field(default_factory=list)
    
    # Contact information
    full_address: Optional[str] = Field(None, description="Complete formatted address")
    email: Optional[str] = None
    phone: Optional[str] = None
    hours_of_operation: Optional[str] = Field(None, description="Business hours")
    hq_indicator: Optional[str] = Field(None, description="Headquarters indicator (Yes/No)")
    
    # Logo
    logo_url: Optional[str] = Field(None, description="Company logo URL")
    
    # Social media links
    social_links: dict[str, str] = Field(default_factory=dict)
    social_media: Optional[SocialMediaLinks] = Field(default_factory=SocialMediaLinks)
    
    # People/Leadership
    people: list[ExtractedPerson] = Field(default_factory=list, description="Key people/leadership")
    
    # Certifications
    certifications: list[str] = Field(default_factory=list, description="Company certifications")
    
    # Company signals
    employee_count_estimate: Optional[str] = None
    founding_year: Optional[int] = None
    funding_stage: Optional[str] = Field(None, description="Funding stage e.g. Seed, Series A, Series B, Public, Bootstrapped")
    pricing_model: Optional[str] = Field(None, description="Business/pricing model e.g. SaaS, Freemium, One-time, Enterprise, Open Source")
    job_openings_count: Optional[int] = Field(None, description="Number of open job positions found")
    is_hiring: bool = False
    has_careers_page: bool = False
    
    # Quality metrics
    contradictions: list[Contradiction] = Field(default_factory=list)
    overall_confidence: float = Field(0.0, ge=0.0, le=1.0)
    pages_analyzed: int = 0
    
    # Metadata
    crawl_timestamp: datetime = Field(default_factory=datetime.now)
    analysis_version: str = "1.0.0"


class KnowledgeGraphNode(BaseModel):
    """Node in the knowledge graph"""
    id: str
    label: str
    node_type: str  # company, industry, sector, product, technology, location
    properties: dict = Field(default_factory=dict)


class KnowledgeGraphEdge(BaseModel):
    """Edge in the knowledge graph"""
    source: str
    target: str
    relationship: str  # belongs_to, offers, uses, located_in
    properties: dict = Field(default_factory=dict)


class CrawlResult(BaseModel):
    """Result of crawling a single page"""
    url: str
    title: Optional[str] = None
    text_content: str
    html_content: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: list[str] = Field(default_factory=list)
    structured_data: dict = Field(default_factory=dict)
    links: list[str] = Field(default_factory=list)
    status_code: int = 200
    crawl_time: datetime = Field(default_factory=datetime.now)


class DomainSnapshot(BaseModel):
    """Complete snapshot of a crawled domain"""
    domain: str
    pages: list[CrawlResult] = Field(default_factory=list)
    crawl_start: datetime = Field(default_factory=datetime.now)
    crawl_end: Optional[datetime] = None
    status: CrawlStatus = CrawlStatus.PENDING
    error_message: Optional[str] = None
    total_pages: int = 0


class AnalysisRequest(BaseModel):
    """Request to analyze a company domain"""
    domain: str = Field(..., description="Company domain to analyze")
    max_pages: int = Field(2, ge=1, le=200, description="Maximum pages to crawl")
    include_subdomains: bool = Field(False, description="Whether to include subdomains")


class AnalysisResponse(BaseModel):
    """Response from company analysis"""
    status: str
    message: str
    task_id: Optional[str] = None
    result: Optional[CompanyIntelligence] = None


class BatchAnalysisRequest(BaseModel):
    """Request to analyze multiple company domains"""
    domains: list[str] = Field(..., min_length=1, max_length=150)
    max_pages_per_domain: int = Field(2, ge=1, le=100)


class BatchAnalysisResponse(BaseModel):
    """Response from batch analysis"""
    status: str
    message: str
    task_id: str
    total_domains: int
    completed: int = 0
    failed: int = 0
    results: list[CompanyIntelligence] = Field(default_factory=list)
