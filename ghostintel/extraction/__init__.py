"""
GhostIntel Extraction Engine - Rule-based entity extraction from crawled pages
"""

import re
import json
from typing import Optional
from datetime import datetime
from bs4 import BeautifulSoup

from ..models.schemas import (
    CompanyIntelligence,
    DomainSnapshot,
    CrawlResult,
    ExtractionEvidence,
    ConfidenceScore,
    ExtractedProduct,
    ExtractedTechnology,
    ExtractedLocation,
    ExtractedPerson,
    SocialMediaLinks,
    Contradiction,
)

# Import LLM module for Groq extraction
try:
    from ..llm import GroqExtractor, merge_extracted_data
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False


class ExtractionEngine:
    """
    Extracts structured company intelligence from crawled pages
    using rule-based methods, regex patterns, and heuristics.
    """
    
    # Technology detection patterns
    TECHNOLOGY_PATTERNS = {
        # Frontend
        "React": (r"\breact(?:\.js)?\b", "framework"),
        "Vue.js": (r"\bvue(?:\.js)?\b", "framework"),
        "Angular": (r"\bangular(?:\.js)?\b", "framework"),
        "Next.js": (r"\bnext\.?js\b", "framework"),
        "Tailwind CSS": (r"\btailwind\s*css\b", "framework"),
        
        # Backend
        "Node.js": (r"\bnode\.?js\b", "platform"),
        "Python": (r"\bpython\b", "language"),
        "Java": (r"\bjava\b(?!\s*script)", "language"),
        "Ruby": (r"\bruby(?:\s+on\s+rails)?\b", "language"),
        "Go": (r"\bgolang\b|\bgo\s+language\b", "language"),
        "Rust": (r"\brust\s+(?:lang|programming)\b", "language"),
        ".NET": (r"\.net\b|asp\.net", "platform"),
        "Django": (r"\bdjango\b", "framework"),
        "Flask": (r"\bflask\b", "framework"),
        "FastAPI": (r"\bfastapi\b", "framework"),
        "Spring": (r"\bspring\s*(?:boot)?\b", "framework"),
        
        # Cloud/Infrastructure
        "AWS": (r"\baws\b|\bamazon\s+web\s+services\b", "platform"),
        "Azure": (r"\bazure\b|\bmicrosoft\s+azure\b", "platform"),
        "Google Cloud": (r"\bgcp\b|\bgoogle\s+cloud\b", "platform"),
        "Docker": (r"\bdocker\b", "tool"),
        "Kubernetes": (r"\bkubernetes\b|\bk8s\b", "tool"),
        
        # Databases
        "PostgreSQL": (r"\bpostgres(?:ql)?\b", "database"),
        "MySQL": (r"\bmysql\b", "database"),
        "MongoDB": (r"\bmongo(?:db)?\b", "database"),
        "Redis": (r"\bredis\b", "database"),
        "Elasticsearch": (r"\belasticsearch\b", "database"),
        
        # AI/ML
        "TensorFlow": (r"\btensorflow\b", "framework"),
        "PyTorch": (r"\bpytorch\b", "framework"),
        "OpenAI": (r"\bopenai\b", "platform"),
        "Machine Learning": (r"\bmachine\s+learning\b|\bml\b", "technology"),
        "AI": (r"\bartificial\s+intelligence\b|\b(?<!em)ai\b", "technology"),
    }
    
    # Email pattern
    EMAIL_PATTERN = re.compile(
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    )
    
    # Phone pattern - stricter to avoid false positives
    # Matches formats like: +1 (555) 123-4567, 555-123-4567, (555) 123-4567, 1-555-123-4567
    PHONE_PATTERN = re.compile(
        r'(?:(?:\+?1[-.\s]?)?(?:\(?\d{3}\)[-.\s]?)\d{3}[-.\s]?\d{4})'  # With area code in parens
        r'|(?:\+?1[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4})'  # +1 format
        r'|(?:\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b)'  # Plain 10 digit with separators
    )
    
    # Phone context pattern - looks for phone numbers near phone-related words
    PHONE_CONTEXT_PATTERN = re.compile(
        r'(?:tel(?:ephone)?|phone|call|fax|mobile|contact)[:\s]*'
        r'(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}',
        re.IGNORECASE
    )
    
    # Social media patterns
    SOCIAL_PATTERNS = {
        "linkedin": re.compile(r'(?:https?://)?(?:www\.)?linkedin\.com/(?:company|in)/[\w-]+/?'),
        "twitter": re.compile(r'(?:https?://)?(?:www\.)?(?:twitter|x)\.com/[\w]+/?'),
        "facebook": re.compile(r'(?:https?://)?(?:www\.)?facebook\.com/[\w.]+/?'),
        "github": re.compile(r'(?:https?://)?(?:www\.)?github\.com/[\w-]+/?'),
        "instagram": re.compile(r'(?:https?://)?(?:www\.)?instagram\.com/[\w.]+/?'),
        "youtube": re.compile(r'(?:https?://)?(?:www\.)?youtube\.com/(?:c/|channel/|@)?[\w-]+/?'),
    }
    
    # Company size indicators
    SIZE_PATTERNS = [
        (r'\b(\d{1,3}(?:,\d{3})*)\+?\s*employees?\b', 1.0),
        (r'\bteam\s+of\s+(\d+)\b', 0.8),
        (r'\b(startup|small\s+team)\b', 0.6),
        (r'\b(enterprise|fortune\s+500)\b', 0.7),
    ]
    
    # Hiring signals
    HIRING_PATTERNS = [
        r'\b(?:we\'?re|now)\s+hiring\b',
        r'\bjoin\s+(?:our|the)\s+team\b',
        r'\bcareers?\b',
        r'\bjob\s+(?:openings?|opportunities?)\b',
        r'\bopen\s+positions?\b',
    ]
    
    def __init__(self):
        self.extracted_data: dict = {}
    
    def _create_evidence(
        self,
        source_url: str,
        text_snippet: str,
        method: str
    ) -> ExtractionEvidence:
        """Create an evidence record"""
        return ExtractionEvidence(
            source_url=source_url,
            text_snippet=text_snippet[:500],  # Limit snippet length
            extraction_method=method
        )
    
    def _extract_company_name(self, pages: list[CrawlResult]) -> tuple[Optional[str], ConfidenceScore]:
        """Extract company name from pages"""
        candidates = {}
        evidence_list = []
        
        for page in pages:
            # From structured data (Organization, Company)
            for data_type, data in page.structured_data.items():
                if data_type in ("Organization", "Corporation", "LocalBusiness"):
                    name = data.get("name")
                    if name:
                        candidates[name] = candidates.get(name, 0) + 0.9
                        evidence_list.append(self._create_evidence(
                            page.url, f"Schema.org {data_type}: {name}", "structured_data"
                        ))
            
            # From title (often "Company Name - Tagline")
            if page.title:
                # Take first part before separator
                title_parts = re.split(r'\s*[-|–—]\s*', page.title)
                if title_parts:
                    name = title_parts[0].strip()
                    if len(name) > 2 and len(name) < 100:
                        candidates[name] = candidates.get(name, 0) + 0.5
                        evidence_list.append(self._create_evidence(
                            page.url, f"Page title: {name}", "title_extraction"
                        ))
        
        if not candidates:
            return None, ConfidenceScore(value=0.0, evidence=[])
        
        # Return most likely candidate
        best_name = max(candidates, key=candidates.get)
        confidence = min(candidates[best_name], 1.0)
        
        return best_name, ConfidenceScore(value=confidence, evidence=evidence_list[:5])
    
    def _extract_descriptions(
        self,
        pages: list[CrawlResult]
    ) -> tuple[Optional[str], Optional[str], ConfidenceScore]:
        """Extract long and short descriptions"""
        long_description = None
        short_description = None
        evidence_list = []
        best_long_confidence = 0.0
        best_short_confidence = 0.0
        
        # Priority pages for descriptions
        priority_patterns = [
            (r'^https?://[^/]+/?$', 1.0),  # Homepage
            (r'/about', 0.9),  # About page
            (r'/company', 0.8),  # Company page
            (r'/who-we-are', 0.8),
        ]
        
        for page in pages:
            page_priority = 0.5
            for pattern, priority in priority_patterns:
                if re.search(pattern, page.url, re.IGNORECASE):
                    page_priority = priority
                    break
            
            # Short description from meta
            if page.meta_description and len(page.meta_description) > 20:
                confidence = 0.7 * page_priority
                if confidence > best_short_confidence:
                    short_description = page.meta_description
                    best_short_confidence = confidence
                    evidence_list.append(self._create_evidence(
                        page.url, page.meta_description, "meta_description"
                    ))
            
            # Long description from structured data
            for data_type, data in page.structured_data.items():
                if data_type in ("Organization", "Corporation", "WebSite"):
                    desc = data.get("description")
                    if desc and len(desc) > 50:
                        confidence = 0.9 * page_priority
                        if confidence > best_long_confidence:
                            long_description = desc
                            best_long_confidence = confidence
                            evidence_list.append(self._create_evidence(
                                page.url, desc[:200], "structured_data"
                            ))
            
            # Extract from page content (hero sections, about text)
            if page.text_content:
                # Look for about/description paragraphs
                about_match = re.search(
                    r'(?:about\s+us|who\s+we\s+are|our\s+mission)[:\s]*([^.]{50,500}\.[^.]{0,200}\.?)',
                    page.text_content,
                    re.IGNORECASE
                )
                if about_match:
                    desc = about_match.group(1).strip()
                    confidence = 0.6 * page_priority
                    if confidence > best_long_confidence and len(desc) > len(long_description or ""):
                        long_description = desc
                        best_long_confidence = confidence
                        evidence_list.append(self._create_evidence(
                            page.url, desc[:200], "content_extraction"
                        ))
        
        confidence_score = ConfidenceScore(
            value=max(best_long_confidence, best_short_confidence, 0.0),
            evidence=evidence_list[:5]
        )
        
        return long_description, short_description, confidence_score
    
    def _normalize_phone(self, phone: str) -> Optional[str]:
        """Normalize and validate a phone number"""
        # Remove all non-digit characters
        digits = re.sub(r'\D', '', phone)
        
        # US/Canada phone numbers should be 10 or 11 digits
        if len(digits) == 11 and digits.startswith('1'):
            digits = digits[1:]  # Remove leading 1
        
        if len(digits) != 10:
            return None
        
        # Format as (XXX) XXX-XXXX
        return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    
    def _extract_contact_info(
        self,
        pages: list[CrawlResult]
    ) -> tuple[Optional[str], Optional[str], dict[str, str]]:
        """Extract contact information"""
        emails = []
        context_phones = []  # Phones found near "phone", "tel", etc.
        general_phones = []  # Phones found anywhere
        social_links = {}
        
        for page in pages:
            content = page.text_content + " " + (page.html_content or "")
            
            # Extract emails
            found_emails = self.EMAIL_PATTERN.findall(content)
            for email in found_emails:
                email = email.lower()
                # Filter out common non-contact emails
                if not any(x in email for x in ['example.com', 'test.com', 'placeholder']):
                    emails.append(email)
            
            # Extract phones with context (more reliable)
            context_matches = self.PHONE_CONTEXT_PATTERN.findall(content)
            for match in context_matches:
                # Extract just the phone number part
                phone_match = self.PHONE_PATTERN.search(match)
                if phone_match:
                    normalized = self._normalize_phone(phone_match.group())
                    if normalized:
                        context_phones.append(normalized)
            
            # Extract general phones (fallback)
            found_phones = self.PHONE_PATTERN.findall(content)
            for phone in found_phones:
                normalized = self._normalize_phone(phone)
                if normalized:
                    general_phones.append(normalized)
            
            # Extract social links
            for platform, pattern in self.SOCIAL_PATTERNS.items():
                matches = pattern.findall(content)
                if matches and platform not in social_links:
                    social_links[platform] = matches[0]
        
        # Return most common/first found - prefer context phones over general
        email = emails[0] if emails else None
        phone = context_phones[0] if context_phones else (general_phones[0] if general_phones else None)
        
        return email, phone, social_links
    
    def _extract_technologies(self, pages: list[CrawlResult]) -> list[ExtractedTechnology]:
        """Detect technologies used by the company"""
        tech_counts = {}
        
        for page in pages:
            content = page.text_content.lower()
            
            for tech_name, (pattern, category) in self.TECHNOLOGY_PATTERNS.items():
                if re.search(pattern, content, re.IGNORECASE):
                    if tech_name not in tech_counts:
                        tech_counts[tech_name] = {"count": 0, "category": category}
                    tech_counts[tech_name]["count"] += 1
        
        technologies = []
        total_pages = len(pages) or 1
        
        for tech_name, data in tech_counts.items():
            confidence = min(data["count"] / total_pages * 2, 1.0)
            if confidence >= 0.1:  # Minimum threshold
                technologies.append(ExtractedTechnology(
                    name=tech_name,
                    category=data["category"],
                    confidence=confidence
                ))
        
        # Sort by confidence
        technologies.sort(key=lambda x: x.confidence, reverse=True)
        return technologies[:20]  # Top 20
    
    def _extract_products(self, pages: list[CrawlResult]) -> list[ExtractedProduct]:
        """Extract products and services from structured data only (headings are too noisy)"""
        products = []
        seen_names = set()
        
        # Skip words that are navigation/menu items, not products
        skip_patterns = [
            r'^(home|about|contact|blog|news|login|sign|careers?|company)$',
            r'^(products?|services?|solutions?|resources?|support|help)$',
            r'^(subscribe|newsletter|follow\s*us|knowledge\s*center)$',
            r'^(privacy|terms|legal|faq|menu|your|level\s*up)$',
            r'^(get\s*started|learn\s*more|read\s*more|case\s*studies?)$',
            r'^(testimonials?|partners?|press|media|events?)$',
            r'^(custom\s*services?|custom\s*solutions?)$',
        ]
        
        def is_valid_product(name):
            """Check if name is likely a real product, not navigation"""
            if not name or len(name) < 3 or len(name) > 100:
                return False
            name_lower = name.lower().strip()
            for pattern in skip_patterns:
                if re.match(pattern, name_lower, re.IGNORECASE):
                    return False
            # Also skip very short generic words
            if name_lower in ['your', 'our', 'the', 'new', 'best', 'top', 'free']:
                return False
            return True
        
        for page in pages:
            # Only extract from structured data - this is most reliable
            for data_type, data in page.structured_data.items():
                if data_type in ("Product", "Service", "SoftwareApplication", "Offer"):
                    name = data.get("name")
                    desc = data.get("description")
                    if name and name not in seen_names and is_valid_product(name):
                        seen_names.add(name)
                        products.append(ExtractedProduct(
                            name=name,
                            description=desc,
                            confidence=0.9
                        ))
        
        products.sort(key=lambda x: x.confidence, reverse=True)
        return products[:15]
    
    def _extract_locations(self, pages: list[CrawlResult]) -> list[ExtractedLocation]:
        """Extract company locations"""
        locations = []
        
        for page in pages:
            # From structured data
            for data_type, data in page.structured_data.items():
                if data_type in ("Organization", "LocalBusiness", "Corporation"):
                    address_data = data.get("address", {})
                    if isinstance(address_data, dict):
                        location = ExtractedLocation(
                            address=address_data.get("streetAddress"),
                            city=address_data.get("addressLocality"),
                            state=address_data.get("addressRegion"),
                            country=address_data.get("addressCountry"),
                            is_headquarters="headquarters" in page.url.lower(),
                            confidence=0.9
                        )
                        if any([location.city, location.country]):
                            locations.append(location)
        
        return locations[:10]
    
    def _extract_founding_year(self, pages: list[CrawlResult]) -> Optional[int]:
        """Extract company founding year from page content"""
        FOUNDING_PATTERNS = [
            r'(?:founded|established|incorporated|started|since)\s+(?:in\s+)?((?:19|20)\d{2})\b',
            r'\bsince\s+((?:19|20)\d{2})\b',
            r'\(c\)\s*((?:19|20)\d{2})\b',
            r'copyright\s+(?:©)?\s*((?:19|20)\d{2})\b',
            r'\©\s*((?:19|20)\d{2})\b',
        ]
        
        candidates = {}
        for page in pages:
            content = page.text_content
            # Give more weight to structured data
            for data in page.structured_data.values():
                if isinstance(data, dict):
                    founded = data.get("foundingDate") or data.get("founded")
                    if founded:
                        year_match = re.search(r'((?:19|20)\d{2})', str(founded))
                        if year_match:
                            year = int(year_match.group(1))
                            if 1800 <= year <= 2025:
                                candidates[year] = candidates.get(year, 0) + 2
            
            for pattern in FOUNDING_PATTERNS:
                matches = re.findall(pattern, content, re.IGNORECASE)
                for m in matches:
                    year = int(m)
                    if 1800 <= year <= 2025:
                        candidates[year] = candidates.get(year, 0) + 1
        
        if not candidates:
            return None
        return max(candidates, key=candidates.get)

    def _extract_employee_count(self, pages: list[CrawlResult]) -> Optional[str]:
        """Extract employee count estimate from page content"""
        EMPLOYEE_PATTERNS = [
            (r'(\d{1,3}(?:,\d{3})*)\+?\s*employees?', 1.0),
            (r'team\s+of\s+(\d+)\+?\s*(?:people|professionals|experts|members)?', 0.9),
            (r'(\d{1,3}(?:,\d{3})*)\+?\s*(?:people|professionals|staff|members|team members)', 0.8),
            (r'over\s+(\d{1,3}(?:,\d{3})*)\s*(?:employees?|people|staff)', 0.8),
            (r'more\s+than\s+(\d{1,3}(?:,\d{3})*)\s*(?:employees?|people|staff)', 0.8),
        ]
        SIZE_RANGES = [
            (r'\b1-10\b|\bsolo founder\b|\bsolopreneur\b', '1-10'),
            (r'\b11-50\b|\bsmall\s+team\b|\bstarting\s+up\b', '11-50'),
            (r'\b51-200\b|\bgrowing\s+team\b', '51-200'),
            (r'\b201-500\b', '201-500'),
            (r'\b501-1000\b', '501-1,000'),
            (r'\b1001-5000\b|\bmid.?size\b', '1,001-5,000'),
            (r'\b5001-10000\b|\blarge\s+enterprise\b', '5,001-10,000'),
            (r'\bfortune\s+500\b|\bglobal\s+enterprise\b', '10,000+'),
        ]
        
        best_count = None
        best_confidence = 0.0
        
        for page in pages:
            # Check structured data first
            for data in page.structured_data.values():
                if isinstance(data, dict):
                    emp = data.get("numberOfEmployees")
                    if emp:
                        return str(emp)
            
            content = page.text_content
            for pattern, confidence in EMPLOYEE_PATTERNS:
                match = re.search(pattern, content, re.IGNORECASE)
                if match and confidence > best_confidence:
                    num_str = match.group(1).replace(',', '')
                    num = int(num_str)
                    # Normalize to ranges
                    if num < 11: best_count = '1-10'
                    elif num < 51: best_count = '11-50'
                    elif num < 201: best_count = '51-200'
                    elif num < 501: best_count = '201-500'
                    elif num < 1001: best_count = '501-1,000'
                    elif num < 5001: best_count = '1,001-5,000'
                    elif num < 10001: best_count = '5,001-10,000'
                    else: best_count = '10,000+'
                    best_confidence = confidence
            
            # Check range keywords as fallback
            if not best_count:
                for pattern, label in SIZE_RANGES:
                    if re.search(pattern, content, re.IGNORECASE):
                        best_count = label
                        break
        
        return best_count

    def _extract_funding_stage(self, pages: list[CrawlResult]) -> Optional[str]:
        """Extract funding stage from page content"""
        FUNDING_PATTERNS = [
            (r'\bseries\s+d\b', 'Series D'),
            (r'\bseries\s+c\b', 'Series C'),
            (r'\bseries\s+b\b', 'Series B'),
            (r'\bseries\s+a\b', 'Series A'),
            (r'\bseed\s+(?:round|funding|stage)\b|\bseed-funded\b|\bseed\s+funded\b', 'Seed'),
            (r'\bpre-?seed\b', 'Pre-Seed'),
            (r'\binitial\s+public\s+offering\b|\bipo\b|\bnasdaq\b|\bnyse\b|\bpublicly\s+traded\b|\bstock\s+ticker\b', 'Public'),
            (r'\bacquired\s+by\b|\bsubsidiary\s+of\b', 'Acquired'),
            (r'\bbootstrapped\b|\bself-funded\b|\bprofitable\s+and\s+independent\b', 'Bootstrapped'),
            (r'\bgrowth\s+equity\b|\bprivate\s+equity\b', 'Private Equity'),
            (r'\bventure-backed\b|\bvc-backed\b|\bvc\s+funded\b', 'Venture-Backed'),
        ]
        
        for page in pages:
            content = page.text_content
            for pattern, stage in FUNDING_PATTERNS:
                if re.search(pattern, content, re.IGNORECASE):
                    return stage
        return None

    def _extract_pricing_model(self, pages: list[CrawlResult]) -> Optional[str]:
        """Extract pricing/business model from page content"""
        PRICING_PATTERNS = [
            (r'\bfreemium\b|\bfree\s+plan\b|\bfree\s+tier\b|\bfree\s+forever\b', 'Freemium'),
            (r'\bopen.?source\b', 'Open Source'),
            (r'\bper\s+(?:user|seat|month|year)\b|\bmonthly\s+subscription\b|\bannual\s+subscription\b|\bsubscription.based\b', 'Subscription'),
            (r'\bone.time\s+(?:payment|purchase|fee)\b|\bbuy\s+(?:once|now)\b|\bperpetual\s+license\b', 'One-time Purchase'),
            (r'\benterprise\s+pricing\b|\bcontact\s+(?:us\s+)?for\s+pricing\b|\bcustom\s+pricing\b|\btalk\s+to\s+sales\b', 'Enterprise'),
            (r'\bpay.as.you.go\b|\busage.based\b|\bconsumption.based\b', 'Usage-based'),
            (r'\bcommission\b|\bmarketplace\b|\btransaction\s+fee\b', 'Marketplace/Commission'),
        ]
        
        # Pricing page gets higher priority
        priority_pages = sorted(
            pages,
            key=lambda p: 1 if re.search(r'/pricing', p.url, re.IGNORECASE) else 0,
            reverse=True
        )
        
        for page in priority_pages:
            content = page.text_content
            for pattern, model in PRICING_PATTERNS:
                if re.search(pattern, content, re.IGNORECASE):
                    return model
        return None

    
    def _extract_tags(self, pages: list[CrawlResult]) -> list[str]:
        """Extract keyword tags from pages"""
        all_keywords = []
        
        for page in pages:
            # From meta keywords
            all_keywords.extend(page.meta_keywords)
            
            # From structured data
            for data in page.structured_data.values():
                if isinstance(data, dict):
                    keywords = data.get("keywords", [])
                    if isinstance(keywords, str):
                        keywords = [k.strip() for k in keywords.split(",")]
                    all_keywords.extend(keywords)
        
        # Count and deduplicate
        keyword_counts = {}
        for kw in all_keywords:
            kw = kw.lower().strip()
            if len(kw) > 2:
                keyword_counts[kw] = keyword_counts.get(kw, 0) + 1
        
        # Return top keywords
        sorted_keywords = sorted(keyword_counts.keys(), key=lambda x: keyword_counts[x], reverse=True)
        return sorted_keywords[:20]
    
    def _detect_contradictions(
        self,
        company_names: list[str],
        descriptions: list[str]
    ) -> list[Contradiction]:
        """Detect contradictions in extracted data"""
        contradictions = []
        
        # Check for multiple different company names
        unique_names = list(set(company_names))
        if len(unique_names) > 1:
            contradictions.append(Contradiction(
                field_name="company_name",
                values=unique_names[:5],
                sources=[],
                severity="medium",
                description="Multiple company names detected across pages"
            ))
        
        return contradictions
    
    def extract(self, snapshot: DomainSnapshot, use_llm: bool = True) -> CompanyIntelligence:
        """
        Extract all company intelligence from a domain snapshot.
        
        Args:
            snapshot: Crawled domain snapshot
            use_llm: Whether to use Gemini LLM for enhanced extraction
            
        Returns:
            CompanyIntelligence with all extracted and classified data
        """
        pages = snapshot.pages
        
        if not pages:
            return CompanyIntelligence(
                domain=snapshot.domain,
                overall_confidence=0.0,
                pages_analyzed=0
            )
        
        # Extract all fields using rule-based methods
        company_name, name_confidence = self._extract_company_name(pages)
        long_desc, short_desc, desc_confidence = self._extract_descriptions(pages)
        email, phone, social_links = self._extract_contact_info(pages)
        technologies = self._extract_technologies(pages)
        products = self._extract_products(pages)
        locations = self._extract_locations(pages)
        is_hiring, has_careers, job_count = self._detect_hiring_signals(pages)
        tags = self._extract_tags(pages)

        # New intelligence signals
        founding_year = self._extract_founding_year(pages)
        employee_count = self._extract_employee_count(pages)
        funding_stage = self._extract_funding_stage(pages)
        pricing_model = self._extract_pricing_model(pages)

        # Calculate overall confidence
        confidence_values = [
            name_confidence.value,
            desc_confidence.value,
        ]
        overall_confidence = sum(confidence_values) / len(confidence_values) if confidence_values else 0.0

        # Build base intelligence
        intelligence = CompanyIntelligence(
            domain=snapshot.domain,
            company_name=company_name,
            long_description=long_desc,
            long_description_confidence=desc_confidence,
            short_description=short_desc,
            short_description_confidence=desc_confidence,
            email=email,
            phone=phone,
            social_links=social_links,
            social_media=SocialMediaLinks(
                linkedin=social_links.get("linkedin"),
                facebook=social_links.get("facebook"),
                instagram=social_links.get("instagram"),
                twitter=social_links.get("twitter"),
                youtube=social_links.get("youtube"),
            ),
            technologies=technologies,
            products=products,
            locations=locations,
            tags=tags,
            founding_year=founding_year,
            employee_count_estimate=employee_count,
            funding_stage=funding_stage,
            pricing_model=pricing_model,
            job_openings_count=job_count if job_count > 0 else None,
            is_hiring=is_hiring,
            has_careers_page=has_careers,
            overall_confidence=overall_confidence,
            pages_analyzed=len(pages),
            crawl_timestamp=snapshot.crawl_start
        )

        # Enhance with OpenAI LLM if available and requested
        if use_llm and GROQ_AVAILABLE:
            try:
                openai_extractor = GroqExtractor()  # alias for OpenAIExtractor
                if openai_extractor.is_available():
                    llm_data = openai_extractor.extract_sync(snapshot)
                    if llm_data:
                        intelligence = merge_extracted_data(intelligence, llm_data)
                        print(f"✨ Enhanced extraction with OpenAI for {snapshot.domain}")
            except Exception as e:
                print(f"LLM enhancement failed (falling back to rule-based): {e}")

        return intelligence


def extract_company_intelligence(snapshot: DomainSnapshot, use_llm: bool = True) -> CompanyIntelligence:
    """
    Convenience function to extract company intelligence from a snapshot.
    
    Args:
        snapshot: Domain snapshot from crawler
        use_llm: Whether to use Gemini LLM for enhanced extraction
        
    Returns:
        Extracted company intelligence
    """
    engine = ExtractionEngine()
    return engine.extract(snapshot, use_llm=use_llm)
