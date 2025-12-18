const API_BASE = "/api";

export async function analyzeCompany(domain, maxPages = 50) {
  const response = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain, max_pages: maxPages }),
  });
  return response.json();
}

export async function getAnalysisStatus(domain) {
  const response = await fetch(`${API_BASE}/analyze/${domain}/status`);
  return response.json();
}

export async function getCompanies() {
  const response = await fetch(`${API_BASE}/companies`);
  return response.json();
}

export async function getCompany(domain) {
  const response = await fetch(`${API_BASE}/companies/${domain}`);
  if (!response.ok) throw new Error("Company not found");
  return response.json();
}

export async function deleteCompany(domain) {
  const response = await fetch(`${API_BASE}/companies/${domain}`, {
    method: "DELETE",
  });
  return response.json();
}

export async function batchAnalyze(domains, maxPagesPerDomain = 30) {
  const response = await fetch(`${API_BASE}/batch/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      domains,
      max_pages_per_domain: maxPagesPerDomain,
    }),
  });
  return response.json();
}

export async function getBatchStatus(taskId) {
  const response = await fetch(`${API_BASE}/batch/${taskId}`);
  return response.json();
}

export async function getTaxonomy() {
  const response = await fetch(`${API_BASE}/taxonomy`);
  return response.json();
}

export async function searchTaxonomy(query) {
  const response = await fetch(
    `${API_BASE}/taxonomy/search/${encodeURIComponent(query)}`
  );
  return response.json();
}

export async function getGraph() {
  const response = await fetch(`${API_BASE}/graph`);
  return response.json();
}

export async function getCompanyGraph(domain) {
  const response = await fetch(`${API_BASE}/graph/company/${domain}`);
  return response.json();
}

export async function getGraphStatistics() {
  const response = await fetch(`${API_BASE}/graph/statistics`);
  return response.json();
}

export async function getIndustryDistribution() {
  const response = await fetch(`${API_BASE}/graph/industries`);
  return response.json();
}

export async function getTechnologyTrends() {
  const response = await fetch(`${API_BASE}/graph/technologies`);
  return response.json();
}

export async function getSimilarCompanies(domain, limit = 10) {
  const response = await fetch(
    `${API_BASE}/graph/similar/${domain}?limit=${limit}`
  );
  return response.json();
}

export async function getAnalyticsSummary() {
  const response = await fetch(`${API_BASE}/analytics/summary`);
  return response.json();
}

export async function checkHealth() {
  const response = await fetch(`${API_BASE.replace("/api", "")}/health`);
  return response.json();
}
