"""
GhostIntel SIC Classification Engine
Deterministic industry classification using SIC taxonomy
"""

import json
import re
from pathlib import Path
from typing import Optional

from ..models.schemas import (
    CompanyIntelligence,
    SICTaxonomy,
    ConfidenceScore,
    ExtractionEvidence,
)


class SICClassifier:
    """
    Classifies companies using standardized SIC codes
    through keyword matching and rule-based inference.
    """
    
    # Keyword mappings to SIC codes
    # Maps keywords/phrases to SIC codes with weights
    KEYWORD_SIC_MAPPING = {
        # Technology / Software
        "software": [("7372", 0.9), ("7371", 0.8)],
        "saas": [("7372", 0.95)],
        "cloud computing": [("7374", 0.9)],
        "data processing": [("7374", 0.9)],
        "computer programming": [("7371", 0.95)],
        "software development": [("7371", 0.95)],
        "web development": [("7371", 0.85)],
        "mobile app": [("7372", 0.85)],
        "it consulting": [("7379", 0.9)],
        "systems integration": [("7373", 0.9)],
        "cybersecurity": [("7382", 0.9)],
        "information security": [("7382", 0.9)],
        "artificial intelligence": [("7372", 0.8), ("8730", 0.7)],
        "machine learning": [("7372", 0.8), ("8730", 0.7)],
        
        # Consulting
        "management consulting": [("8742", 0.95)],
        "business consulting": [("8742", 0.9)],
        "strategy consulting": [("8742", 0.9)],
        "consulting services": [("8742", 0.85)],
        
        # Marketing / Advertising
        "advertising": [("7310", 0.95)],
        "marketing agency": [("7310", 0.9)],
        "digital marketing": [("7310", 0.9)],
        "public relations": [("8743", 0.95)],
        "branding": [("7310", 0.8)],
        
        # Finance
        "banking": [("6000", 0.95)],
        "investment": [("6200", 0.85), ("6700", 0.8)],
        "insurance": [("6300", 0.9), ("6400", 0.85)],
        "financial services": [("6200", 0.85)],
        "fintech": [("6200", 0.8), ("7372", 0.7)],
        "lending": [("6100", 0.9)],
        "payment processing": [("6100", 0.85)],
        
        # Healthcare
        "healthcare": [("8000", 0.9)],
        "hospital": [("8060", 0.95)],
        "medical": [("8000", 0.85)],
        "pharmaceutical": [("2830", 0.95)],
        "biotech": [("2830", 0.85), ("8730", 0.8)],
        "health tech": [("8000", 0.8), ("7372", 0.7)],
        "telemedicine": [("8000", 0.85)],
        
        # E-commerce / Retail
        "e-commerce": [("5961", 0.95)],
        "online retail": [("5961", 0.9)],
        "marketplace": [("5961", 0.85)],
        "retail": [("5300", 0.8)],
        
        # Manufacturing
        "manufacturing": [("3900", 0.8)],
        "automotive": [("3710", 0.9)],
        "aerospace": [("3720", 0.9)],
        "electronics": [("3600", 0.85)],
        "semiconductor": [("3670", 0.9)],
        
        # Real Estate
        "real estate": [("6500", 0.95)],
        "property management": [("6500", 0.9)],
        "construction": [("1500", 0.9)],
        
        # Education
        "education": [("8200", 0.9)],
        "e-learning": [("8200", 0.85)],
        "edtech": [("8200", 0.8), ("7372", 0.7)],
        "training": [("8200", 0.8)],
        "online courses": [("8200", 0.85)],
        
        # Media / Entertainment
        "media": [("4830", 0.8)],
        "entertainment": [("7900", 0.85)],
        "gaming": [("7900", 0.8)],
        "streaming": [("4830", 0.8)],
        "publishing": [("2700", 0.9)],
        
        # Logistics / Transportation
        "logistics": [("4200", 0.9)],
        "shipping": [("4200", 0.85), ("4400", 0.8)],
        "transportation": [("4700", 0.85)],
        "supply chain": [("4200", 0.85)],
        
        # Energy
        "energy": [("4900", 0.8)],
        "oil and gas": [("1300", 0.95)],
        "renewable energy": [("4900", 0.9)],
        "solar": [("4900", 0.85)],
        "utilities": [("4900", 0.9)],
        
        # HR / Staffing
        "staffing": [("7360", 0.95)],
        "recruiting": [("7360", 0.9)],
        "hr tech": [("7360", 0.8), ("7372", 0.7)],
        "human resources": [("7360", 0.85)],
        
        # Legal
        "legal services": [("8100", 0.95)],
        "law firm": [("8100", 0.95)],
        
        # Hospitality
        "hotel": [("7000", 0.95)],
        "hospitality": [("7000", 0.9)],
        "travel": [("4700", 0.8)],
        "restaurant": [("5800", 0.95)],
        
        # Data / Analytics
        "data analytics": [("7374", 0.9)],
        "business intelligence": [("7374", 0.85)],
        "big data": [("7374", 0.85)],
        
        # Professional Services
        "accounting": [("8720", 0.95)],
        "engineering services": [("8710", 0.9)],
        "architecture": [("8710", 0.9)],
        "research": [("8730", 0.9)],
    }
    
    def __init__(self, taxonomy_path: Optional[str] = None):
        """
        Initialize classifier with SIC taxonomy.
        
        Args:
            taxonomy_path: Path to SIC taxonomy JSON file
        """
        self.taxonomy: dict[str, SICTaxonomy] = {}
        self._load_taxonomy(taxonomy_path)
    
    def _load_taxonomy(self, taxonomy_path: Optional[str] = None):
        """Load SIC taxonomy from JSON file"""
        if taxonomy_path is None:
            # Default path relative to this module
            taxonomy_path = Path(__file__).parent.parent / "data" / "sic_taxonomy.json"
        else:
            taxonomy_path = Path(taxonomy_path)
        
        try:
            with open(taxonomy_path, 'r', encoding='utf-8') as f:
                taxonomy_data = json.load(f)
            
            for item in taxonomy_data:
                sic = SICTaxonomy(**item)
                self.taxonomy[sic.sic_code] = sic
                
        except FileNotFoundError:
            print(f"Warning: SIC taxonomy file not found at {taxonomy_path}")
        except json.JSONDecodeError as e:
            print(f"Warning: Error parsing SIC taxonomy: {e}")
    
    def _normalize_text(self, text: str) -> str:
        """Normalize text for matching"""
        return text.lower().strip()
    
    def _calculate_keyword_matches(
        self,
        text: str
    ) -> dict[str, float]:
        """
        Calculate SIC code scores based on keyword matches.
        
        Returns dict mapping SIC codes to confidence scores.
        """
        text = self._normalize_text(text)
        sic_scores: dict[str, float] = {}
        
        for keyword, sic_mappings in self.KEYWORD_SIC_MAPPING.items():
            # Check if keyword appears in text
            if re.search(r'\b' + re.escape(keyword) + r'\b', text, re.IGNORECASE):
                for sic_code, weight in sic_mappings:
                    if sic_code not in sic_scores:
                        sic_scores[sic_code] = 0.0
                    # Accumulate scores (with diminishing returns)
                    sic_scores[sic_code] = min(1.0, sic_scores[sic_code] + weight * 0.5)
        
        return sic_scores
    
    def classify(
        self,
        intelligence: CompanyIntelligence
    ) -> CompanyIntelligence:
        """
        Classify a company using SIC codes based on extracted intelligence.
        
        Args:
            intelligence: Extracted company intelligence
            
        Returns:
            CompanyIntelligence with SIC classification added
        """
        # Combine all text for analysis
        text_parts = []
        
        if intelligence.long_description:
            text_parts.append(intelligence.long_description)
        if intelligence.short_description:
            text_parts.append(intelligence.short_description)
        
        # Add product names
        for product in intelligence.products:
            text_parts.append(product.name)
            if product.description:
                text_parts.append(product.description)
        
        # Add tags
        text_parts.extend(intelligence.tags)
        
        combined_text = " ".join(text_parts)
        
        if not combined_text.strip():
            return intelligence
        
        # Calculate keyword-based SIC scores
        sic_scores = self._calculate_keyword_matches(combined_text)
        
        if not sic_scores:
            return intelligence
        
        # Get best SIC code
        best_sic = max(sic_scores, key=sic_scores.get)
        best_confidence = sic_scores[best_sic]
        
        # Only assign if confidence meets threshold
        MIN_CONFIDENCE_THRESHOLD = 0.3
        
        if best_confidence < MIN_CONFIDENCE_THRESHOLD:
            return intelligence
        
        # Look up taxonomy
        if best_sic not in self.taxonomy:
            return intelligence
        
        taxonomy = self.taxonomy[best_sic]
        
        # Create confidence evidence
        evidence = ExtractionEvidence(
            source_url=intelligence.domain,
            text_snippet=f"Matched keywords in company description",
            extraction_method="sic_keyword_matching"
        )
        
        # Update intelligence with classification
        intelligence.sic_code = best_sic
        intelligence.sic_text = taxonomy.sic_description
        intelligence.sub_industry = taxonomy.sub_industry
        intelligence.industry = taxonomy.industry
        intelligence.sector = taxonomy.sector
        intelligence.classification_confidence = ConfidenceScore(
            value=best_confidence,
            evidence=[evidence]
        )
        
        return intelligence
    
    def get_taxonomy(self, sic_code: str) -> Optional[SICTaxonomy]:
        """Get taxonomy entry for a SIC code"""
        return self.taxonomy.get(sic_code)
    
    def get_all_taxonomy(self) -> list[SICTaxonomy]:
        """Get all taxonomy entries"""
        return list(self.taxonomy.values())
    
    def search_taxonomy(self, query: str) -> list[SICTaxonomy]:
        """
        Semantic search of taxonomy with fuzzy matching, synonyms, and ranking.
        Searches across SIC codes, descriptions, industries, sectors, and sub-industries.
        """
        query = query.lower().strip()
        if not query:
            return list(self.taxonomy.values())
        
        # Split query into tokens for partial matching
        query_tokens = query.split()
        
        # Synonym mappings for common terms
        synonyms = {
            "tech": ["technology", "software", "computer", "it", "digital"],
            "technology": ["tech", "software", "computer", "it", "digital"],
            "software": ["tech", "technology", "computer", "programming", "app"],
            "finance": ["financial", "banking", "investment", "fintech", "money"],
            "financial": ["finance", "banking", "investment", "fintech", "money"],
            "bank": ["banking", "finance", "financial", "credit"],
            "banking": ["bank", "finance", "financial", "credit", "lending"],
            "health": ["healthcare", "medical", "hospital", "health care"],
            "healthcare": ["health", "medical", "hospital", "health care", "biotech"],
            "medical": ["health", "healthcare", "hospital", "medicine", "clinical"],
            "retail": ["store", "shop", "ecommerce", "e-commerce", "sales"],
            "ecommerce": ["e-commerce", "retail", "online", "shop", "store"],
            "e-commerce": ["ecommerce", "retail", "online", "shop", "store"],
            "manufacturing": ["factory", "production", "industrial", "manufacturing"],
            "consulting": ["consultant", "advisory", "consultancy", "services"],
            "marketing": ["advertising", "ads", "promotion", "media", "digital"],
            "advertising": ["marketing", "ads", "media", "promotion"],
            "insurance": ["insure", "underwriting", "coverage", "policy"],
            "real estate": ["property", "realty", "housing", "land"],
            "property": ["real estate", "realty", "housing", "land"],
            "education": ["learning", "school", "training", "teaching", "edtech"],
            "legal": ["law", "attorney", "lawyer", "legal services"],
            "law": ["legal", "attorney", "lawyer", "legal services"],
            "energy": ["power", "electric", "utility", "oil", "gas"],
            "oil": ["petroleum", "energy", "gas", "fuel"],
            "transport": ["transportation", "logistics", "shipping", "delivery"],
            "transportation": ["transport", "logistics", "shipping", "delivery"],
            "logistics": ["transport", "transportation", "shipping", "supply chain"],
            "food": ["restaurant", "dining", "grocery", "beverage"],
            "restaurant": ["food", "dining", "eatery", "hospitality"],
            "hotel": ["hospitality", "lodging", "travel", "accommodation"],
            "hospitality": ["hotel", "lodging", "travel", "accommodation"],
            "it": ["information technology", "tech", "computer", "software"],
            "ai": ["artificial intelligence", "machine learning", "ml"],
            "ml": ["machine learning", "artificial intelligence", "ai"],
            "hr": ["human resources", "staffing", "recruiting", "employment"],
            "staffing": ["hr", "recruiting", "employment", "hiring"],
        }
        
        # Expand query with synonyms
        expanded_terms = set(query_tokens)
        for token in query_tokens:
            if token in synonyms:
                expanded_terms.update(synonyms[token])
        
        results_with_scores = []
        
        for sic in self.taxonomy.values():
            score = 0.0
            
            # Searchable fields
            sic_code = sic.sic_code.lower()
            description = sic.sic_description.lower()
            sub_industry = sic.sub_industry.lower()
            industry = sic.industry.lower()
            sector = sic.sector.lower()
            
            # Combine all text for matching
            all_text = f"{sic_code} {description} {sub_industry} {industry} {sector}"
            
            # Exact SIC code match (highest priority)
            if query == sic_code or query in sic_code:
                score += 100
            
            # Full query exact match
            if query in description:
                score += 50
            if query in sub_industry:
                score += 40
            if query in industry:
                score += 35
            if query in sector:
                score += 30
            
            # Token matching (partial word matching)
            for token in query_tokens:
                if len(token) < 2:
                    continue
                    
                # Check if token appears in any field
                if token in description:
                    score += 20
                elif token in sub_industry:
                    score += 15
                elif token in industry:
                    score += 12
                elif token in sector:
                    score += 10
                
                # Partial match (word starts with token)
                words = all_text.split()
                for word in words:
                    if word.startswith(token) and token != word:
                        score += 5
                        break
            
            # Synonym matching
            for term in expanded_terms:
                if term not in query_tokens and len(term) >= 2:
                    if term in all_text:
                        score += 8
            
            # Add to results if score > 0
            if score > 0:
                results_with_scores.append((sic, score))
        
        # Sort by score descending
        results_with_scores.sort(key=lambda x: x[1], reverse=True)
        
        # Return sorted results (top 50 max)
        return [sic for sic, score in results_with_scores[:50]]


def classify_company(intelligence: CompanyIntelligence) -> CompanyIntelligence:
    """
    Convenience function to classify a company.
    
    Args:
        intelligence: Extracted company intelligence
        
    Returns:
        CompanyIntelligence with SIC classification
    """
    classifier = SICClassifier()
    return classifier.classify(intelligence)
