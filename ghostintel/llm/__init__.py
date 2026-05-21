"""
GhostIntel LLM Module - OpenAI-powered intelligent extraction
"""

import os
import json
import re
from typing import Optional
from openai import OpenAI

from ..models.schemas import (
    CompanyIntelligence,
    DomainSnapshot,
    ExtractedPerson,
    ExtractedProduct,
    ExtractedTechnology,
    ExtractedLocation,
    SocialMediaLinks,
    ConfidenceScore,
)


class OpenAIExtractor:
    """
    Uses OpenAI LLM to intelligently extract and classify company data
    from crawled web pages.
    """

    EXTRACTION_PROMPT = """You are an expert company data extraction AI. Analyze the following crawled web content and extract structured company information.

CRAWLED CONTENT FROM {domain}:
{content}

Extract the following fields as accurately as possible. If a field cannot be determined from the content, use null.

Required output format (JSON):
{{
    "company_name": "Official company name",
    "long_description": "Detailed description of the company (2-4 sentences about what they do, their mission, products/services)",
    "short_description": "One-line tagline or brief description (max 100 characters)",
    "sic_code": "Most appropriate 4-digit SIC code based on their primary business",
    "sic_text": "Description matching the SIC code",
    "sub_industry": "Specific sub-industry classification",
    "industry": "Broader industry category",
    "sector": "Top-level sector (e.g., Technology, Healthcare, Finance, Manufacturing, etc.)",
    "tags": ["keyword1", "keyword2", "keyword3"],
    "full_address": "Complete formatted street address",
    "phone": "Primary phone number",
    "email": "Primary contact email",
    "hours_of_operation": "Business hours if available",
    "hq_indicator": "Yes or No - is this the headquarters",
    "logo_url": "URL to company logo if found",
    "linkedin": "LinkedIn company page URL",
    "facebook": "Facebook page URL",
    "instagram": "Instagram profile URL",
    "twitter": "Twitter/X profile URL",
    "youtube": "YouTube channel URL",
    "blog": "Company blog URL",
    "people": [
        {{"name": "Person Name", "title": "Job Title"}}
    ],
    "certifications": ["Certification 1", "Certification 2"],
    "products": ["Actual Product Name 1", "Actual Service Name 2"],
    "technologies": ["Technology 1", "Technology 2"],
    "founding_year": 2015,
    "employee_count": "51-200",
    "funding_stage": "Series B",
    "pricing_model": "Subscription",
    "job_openings_count": 12
}}

FIELD RULES FOR NEW FIELDS:
- founding_year: Integer year only (e.g. 2010). Look for "founded in", "since YYYY", "established YYYY", copyright year. Use null if not found.
- employee_count: Use ranges ONLY: "1-10", "11-50", "51-200", "201-500", "501-1,000", "1,001-5,000", "5,001-10,000", "10,000+". Use null if not found.
- funding_stage: One of: "Pre-Seed", "Seed", "Series A", "Series B", "Series C", "Series D", "Venture-Backed", "Bootstrapped", "Private Equity", "Public", "Acquired". Use null if not found.
- pricing_model: One of: "Freemium", "Subscription", "One-time Purchase", "Enterprise", "Usage-based", "Marketplace/Commission", "Open Source". Use null if not found.
- job_openings_count: Integer count of open positions mentioned. Use null if not found.

CRITICAL RULES FOR PRODUCTS/SERVICES:
- ONLY include ACTUAL named products or services the company SELLS or OFFERS to customers
- Products should have specific names like "Microsoft Office", "Salesforce CRM", "AWS Lambda"
- Services should be specific offerings like "Cloud Migration Services", "24/7 Support", "Custom Development"
- NEVER include these as products:
  * Navigation menu items (Home, About, Contact, Company, Blog, Careers, etc.)
  * Generic page sections (Products, Services, Solutions, Resources, Knowledge Center)
  * Marketing phrases (Level Up, Your Business Ally, Follow Us, Subscribe, etc.)
  * Call-to-action text (Get Started, Learn More, Contact Us, etc.)
  * Company features or values (Innovation, Quality, Trust, etc.)
- If no specific product/service names are found, return an empty array []

CRITICAL RULES FOR INDUSTRY CLASSIFICATION (SIC CODE):
- Classify based on what the COMPANY DOES/SELLS, not who their CUSTOMERS are
- A company that sells marketing services to healthcare companies is a MARKETING company (SIC 7311 - Advertising Agencies), NOT a Healthcare company
- A company that sells software to banks is a SOFTWARE company (SIC 7372), NOT a Finance company
- A company that provides data/leads to any industry is a DATA SERVICES company (SIC 7374 - Computer Processing/Data Preparation), NOT their target industry
- Common misclassification examples to AVOID:
  * Lead generation/data companies → NOT the industry they serve, use SIC 7374 or 7379
  * Marketing/advertising agencies → SIC 7311, 7319, 7389 regardless of client industry
  * Software/SaaS companies → SIC 7372, 7371 regardless of target market
  * Consulting firms → SIC 8742, 8748 regardless of industry focus
- SIC 8000 (Health Services) is ONLY for hospitals, clinics, doctors, nurses - actual healthcare providers

OTHER RULES:
1. Only extract information that is EXPLICITLY stated in the content
2. For SIC code, choose the code that describes what the company DOES, not who they sell to
3. For descriptions, synthesize from the actual content - don't make things up
4. Social media links should be full URLs
5. If contact info isn't found, leave as null
6. Extract actual people names and their titles if mentioned (leadership, team, executives)
7. Look for certifications like ISO, SOC2, HIPAA, etc.
8. Return ONLY valid JSON, no additional text"""

    def __init__(self, api_key: Optional[str] = None):
        """Initialize with OpenAI API key"""
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        if self.api_key:
            self.client = OpenAI(api_key=self.api_key)
            self.model = "gpt-4o-mini"
        else:
            self.client = None
            self.model = None

    def is_available(self) -> bool:
        """Check if OpenAI is configured and available"""
        return self.client is not None

    def _prepare_content(self, snapshot: DomainSnapshot, max_chars: int = 25000) -> str:
        """Prepare crawled content for LLM processing"""
        content_parts = []

        for page in snapshot.pages:
            part = f"\n--- PAGE: {page.url} ---\n"
            if page.title:
                part += f"Title: {page.title}\n"
            if page.meta_description:
                part += f"Meta Description: {page.meta_description}\n"
            if page.meta_keywords:
                part += f"Keywords: {', '.join(page.meta_keywords)}\n"

            # Add structured data
            if page.structured_data:
                part += f"Structured Data: {json.dumps(page.structured_data, indent=2)[:2000]}\n"

            # Add text content
            if page.text_content:
                text = re.sub(r'\s+', ' ', page.text_content).strip()
                part += f"Content: {text[:5000]}\n"

            content_parts.append(part)

        full_content = "\n".join(content_parts)
        if len(full_content) > max_chars:
            full_content = full_content[:max_chars] + "\n... [truncated]"

        return full_content

    def _parse_response(self, response_text: str) -> dict:
        """Parse OpenAI response to extract JSON"""
        try:
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass

        return {}

    async def extract(self, snapshot: DomainSnapshot) -> dict:
        """
        Extract company intelligence using OpenAI LLM.

        Args:
            snapshot: Crawled domain snapshot

        Returns:
            Dictionary with extracted fields
        """
        return self.extract_sync(snapshot)

    def extract_sync(self, snapshot: DomainSnapshot) -> dict:
        """Synchronous version of extract"""
        if not self.is_available():
            return {}

        content = self._prepare_content(snapshot)
        prompt = self.EXTRACTION_PROMPT.format(
            domain=snapshot.domain,
            content=content
        )

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert at extracting structured company data from web content. Always respond with valid JSON only."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.1,
                max_tokens=4096,
            )

            if response and response.choices:
                return self._parse_response(response.choices[0].message.content)
        except Exception as e:
            print(f"OpenAI extraction error: {e}")

        return {}


