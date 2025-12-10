import { useState, useEffect, useRef } from 'react'

const dateFormats = [
  (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },
  (date) => {
    const year = String(date.getFullYear()).slice(-2)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },
  (date) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
  },
  (date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
  },
  (date) => {
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const year = date.getFullYear()
    return `${month}/${day}/${year}`
  },
  (date) => {
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
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
    const h = String(date.getHours()).padStart(2, '0')
    const m = String(date.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
  },
  (date) => {
    let hours = date.getHours()
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12
    hours = hours ? hours : 12
    return `${hours}:${minutes}:${seconds} ${ampm}`
  },
  (date) => {
    let hours = date.getHours()
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12
    hours = hours ? hours : 12
    return `${hours}:${minutes} ${ampm}`
  }
]

function useFormatPreference(key, defaultIndex) {
  const [formatIndex, setFormatIndex] = useState(() => {
    const saved = localStorage.getItem(key)
    return saved ? parseInt(saved, 10) : defaultIndex
  })

  useEffect(() => {
    localStorage.setItem(key, formatIndex.toString())
  }, [formatIndex, key])

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
  
  const getInitialDate = () => {
    return dateFormats[dateFormatIndex](new Date())
  }
  
  const getInitialTime = () => {
    return timeFormats[timeFormatIndex](new Date())
  }
  
  const [timestamp, setTimestamp] = useState(getInitialTime)
  const [date, setDate] = useState(getInitialDate)

  // Get the date to use for this entry (for comparison purposes)
  const getEntryDate = () => {
    if (entry.committed && entry.frozenAt) {
      return entry.frozenAt
    }
    if (entry.frozen && entry.frozenAt) {
      return entry.frozenAt
    }
    // For active entries, use current date
    return new Date()
  }

  useEffect(() => {
    const updateFormats = (dateObj) => {
      setTimestamp(timeFormats[timeFormatIndex](dateObj))
      setDate(dateFormats[dateFormatIndex](dateObj))
    }

    if (entry.committed && entry.frozenAt) {
      updateFormats(entry.frozenAt)
      return
    }

    if (entry.isActive && !entry.frozen) {
      updateFormats(new Date())
      const interval = setInterval(() => {
        updateFormats(new Date())
      }, 250)
      return () => clearInterval(interval)
    } else if (entry.frozen && entry.frozenAt) {
      updateFormats(entry.frozenAt)
    }
  }, [entry.isActive, entry.frozen, entry.frozenAt, entry.committed, dateFormatIndex, timeFormatIndex])

  const entryDate = getEntryDate()
  const shouldShowDate = !previousEntryDate || !isSameDay(entryDate, previousEntryDate)

  useEffect(() => {
    if (entry.isActive && textareaRef.current) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [entry.isActive])

  useEffect(() => {
    if (textareaRef.current && entry.isActive) {
      const textarea = textareaRef.current
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [entry.text, entry.isActive])

  const handleInput = (e) => {
    const value = e.target.value
    onInputChange(entry.id, value)
    
    // Auto-resize - reset height first, then set to scrollHeight
    const textarea = e.target
    textarea.style.height = 'auto'
    const newHeight = textarea.scrollHeight
    textarea.style.height = `${newHeight}px`
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onCommit(entry.id)
    }
    // Shift+Enter will create a new line (default behavior)
    // The handleInput will handle the resize
  }

  if (entry.committed) {
    return (
      <div className="entry">
        <div className="date clickable" onClick={cycleDateFormat} title="Click to change date format">
          {shouldShowDate ? date : '\u00A0'}
        </div>
        <div className="timestamp clickable" onClick={cycleTimeFormat} title="Click to change time format">
          {timestamp}
        </div>
        <div className="entry-text">{entry.text}</div>
      </div>
    )
  }

  return (
    <div className="entry">
      <div className="date clickable" onClick={cycleDateFormat} title="Click to change date format">
        {shouldShowDate ? date : '\u00A0'}
      </div>
      <div className="timestamp clickable" onClick={cycleTimeFormat} title="Click to change time format">
        {timestamp}
      </div>
      <textarea
        ref={textareaRef}
        className="entry-input"
        value={entry.text}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        autoFocus={entry.isActive}
        rows={1}
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
        let previousEntryDate = null
        if (previousEntry) {
          if (previousEntry.committed && previousEntry.frozenAt) {
            previousEntryDate = previousEntry.frozenAt
          } else if (previousEntry.frozen && previousEntry.frozenAt) {
            previousEntryDate = previousEntry.frozenAt
          }
        }
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

