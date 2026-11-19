import { useEffect, useMemo, useState } from 'react'
import {
  Activity, Boxes, ChartNoAxesCombined, Layers3, RefreshCw, ShieldCheck,
  Server, Trash2, Gauge, AlertCircle, CheckCircle2, Plus, Menu
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts'

const API = '/api'
const fmt = (value) => value ?? '—'
const quantity = (value, unit) => {
  if (!value) return 0
  const s = String(value)
  if (unit === 'cpu') {
    if (s.endsWith('m')) return Number(s.slice(0, -1)) / 1000
    return Number(s) || 0
  }
  if (s.endsWith('Ki')) return Number(s.slice(0, -2)) / 1024
  if (s.endsWith('Mi')) return Number(s.slice(0, -2))
  if (s.endsWith('Gi')) return Number(s.slice(0, -2)) * 1024
  return Number(s) || 0
}
const cpuText = (v) => `${Math.round(v * 1000)}m`
const memText = (v) => `${Math.round(v)}Mi`

export default function App() {
  const [data, setData] = useState({ namespaces: [], quotas: [], limitRanges: [], pods: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null)
  const [form, setForm] = useState({
    name: '', namespace: 'app-b', image: 'nginx:latest',
    cpuRequest: '100m', memoryRequest: '128Mi', cpuLimit: '200m', memoryLimit: '256Mi'
  })

  async function refresh() {
    setLoading(true)
    try {
      const response = await fetch(`${API}/overview`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to load Kubernetes data')
      setData(result)
      setError('')
    } catch (e) {
      setError(`${e.message}. Check that Docker Desktop Kubernetes and the backend are running.`)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { refresh() }, [])

  const namespaceNames = data.namespaces.map(n => n.metadata.name).filter(n => ['app-a', 'app-b'].includes(n))
  const podCount = data.pods.length
  const runningCount = data.pods.filter(p => p.status?.phase === 'Running').length

  const chartData = useMemo(() => namespaceNames.map(name => {
    const quota = data.quotas.find(q => q.metadata.namespace === name)?.status?.hard || {}
    const used = data.quotas.find(q => q.metadata.namespace === name)?.status?.used || {}
    return {
      namespace: name,
      cpuQuota: quantity(quota['requests.cpu'], 'cpu'),
      cpuUsed: quantity(used['requests.cpu'], 'cpu'),
      memoryQuota: quantity(quota['requests.memory'], 'memory'),
      memoryUsed: quantity(used['requests.memory'], 'memory')
    }
  }), [data, namespaceNames.join('|')])

  async function deploy(e) {
    e.preventDefault()
    setNotice(null)
    try {
      const response = await fetch(`${API}/pods`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Pod deployment rejected')
      setNotice({ type: 'success', message: `Pod ${form.name} created successfully.` })
      setForm(f => ({ ...f, name: '' }))
      await refresh()
    } catch (e) {
      setNotice({ type: 'error', message: e.message })
      await refresh()
    }
  }

  async function removePod(namespace, name) {
    if (!window.confirm(`Delete pod "${name}" from ${namespace}?`)) return
    try {
      const response = await fetch(`${API}/pods/${namespace}/${name}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Pod deletion failed')
      setNotice({ type: 'success', message: result.message })
      setTimeout(refresh, 900)
    } catch (e) {
      setNotice({ type: 'error', message: e.message })
    }
  }

  const quotasFor = (ns) => data.quotas.find(q => q.metadata.namespace === ns)
  const limitsFor = (ns) => data.limitRanges.find(q => q.metadata.namespace === ns)

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon"><Layers3 size={25}/></div><div><b>KubeManager</b><small>RESOURCE CONTROL</small></div></div>
      <div className="nav-label">WORKSPACE</div>
      <a className="nav-item active"><Activity size={18}/> Overview</a>
      <a className="nav-item" href="#namespaces"><Server size={18}/> Namespaces</a>
      <a className="nav-item" href="#quotas"><Gauge size={18}/> Resource Quotas</a>
      <a className="nav-item" href="#limits"><ShieldCheck size={18}/> Limit Ranges</a>
      <a className="nav-item" href="#pods"><Boxes size={18}/> Pods</a>
      <div className="sidebar-foot">Kubernetes Resource Manager<br/>Lab Problem 06</div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div><h1>Resource Overview</h1><p>Monitor and manage your Kubernetes resources.</p></div>
        <button className="secondary" onClick={refresh}><RefreshCw size={16}/> Refresh</button>
      </header>

      {error && <div className="alert error"><AlertCircle size={18}/>{error}</div>}
      {notice && <div className={`alert ${notice.type}`}><span>{notice.type === 'success' ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}</span><span>{notice.message}</span><button className="close" onClick={() => setNotice(null)}>×</button></div>}

      <section className="stats">
        <Stat icon={<Layers3/>} label="Namespaces" value={namespaceNames.length}/>
        <Stat icon={<Boxes/>} label="Total Pods" value={podCount}/>
        <Stat icon={<Activity/>} label="Running Pods" value={runningCount}/>
        <Stat icon={<ShieldCheck/>} label="Resource Quotas" value={data.quotas.length}/>
      </section>

      <section className="panel">
        <div className="panel-heading"><div><h2>Namespace Resource Usage</h2><p>Resource requests compared with quota limits</p></div></div>
        <div className="charts">
          <div className="chart"><h3>CPU Requests (cores)</h3><ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="namespace"/><YAxis/><Tooltip/><Legend/><Bar dataKey="cpuQuota" name="Quota" fill="#cbd5e1"/><Bar dataKey="cpuUsed" name="Used" fill="#2563eb"/></BarChart>
          </ResponsiveContainer></div>
          <div className="chart"><h3>Memory Requests (MiB)</h3><ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="namespace"/><YAxis/><Tooltip/><Legend/><Bar dataKey="memoryQuota" name="Quota" fill="#cbd5e1"/><Bar dataKey="memoryUsed" name="Used" fill="#16a34a"/></BarChart>
          </ResponsiveContainer></div>
        </div>
      </section>

      <section className="panel" id="namespaces">
        <h2>Namespace Details</h2>
        <div className="table-wrap"><table><thead><tr><th>Namespace</th><th>CPU Used / Quota</th><th>Memory Used / Quota</th><th>Pods</th><th>LimitRanges</th></tr></thead>
          <tbody>{namespaceNames.map(ns => {
            const q = quotasFor(ns), used = q?.status?.used || {}, hard = q?.status?.hard || {}
            return <tr key={ns}><td><b>{ns}</b></td><td>{fmt(used['requests.cpu'])} / {fmt(hard['requests.cpu'])}</td><td>{fmt(used['requests.memory'])} / {fmt(hard['requests.memory'])}</td><td>{data.pods.filter(p => p.metadata.namespace === ns).length} / {fmt(hard.pods)}</td><td>{limitsFor(ns)?.metadata.name || '—'}</td></tr>
          })}</tbody></table></div>
      </section>

      <section className="panel" id="quotas">
        <h2>Resource Quotas</h2>
        <div className="quota-grid">{data.quotas.map(q => <div className="quota-card" key={q.metadata.uid}>
          <h3>{q.metadata.name}</h3><span className="muted">{q.metadata.namespace}</span>
          {Object.entries(q.status?.hard || {}).map(([key, hard]) => <div className="quota-line" key={key}><span>{key}</span><b>{q.status?.used?.[key] || '0'} / {hard}</b></div>)}
        </div>)}</div>
      </section>

      <section className="panel" id="limits">
        <h2>Limit Ranges</h2>
        <div className="quota-grid">{data.limitRanges.map(lr => <div className="quota-card" key={lr.metadata.uid}>
          <h3>{lr.metadata.name}</h3><span className="muted">{lr.metadata.namespace}</span>
          {(lr.spec?.limits || []).map((limit, i) => <div key={i} className="limit-details">
            <b>{limit.type}</b>
            <p>Default request: {limit.defaultRequest?.cpu || '—'} CPU / {limit.defaultRequest?.memory || '—'} RAM</p>
            <p>Default limit: {limit.default?.cpu || '—'} CPU / {limit.default?.memory || '—'} RAM</p>
            <p>Minimum: {limit.min?.cpu || '—'} CPU / {limit.min?.memory || '—'} RAM</p>
            <p>Maximum: {limit.max?.cpu || '—'} CPU / {limit.max?.memory || '—'} RAM</p>
          </div>)}
        </div>)}</div>
      </section>

      <section className="panel" id="pods">
        <h2>Pod Management</h2>
        {namespaceNames.map(ns => <div className="pod-group" key={ns}><h3>{ns}</h3><div className="table-wrap"><table><thead><tr><th>Pod Name</th><th>Status</th><th>CPU Request</th><th>Memory Request</th><th>Action</th></tr></thead>
          <tbody>{data.pods.filter(p => p.metadata.namespace === ns).map(p => {
            const c = p.spec?.containers?.[0] || {}
            return <tr key={p.metadata.uid}><td>{p.metadata.name}</td><td><span className={`status ${p.status?.phase === 'Running' ? 'running' : ''}`}>{p.status?.phase || 'Unknown'}</span></td><td>{c.resources?.requests?.cpu || '—'}</td><td>{c.resources?.requests?.memory || '—'}</td><td><button className="delete" title="Delete pod" onClick={() => removePod(ns, p.metadata.name)}><Trash2 size={17}/></button></td></tr>
          })}</tbody></table></div></div>)}
      </section>

      <section className="panel" id="deploy">
        <h2>Deploy New Pod</h2><p className="subheading">Test Kubernetes ResourceQuota enforcement</p>
        <form onSubmit={deploy} className="deploy-form">
          <Field label="Pod name"><input required pattern="[a-z0-9]([-a-z0-9]*[a-z0-9])?" value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="example-pod"/></Field>
          <Field label="Namespace"><select value={form.namespace} onChange={e => setForm({...form, namespace:e.target.value})}>{namespaceNames.map(n => <option key={n}>{n}</option>)}</select></Field>
          <Field label="Container image"><input required value={form.image} onChange={e => setForm({...form, image:e.target.value})}/></Field>
          <Field label="CPU request"><input value={form.cpuRequest} onChange={e => setForm({...form, cpuRequest:e.target.value})} placeholder="100m"/></Field>
          <Field label="Memory request"><input value={form.memoryRequest} onChange={e => setForm({...form, memoryRequest:e.target.value})} placeholder="128Mi"/></Field>
          <Field label="CPU limit"><input value={form.cpuLimit} onChange={e => setForm({...form, cpuLimit:e.target.value})} placeholder="200m"/></Field>
          <Field label="Memory limit"><input value={form.memoryLimit} onChange={e => setForm({...form, memoryLimit:e.target.value})} placeholder="256Mi"/></Field>
          <div className="form-action"><button className="primary" type="submit"><Plus size={17}/> Deploy Pod</button></div>
        </form>
      </section>
      <footer> KubeManager · Kubernetes & Microservices Deployment · Problem 06</footer>
    </main>
  </div>
}

function Stat({ icon, label, value }) {
  return <div className="stat-card"><div className="stat-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong></div></div>
}
function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>
}
