import React from 'react'

const styles = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: '#fafaf7',
    padding: '24px',
  },
  card: {
    maxWidth: '560px',
    width: '100%',
    background: '#fff',
    borderRadius: '14px',
    padding: '32px',
    boxShadow: '0 10px 30px rgba(0, 92, 69, 0.08)',
    border: '1px solid #e5e2da',
  },
  badge: {
    display: 'inline-block',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    color: '#b8860b',
    background: '#fff7e0',
    padding: '4px 10px',
    borderRadius: '999px',
    textTransform: 'uppercase',
    marginBottom: '14px',
  },
  h1: { fontSize: '22px', margin: '0 0 8px', color: '#1B5E37' },
  p: { fontSize: '14px', lineHeight: 1.55, color: '#475569', margin: '0 0 16px' },
  list: { fontSize: '13px', lineHeight: 1.6, color: '#334155', paddingLeft: '20px', margin: '0 0 18px' },
  code: {
    display: 'block',
    background: '#0f172a',
    color: '#e2e8f0',
    padding: '12px 14px',
    borderRadius: '8px',
    fontFamily: '"SFMono-Regular", Menlo, Consolas, monospace',
    fontSize: '12px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    margin: '0 0 18px',
  },
  hint: { fontSize: '12px', color: '#64748b', margin: 0 },
}

export default function ConfigError() {
  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <span style={styles.badge}>Configuration Required</span>
        <h1 style={styles.h1}>AVA Spa Central is not connected to Supabase</h1>
        <p style={styles.p}>
          The deployed app is missing the Supabase URL and/or anon key. Vite
          bundles these at build time, so the values must be set on the
          hosting platform <em>before</em> the deploy runs.
        </p>
        <ol style={styles.list}>
          <li>Open the Netlify site for this app → <b>Site settings → Environment variables</b>.</li>
          <li>Add (or correct) both of these — no quotes, no trailing whitespace:</li>
        </ol>
        <code style={styles.code}>
          VITE_SUPABASE_URL=https://&lt;your-project-ref&gt;.supabase.co{'\n'}
          VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
        </code>
        <ol start={3} style={styles.list}>
          <li><b>Deploys → Trigger deploy → Clear cache and deploy site.</b></li>
          <li>After the build finishes, hard-refresh this page (Ctrl/Cmd + Shift + R) so the service worker picks up the new bundle.</li>
        </ol>
        <p style={styles.hint}>
          If the values look correct, check the browser console for the exact
          parsing error.
        </p>
      </div>
    </div>
  )
}