# Aliases for backward compatibility
GroqExtractor = OpenAIExtractor
GeminiExtractor = OpenAIExtractor


def merge_extracted_data(
    base_intelligence: CompanyIntelligence,
    llm_data: dict
) -> CompanyIntelligence:
    """
    Merge LLM-extracted data with base extraction.
    LLM data fills in gaps or overrides with higher confidence.
    """
    if not llm_data:
        return base_intelligence

    # Update basic fields if not already set or LLM provides better data
    if llm_data.get("company_name") and not base_intelligence.company_name:
        base_intelligence.company_name = llm_data["company_name"]

    if llm_data.get("long_description"):
        base_intelligence.long_description = llm_data["long_description"]

    if llm_data.get("short_description"):
        base_intelligence.short_description = llm_data["short_description"]

    # Industry classification
    if llm_data.get("sic_code"):
        base_intelligence.sic_code = llm_data["sic_code"]
    if llm_data.get("sic_text"):
        base_intelligence.sic_text = llm_data["sic_text"]
    if llm_data.get("sub_industry"):
        base_intelligence.sub_industry = llm_data["sub_industry"]
    if llm_data.get("industry"):
        base_intelligence.industry = llm_data["industry"]
    if llm_data.get("sector"):
        base_intelligence.sector = llm_data["sector"]

    # Contact info
    if llm_data.get("full_address"):
        base_intelligence.full_address = llm_data["full_address"]
    if llm_data.get("phone") and not base_intelligence.phone:
        base_intelligence.phone = llm_data["phone"]
    if llm_data.get("email") and not base_intelligence.email:
        base_intelligence.email = llm_data["email"]
    if llm_data.get("hours_of_operation"):
        base_intelligence.hours_of_operation = llm_data["hours_of_operation"]
    if llm_data.get("hq_indicator"):
        base_intelligence.hq_indicator = llm_data["hq_indicator"]
    if llm_data.get("logo_url"):
        base_intelligence.logo_url = llm_data["logo_url"]

    # Social media
    social = SocialMediaLinks(
        linkedin=llm_data.get("linkedin") or base_intelligence.social_links.get("linkedin"),
        facebook=llm_data.get("facebook") or base_intelligence.social_links.get("facebook"),
        instagram=llm_data.get("instagram") or base_intelligence.social_links.get("instagram"),
        twitter=llm_data.get("twitter") or base_intelligence.social_links.get("twitter"),
        youtube=llm_data.get("youtube") or base_intelligence.social_links.get("youtube"),
        blog=llm_data.get("blog") or base_intelligence.social_links.get("blog"),
    )
    base_intelligence.social_media = social

    # Update social_links dict for backward compatibility
    if social.linkedin:
        base_intelligence.social_links["linkedin"] = social.linkedin
    if social.facebook:
        base_intelligence.social_links["facebook"] = social.facebook
    if social.instagram:
        base_intelligence.social_links["instagram"] = social.instagram
    if social.twitter:
        base_intelligence.social_links["twitter"] = social.twitter
    if social.youtube:
        base_intelligence.social_links["youtube"] = social.youtube
    if social.blog:
        base_intelligence.social_links["blog"] = social.blog

    # People
    if llm_data.get("people"):
        people_list = []
        for p in llm_data["people"]:
            if isinstance(p, dict) and p.get("name"):
                people_list.append(ExtractedPerson(
                    name=p["name"],
                    title=p.get("title"),
                    confidence=0.8
                ))
        if people_list:
            base_intelligence.people = people_list

    # Certifications
    if llm_data.get("certifications"):
        certs = llm_data["certifications"]
        if isinstance(certs, list):
            base_intelligence.certifications = [c for c in certs if c]

    # Tags
    if llm_data.get("tags"):
        tags = llm_data["tags"]
        if isinstance(tags, list):
            existing = set(base_intelligence.tags)
            for tag in tags:
                if tag and tag not in existing:
                    base_intelligence.tags.append(tag)

    # Products - REPLACE rule-based products with LLM products (more accurate)
    if llm_data.get("products"):
        products = llm_data["products"]
        if isinstance(products, list):
            base_intelligence.products = []
            for prod in products:
                if prod and isinstance(prod, str) and len(prod) > 1:
                    lower_prod = prod.lower().strip()
                    skip_words = [
                        'home', 'about', 'contact', 'blog', 'news', 'careers', 'company',
                        'products', 'services', 'solutions', 'resources', 'support',
                        'login', 'sign in', 'sign up', 'register', 'subscribe',
                        'follow us', 'newsletter', 'knowledge center', 'help',
                        'privacy', 'terms', 'legal', 'faq', 'menu', 'your',
                        'level up', 'get started', 'learn more', 'read more',
                        'case studies', 'testimonials', 'partners', 'press'
                    ]
                    if lower_prod not in skip_words and len(prod) > 2:
                        base_intelligence.products.append(ExtractedProduct(
                            name=prod,
                            description=None,
                            confidence=0.85
                        ))

    # Technologies
    if llm_data.get("technologies"):
        techs = llm_data["technologies"]
        if isinstance(techs, list):
            for tech in techs:
                if tech and not any(t.name == tech for t in base_intelligence.technologies):
                    base_intelligence.technologies.append(ExtractedTechnology(
                        name=tech,
                        category="technology",
                        confidence=0.7
                    ))

    # New intelligence signals from LLM
    if llm_data.get("founding_year") and not base_intelligence.founding_year:
        try:
            base_intelligence.founding_year = int(llm_data["founding_year"])
        except (ValueError, TypeError):
            pass

    if llm_data.get("employee_count") and not base_intelligence.employee_count_estimate:
        base_intelligence.employee_count_estimate = str(llm_data["employee_count"])

    if llm_data.get("funding_stage") and not base_intelligence.funding_stage:
        base_intelligence.funding_stage = llm_data["funding_stage"]

    if llm_data.get("pricing_model") and not base_intelligence.pricing_model:
        base_intelligence.pricing_model = llm_data["pricing_model"]

    if llm_data.get("job_openings_count") and not base_intelligence.job_openings_count:
        try:
            base_intelligence.job_openings_count = int(llm_data["job_openings_count"])
        except (ValueError, TypeError):
            pass

    # Boost confidence since we used LLM
    base_intelligence.overall_confidence = min(base_intelligence.overall_confidence + 0.2, 1.0)
    base_intelligence.analysis_version = "1.1.0-openai"

    return base_intelligence
