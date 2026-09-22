import { useEffect, useState } from 'react'

interface SearchBarProps {
  onChange: (value: string) => void
  disabled?: boolean
}

export function SearchBar({ onChange, disabled }: SearchBarProps) {
  const [text, setText] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(text)
    }, 350)
    return () => clearTimeout(timer)
  }, [text, onChange])

  return (
    <div className="search-bar">
      <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <input
        type="search"
        className="search-input"
        placeholder="Search products..."
        value={text}
        disabled={disabled}
        aria-label="Search products"
        onChange={(event) => setText(event.target.value)}
      />
    </div>
  )
}