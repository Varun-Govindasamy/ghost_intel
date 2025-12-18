import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Analyze from './pages/Analyze'
import Companies from './pages/Companies'
import CompanyDetail from './pages/CompanyDetail'
import KnowledgeGraph from './pages/KnowledgeGraph'
import Taxonomy from './pages/Taxonomy'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/analyze" element={<Analyze />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/companies/:domain" element={<CompanyDetail />} />
        <Route path="/graph" element={<KnowledgeGraph />} />
        <Route path="/taxonomy" element={<Taxonomy />} />
      </Routes>
    </Layout>
  )
}

export default App
