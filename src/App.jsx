import { useState, useEffect, useRef } from 'react'

const timeFormats = [
  (date) => {
    const h = String(date.getHours()).padStart(2, '0')
    const m = String(date.getMinutes()).padStart(2, '0')
    const s = String(date.getSeconds()).padStart(2, '0')
    return `${h}:${m}:${s}`
  },
  (date) => {
    let hours = date.getHours()
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = (hours % 12) || 12
    return `${hours}:${minutes}:${seconds} ${ampm}`
  }
]

function useFormatPreference(key, defaultIndex) {
  const [formatIndex, setFormatIndex] = useState(() => {
    const saved = localStorage.getItem(key)
    return saved ? parseInt(saved, 10) : defaultIndex
  })

  useEffect(() => {
    localStorage.setItem(key, formatIndex.toString())
  }, [formatIndex])

  const cycleFormat = () => {
    const maxIndex = timeFormats.length - 1
    setFormatIndex(prev => (prev + 1) % (maxIndex + 1))
  }

  return [formatIndex, cycleFormat]
}

function useTheme() {
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const updateTheme = () => {
      document.documentElement.setAttribute('data-theme', mediaQuery.matches ? 'dark' : 'light')
    }
    
    updateTheme()
    mediaQuery.addEventListener('change', updateTheme)
    
    return () => mediaQuery.removeEventListener('change', updateTheme)
  }, [])
}

function Entry({ entry, onCommit, onInputChange, timeFormatIndex, cycleTimeFormat }) {
  const textareaRef = useRef(null)
  
  const [timestamp, setTimestamp] = useState(() => {
    return timeFormats[timeFormatIndex](new Date())
  })

  useEffect(() => {
    const updateTimestamp = (dateObj) => {
      setTimestamp(timeFormats[timeFormatIndex](dateObj))
    }

    if (entry.frozenAt) {
      updateTimestamp(entry.frozenAt)
      return
    }

    if (entry.isActive && !entry.frozen) {
      updateTimestamp(new Date())
      const interval = setInterval(() => {
        updateTimestamp(new Date())
      }, 250)
      return () => clearInterval(interval)
    }
  }, [entry.isActive, entry.frozen, entry.frozenAt, timeFormatIndex])

  const timestampElement = (
    <div className="timestamp clickable" onClick={cycleTimeFormat} title="Click to change time format">
      {timestamp}
    </div>
  )

  useEffect(() => {
    if (entry.isActive && textareaRef.current) {
      // Immediate focus when entry becomes active
      textareaRef.current.focus()
      
      // Keep it focused with interval
      const interval = setInterval(() => {
        if (textareaRef.current && document.activeElement !== textareaRef.current) {
          textareaRef.current.focus()
        }
      }, 50)
      
      // Also refocus on blur
      const handleBlur = () => {
        if (textareaRef.current) {
          // Use setTimeout to ensure focus happens after any other event handlers
          setTimeout(() => {
            if (textareaRef.current && entry.isActive) {
              textareaRef.current.focus()
            }
          }, 0)
        }
      }
      
      const textarea = textareaRef.current
      textarea.addEventListener('blur', handleBlur)
      
      return () => {
        clearInterval(interval)
        textarea.removeEventListener('blur', handleBlur)
      }
    }
  }, [entry.isActive])

  const handleInput = (e) => {
    onInputChange(entry.id, e.target.value)
    
    // Auto-resize
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const textarea = e.target
      const textBeforeCursor = textarea.value.substring(0, textarea.selectionStart)
      const currentLine = textBeforeCursor.split('\n').pop() || ''
      
      if (currentLine.trim().length > 0) {
        onCommit(entry.id)
      }
    }
  }

  if (entry.committed) {
    return (
      <div className="entry">
        {timestampElement}
        <div className="entry-text">{entry.text}</div>
      </div>
    )
  }

  return (
    <div className="entry">
      {timestampElement}
      <textarea
        ref={textareaRef}
        className="entry-input"
        value={entry.text}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        autoFocus={entry.isActive}
        rows={1}
        cols={100}
      />
    </div>
  )
}

function App() {
  useTheme()
  const [timeFormatIndex, cycleTimeFormat] = useFormatPreference('timeFormat', 0)
  const [entries, setEntries] = useState([
    { id: 0, text: '', isActive: true, committed: false, frozen: false, frozenAt: null }
  ])

  const handleInputChange = (id, text) => {
    setEntries(prev => prev.map(entry => {
      if (entry.id === id) {
        const updated = { ...entry, text }
        if (!entry.frozen && text.length > 0) {
          updated.frozen = true
          updated.frozenAt = new Date()
        }
        return updated
      }
      return entry
    }))
  }

  const handleCommit = (id) => {
    setEntries(prev => {
      const updated = prev.map(entry => {
        if (entry.id === id) {
          return { ...entry, committed: true, isActive: false }
        }
        return { ...entry, isActive: false }
      })
      
      const newId = prev.length
      return [...updated, { id: newId, text: '', isActive: true, committed: false, frozen: false, frozenAt: null }]
    })
  }

  return (
    <div className="container">
      {entries.map((entry) => {
        return (
          <Entry
            key={entry.id}
            entry={entry}
            onCommit={handleCommit}
            onInputChange={handleInputChange}
            timeFormatIndex={timeFormatIndex}
            cycleTimeFormat={cycleTimeFormat}
          />
        )
      })}
    </div>
  )
}

export default App

