"""
GhostIntel Knowledge Graph Module
Builds and manages the company knowledge graph using NetworkX
"""

import json
from typing import Optional
import networkx as nx

from ..models.schemas import (
    CompanyIntelligence,
    KnowledgeGraphNode,
    KnowledgeGraphEdge,
    SICTaxonomy,
)


class KnowledgeGraph:
    """
    Builds and manages a knowledge graph representing
    company entities and their relationships.
    """
    
    def __init__(self):
        self.graph = nx.DiGraph()
        self._node_counter = 0
    
    def _generate_node_id(self, prefix: str, name: str) -> str:
        """Generate a unique node ID"""
        # Sanitize name for ID
        sanitized = name.lower().replace(" ", "_").replace(".", "")[:50]
        return f"{prefix}_{sanitized}"
    
    def add_company(self, intelligence: CompanyIntelligence) -> str:
        """
        Add a company and all its relationships to the graph.
        
        Args:
            intelligence: Company intelligence data
            
        Returns:
            Node ID of the company
        """
        company_id = self._generate_node_id("company", intelligence.domain)
        
        # Add company node
        self.graph.add_node(
            company_id,
            label=intelligence.company_name or intelligence.domain,
            node_type="company",
            domain=intelligence.domain,
            description=intelligence.short_description,
            confidence=intelligence.overall_confidence,
        )
        
        # Add industry classification hierarchy
        if intelligence.sector:
            sector_id = self._generate_node_id("sector", intelligence.sector)
            if not self.graph.has_node(sector_id):
                self.graph.add_node(
                    sector_id,
                    label=intelligence.sector,
                    node_type="sector",
                )
            self.graph.add_edge(company_id, sector_id, relationship="in_sector")
        
        if intelligence.industry:
            industry_id = self._generate_node_id("industry", intelligence.industry)
            if not self.graph.has_node(industry_id):
                self.graph.add_node(
                    industry_id,
                    label=intelligence.industry,
                    node_type="industry",
                )
            self.graph.add_edge(company_id, industry_id, relationship="in_industry")
            
            # Link industry to sector
            if intelligence.sector:
                sector_id = self._generate_node_id("sector", intelligence.sector)
                self.graph.add_edge(industry_id, sector_id, relationship="part_of")
        
        if intelligence.sub_industry:
            sub_id = self._generate_node_id("sub_industry", intelligence.sub_industry)
            if not self.graph.has_node(sub_id):
                self.graph.add_node(
                    sub_id,
                    label=intelligence.sub_industry,
                    node_type="sub_industry",
                )
            self.graph.add_edge(company_id, sub_id, relationship="in_sub_industry")
            
            # Link sub-industry to industry
            if intelligence.industry:
                industry_id = self._generate_node_id("industry", intelligence.industry)
                self.graph.add_edge(sub_id, industry_id, relationship="part_of")
        
        # Add products
        for product in intelligence.products:
            product_id = self._generate_node_id("product", f"{intelligence.domain}_{product.name}")
            self.graph.add_node(
                product_id,
                label=product.name,
                node_type="product",
                description=product.description,
                confidence=product.confidence,
            )
            self.graph.add_edge(company_id, product_id, relationship="offers")
        
        # Add technologies
        for tech in intelligence.technologies:
            tech_id = self._generate_node_id("technology", tech.name)
            if not self.graph.has_node(tech_id):
                self.graph.add_node(
                    tech_id,
                    label=tech.name,
                    node_type="technology",
                    category=tech.category,
                )
            self.graph.add_edge(company_id, tech_id, relationship="uses")
        
        # Add locations
        for location in intelligence.locations:
            location_parts = [
                location.city,
                location.state,
                location.country
            ]
            location_name = ", ".join([p for p in location_parts if p])
            if location_name:
                location_id = self._generate_node_id("location", location_name)
                if not self.graph.has_node(location_id):
                    self.graph.add_node(
                        location_id,
                        label=location_name,
                        node_type="location",
                        city=location.city,
                        state=location.state,
                        country=location.country,
                    )
                rel = "headquartered_in" if location.is_headquarters else "located_in"
                self.graph.add_edge(company_id, location_id, relationship=rel)
        
        return company_id
    
    def get_node(self, node_id: str) -> Optional[KnowledgeGraphNode]:
        """Get a node by ID"""
        if not self.graph.has_node(node_id):
            return None
        
        data = self.graph.nodes[node_id]
        return KnowledgeGraphNode(
            id=node_id,
            label=data.get("label", ""),
            node_type=data.get("node_type", "unknown"),
            properties={k: v for k, v in data.items() if k not in ("label", "node_type")}
        )
    
    def get_edges(self, node_id: str) -> list[KnowledgeGraphEdge]:
        """Get all edges connected to a node"""
        edges = []
        
        # Outgoing edges
        for _, target, data in self.graph.out_edges(node_id, data=True):
            edges.append(KnowledgeGraphEdge(
                source=node_id,
                target=target,
                relationship=data.get("relationship", "related"),
                properties={k: v for k, v in data.items() if k != "relationship"}
            ))
        
        # Incoming edges
        for source, _, data in self.graph.in_edges(node_id, data=True):
            edges.append(KnowledgeGraphEdge(
                source=source,
                target=node_id,
                relationship=data.get("relationship", "related"),
                properties={k: v for k, v in data.items() if k != "relationship"}
            ))
        
        return edges
    
    def get_company_subgraph(self, domain: str) -> dict:
        """Get the subgraph for a specific company"""
        company_id = self._generate_node_id("company", domain)
        
        if not self.graph.has_node(company_id):
            return {"nodes": [], "edges": []}
        
        # Get all connected nodes (2 levels deep)
        connected = set([company_id])
        for _ in range(2):
            new_connected = set()
            for node in connected:
                new_connected.update(self.graph.successors(node))
                new_connected.update(self.graph.predecessors(node))
            connected.update(new_connected)
        
        # Build subgraph
        nodes = []
        for node_id in connected:
            node = self.get_node(node_id)
            if node:
                nodes.append(node.model_dump())
        
        edges = []
        for source, target, data in self.graph.edges(data=True):
            if source in connected and target in connected:
                edges.append({
                    "source": source,
                    "target": target,
                    "relationship": data.get("relationship", "related"),
                })
        
        return {"nodes": nodes, "edges": edges}
    
    def get_full_graph(self) -> dict:
        """Get the complete graph as nodes and edges"""
        nodes = []
        for node_id in self.graph.nodes():
            node = self.get_node(node_id)
            if node:
                nodes.append(node.model_dump())
        
        edges = []
        for source, target, data in self.graph.edges(data=True):
            edges.append({
                "source": source,
                "target": target,
                "relationship": data.get("relationship", "related"),
            })
        
        return {"nodes": nodes, "edges": edges}
    
    def get_statistics(self) -> dict:
        """Get graph statistics"""
        node_types = {}
        for node_id in self.graph.nodes():
            node_type = self.graph.nodes[node_id].get("node_type", "unknown")
            node_types[node_type] = node_types.get(node_type, 0) + 1
        
        return {
            "total_nodes": self.graph.number_of_nodes(),
            "total_edges": self.graph.number_of_edges(),
            "node_types": node_types,
        }
    
    def find_similar_companies(self, domain: str, limit: int = 10) -> list[str]:
        """
        Find companies similar to the given domain based on shared
        industry, technologies, and other relationships.
        """
        company_id = self._generate_node_id("company", domain)
        
        if not self.graph.has_node(company_id):
            return []
        
        # Get this company's connected nodes
        company_connections = set()
        for _, target, _ in self.graph.out_edges(company_id, data=True):
            if self.graph.nodes[target].get("node_type") != "product":
                company_connections.add(target)
        
        # Find other companies with overlapping connections
        similarity_scores = {}
        for node_id in self.graph.nodes():
            if self.graph.nodes[node_id].get("node_type") != "company":
                continue
            if node_id == company_id:
                continue
            
            other_connections = set()
            for _, target, _ in self.graph.out_edges(node_id, data=True):
                if self.graph.nodes[target].get("node_type") != "product":
                    other_connections.add(target)
            
            overlap = len(company_connections & other_connections)
            if overlap > 0:
                similarity_scores[node_id] = overlap
        
        # Sort by similarity and return domains
        sorted_companies = sorted(similarity_scores.keys(), 
                                  key=lambda x: similarity_scores[x], 
                                  reverse=True)
        
        return [
            self.graph.nodes[c].get("domain", c)
            for c in sorted_companies[:limit]
        ]
    
    def export_to_json(self) -> str:
        """Export graph to JSON format"""
        return json.dumps(self.get_full_graph(), indent=2)
    
    def get_industry_distribution(self) -> dict[str, int]:
        """Get distribution of companies across industries"""
        distribution = {}
        
        for node_id in self.graph.nodes():
            if self.graph.nodes[node_id].get("node_type") == "company":
                # Find connected industry
                for _, target, data in self.graph.out_edges(node_id, data=True):
                    if data.get("relationship") == "in_industry":
                        industry = self.graph.nodes[target].get("label", "Unknown")
                        distribution[industry] = distribution.get(industry, 0) + 1
                        break
        
        return distribution
    
    def get_technology_trends(self) -> dict[str, int]:
        """Get technology usage across all companies"""
        tech_usage = {}
        
        for node_id in self.graph.nodes():
            if self.graph.nodes[node_id].get("node_type") == "technology":
                # Count companies using this technology
                count = len(list(self.graph.predecessors(node_id)))
                tech_usage[self.graph.nodes[node_id].get("label", "Unknown")] = count
        
        return dict(sorted(tech_usage.items(), key=lambda x: x[1], reverse=True))


# Global graph instance
_knowledge_graph: Optional[KnowledgeGraph] = None


def get_knowledge_graph() -> KnowledgeGraph:
    """Get or create the global knowledge graph instance"""
    global _knowledge_graph
    if _knowledge_graph is None:
        _knowledge_graph = KnowledgeGraph()
    return _knowledge_graph


def reset_knowledge_graph():
    """Reset the global knowledge graph"""
    global _knowledge_graph
    _knowledge_graph = KnowledgeGraph()
