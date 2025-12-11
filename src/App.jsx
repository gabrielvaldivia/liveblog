import { useState, useEffect, useRef } from 'react'

const dateFormats = [
  (date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
  },
  (date) => {
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const year = date.getFullYear()
    return `${month}/${day}/${year}`
  }
]

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
    const maxIndex = key === 'dateFormat' ? dateFormats.length - 1 : timeFormats.length - 1
    setFormatIndex(prev => (prev + 1) % (maxIndex + 1))
  }

  return [formatIndex, cycleFormat]
}

function isSameDay(date1, date2) {
  if (!date1 || !date2) return false
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate()
}

function getEntryDate(entry) {
  if (entry.frozenAt) {
    return entry.frozenAt
  }
  // For active entries, use current date
  return new Date()
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

function Entry({ entry, onCommit, onInputChange, previousEntryDate, dateFormatIndex, timeFormatIndex, cycleDateFormat, cycleTimeFormat }) {
  const textareaRef = useRef(null)
  
  const [timestamp, setTimestamp] = useState(() => {
    return timeFormats[timeFormatIndex](new Date())
  })
  const [date, setDate] = useState(() => {
    return dateFormats[dateFormatIndex](new Date())
  })

  useEffect(() => {
    const updateFormats = (dateObj) => {
      setTimestamp(timeFormats[timeFormatIndex](dateObj))
      setDate(dateFormats[dateFormatIndex](dateObj))
    }

    if (entry.frozenAt) {
      updateFormats(entry.frozenAt)
      return
    }

    if (entry.isActive && !entry.frozen) {
      updateFormats(new Date())
      const interval = setInterval(() => {
        updateFormats(new Date())
      }, 250)
      return () => clearInterval(interval)
    }
  }, [entry.isActive, entry.frozen, entry.frozenAt, dateFormatIndex, timeFormatIndex])

  const entryDate = getEntryDate(entry)
  const shouldShowDate = !previousEntryDate || !isSameDay(entryDate, previousEntryDate)

  const dateElement = (
    <div className="date clickable" onClick={cycleDateFormat} title="Click to change date format">
      {shouldShowDate ? date : '\u00A0'}
    </div>
  )
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
      }, 100)
      return () => clearInterval(interval)
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
        {dateElement}
        {timestampElement}
        <div className="entry-text">{entry.text}</div>
      </div>
    )
  }

  return (
    <div className="entry">
      {dateElement}
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
  const [dateFormatIndex, cycleDateFormat] = useFormatPreference('dateFormat', 0)
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
      {entries.map((entry, index) => {
        const previousEntry = index > 0 ? entries[index - 1] : null
        const previousEntryDate = previousEntry ? getEntryDate(previousEntry) : null
        return (
          <Entry
            key={entry.id}
            entry={entry}
            onCommit={handleCommit}
            onInputChange={handleInputChange}
            previousEntryDate={previousEntryDate}
            dateFormatIndex={dateFormatIndex}
            timeFormatIndex={timeFormatIndex}
            cycleDateFormat={cycleDateFormat}
            cycleTimeFormat={cycleTimeFormat}
          />
        )
      })}
    </div>
  )
}

export default App

