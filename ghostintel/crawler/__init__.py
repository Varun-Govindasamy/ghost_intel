"""
GhostIntel Crawler Module - Website crawling and snapshot freezing
Uses httpx for reliable, lightweight crawling (no Playwright dependency)
"""

import asyncio
import sys
import re
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
import json

from ..models.schemas import CrawlResult, DomainSnapshot, CrawlStatus


class DomainCrawler:
    """
    Crawls all reachable internal pages of a domain using httpx
    and stores a normalized local snapshot.
    """
    
    def __init__(self, max_pages: int = 2, include_subdomains: bool = False):
        self.max_pages = max_pages
        self.include_subdomains = include_subdomains
        self.visited_urls: set[str] = set()
        self.pages: list[CrawlResult] = []
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
        
    def _normalize_domain(self, domain: str) -> str:
        """Normalize domain to ensure consistent format"""
        domain = domain.lower().strip()
        if domain.startswith("http://") or domain.startswith("https://"):
            parsed = urlparse(domain)
            domain = parsed.netloc
        domain = domain.replace("www.", "")
        return domain
    
    def _is_valid_internal_url(self, url: str, base_domain: str) -> bool:
        """Check if URL is a valid internal page"""
        try:
            parsed = urlparse(url)
            url_domain = parsed.netloc.lower().replace("www.", "")
            
            # Skip non-http URLs
            if parsed.scheme not in ("http", "https", ""):
                return False
            
            # Skip common non-page resources
            skip_extensions = (
                '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico',
                '.css', '.js', '.woff', '.woff2', '.ttf', '.eot',
                '.mp4', '.mp3', '.avi', '.mov', '.zip', '.rar', '.exe'
            )
            if parsed.path.lower().endswith(skip_extensions):
                return False
            
            # Check if same domain or subdomain
            if self.include_subdomains:
                return url_domain.endswith(base_domain) or url_domain == base_domain
            else:
                return url_domain == base_domain or url_domain == f"www.{base_domain}"
                
        except Exception:
            return False
    
    def _extract_structured_data(self, soup: BeautifulSoup) -> dict:
        """Extract JSON-LD and other structured data from page"""
        structured_data = {}
        
        # Extract JSON-LD
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(script.string)
                if isinstance(data, list):
                    for item in data:
                        item_type = item.get("@type", "unknown")
                        structured_data[item_type] = item
                elif isinstance(data, dict):
                    item_type = data.get("@type", "unknown")
                    structured_data[item_type] = data
            except (json.JSONDecodeError, TypeError):
                continue
        
        return structured_data
    
    def _extract_meta_data(self, soup: BeautifulSoup) -> tuple[Optional[str], list[str]]:
        """Extract meta description and keywords"""
        description = None
        keywords = []
        
        # Meta description
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc:
            description = meta_desc.get("content", "")
        
        # OpenGraph description as fallback
        if not description:
            og_desc = soup.find("meta", property="og:description")
            if og_desc:
                description = og_desc.get("content", "")
        
        # Meta keywords
        meta_kw = soup.find("meta", attrs={"name": "keywords"})
        if meta_kw:
            kw_content = meta_kw.get("content", "")
            keywords = [k.strip() for k in kw_content.split(",") if k.strip()]
        
        return description, keywords
    
    def _extract_links(self, soup: BeautifulSoup, base_url: str) -> list[str]:
        """Extract all links from the page"""
        links = []
        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"]
            # Convert relative URLs to absolute
            absolute_url = urljoin(base_url, href)
            # Remove fragments
            absolute_url = absolute_url.split("#")[0]
            if absolute_url and absolute_url not in links:
                links.append(absolute_url)
        return links
    
    def _html_to_text(self, soup: BeautifulSoup) -> str:
        """Extract clean text content from HTML"""
        # Remove script and style elements
        for element in soup(["script", "style", "nav", "footer", "aside", "header"]):
            element.decompose()
        
        # Get text
        text = soup.get_text(separator="\n", strip=True)
        # Clean up whitespace
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        return "\n".join(lines)
    
    async def crawl_page(self, url: str, client: httpx.AsyncClient) -> Optional[CrawlResult]:
        """Crawl a single page and extract data"""
        try:
            response = await client.get(url, follow_redirects=True, timeout=15.0)
            
            if response.status_code != 200:
                return None
            
            html = response.text
            soup = BeautifulSoup(html, "lxml")
            
            # Extract title
            title = soup.title.string.strip() if soup.title and soup.title.string else None
            
            # Extract meta data
            meta_desc, meta_keywords = self._extract_meta_data(soup)
            
            # Extract structured data
            structured_data = self._extract_structured_data(soup)
            
            # Extract links
            links = self._extract_links(soup, url)
            
            # Extract text content
            text_content = self._html_to_text(BeautifulSoup(html, "lxml"))
            
            return CrawlResult(
                url=url,
                title=title,
                text_content=text_content,
                html_content=html,
                meta_description=meta_desc,
                meta_keywords=meta_keywords,
                structured_data=structured_data,
                links=links,
                status_code=response.status_code,
                crawl_time=datetime.now()
            )
            
        except Exception as e:
            print(f"Error crawling {url}: {e}")
            return None
    
    async def crawl_domain(self, domain: str) -> DomainSnapshot:
        """
        Crawl all pages of a domain and create a frozen snapshot.
        Uses BFS to discover and crawl pages.
        """
        base_domain = self._normalize_domain(domain)
        start_url = f"https://{base_domain}"
        
        snapshot = DomainSnapshot(
            domain=base_domain,
            status=CrawlStatus.IN_PROGRESS,
            crawl_start=datetime.now()
        )
        
        urls_to_crawl = [start_url]
        self.visited_urls = set()
        self.pages = []
        
        try:
            async with httpx.AsyncClient(headers=self.headers, verify=False) as client:
                while urls_to_crawl and len(self.pages) < self.max_pages:
                    current_url = urls_to_crawl.pop(0)
                    
                    # Skip if already visited
                    if current_url in self.visited_urls:
                        continue
                    
                    self.visited_urls.add(current_url)
                    
                    print(f"  📄 Crawling: {current_url}")
                    
                    # Crawl the page
                    result = await self.crawl_page(current_url, client)
                    
                    if result:
                        self.pages.append(result)
                        print(f"  ✅ Crawled: {result.title or current_url}")
                        
                        # Add new internal links to queue
                        for link in result.links:
                            if (link not in self.visited_urls and 
                                link not in urls_to_crawl and
                                self._is_valid_internal_url(link, base_domain)):
                                urls_to_crawl.append(link)
                    
                    # Small delay to be respectful
                    await asyncio.sleep(0.3)
            
            snapshot.pages = self.pages
            snapshot.total_pages = len(self.pages)
            snapshot.status = CrawlStatus.COMPLETED
            snapshot.crawl_end = datetime.now()
            
        except Exception as e:
            snapshot.status = CrawlStatus.FAILED
            snapshot.error_message = str(e)
            snapshot.crawl_end = datetime.now()
        
        return snapshot


async def crawl_company_domain(
    domain: str,
    max_pages: int = 2,
    include_subdomains: bool = False
) -> DomainSnapshot:
    """
    Convenience function to crawl a company domain.
    
    Args:
        domain: Company domain name (e.g., "example.com")
        max_pages: Maximum number of pages to crawl
        include_subdomains: Whether to include subdomains
        
    Returns:
        DomainSnapshot containing all crawled pages
    """
    crawler = DomainCrawler(max_pages=max_pages, include_subdomains=include_subdomains)
    return await crawler.crawl_domain(domain)
