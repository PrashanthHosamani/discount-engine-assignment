import { useRef } from 'react'

export default function CartPdfUploader({ onFileSelect, loading, fileName }) {
  const inputRef = useRef(null)

  function handleChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    onFileSelect(file)
    e.target.value = ''
  }

  return (
    <div
      onClick={() => !loading && inputRef.current?.click()}
      style={{
        marginTop: '0.6rem',
        border: `2px dashed ${fileName ? '#1e5c2c' : '#CECECE'}`,
        borderRadius: 6,
        padding: '0.8rem 1.2rem',
        background: fileName ? '#f0faf2' : '#fafafa',
        cursor: loading ? 'wait' : 'pointer',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '4px 7px',
            borderRadius: 4,
            background: fileName ? '#d7f0dd' : '#eceef2',
            color: fileName ? '#1e5c2c' : '#131A48',
            letterSpacing: '0.05em',
          }}
        >
          PDF
        </span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#131A48' }}>cart.pdf</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
            {loading ? 'Extracting cart table…' : fileName || 'Upload a cart PDF to replace current cart'}
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: fileName ? '#1e5c2c' : '#FF5800',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {loading ? 'Reading' : fileName ? 'Replace' : 'Upload PDF'}
          </span>
        </div>
      </div>
    </div>
  )
}

