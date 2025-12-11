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

function Entry({ entry, onCommit, onInputChange, onTyping, timeFormatIndex, cycleTimeFormat, activeInputRef, shouldFade }) {
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

  const timestampElement = (fadeClass = '') => (
    <div className={`timestamp clickable ${fadeClass}`} onClick={cycleTimeFormat} title="Click to change time format">
      {timestamp}
    </div>
  )

  useEffect(() => {
    if (entry.isActive && textareaRef.current) {
      // Update the active input ref for App component
      if (activeInputRef) {
        activeInputRef.current = textareaRef.current
      }
      
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
        if (activeInputRef && activeInputRef.current === textareaRef.current) {
          activeInputRef.current = null
        }
      }
    }
  }, [entry.isActive, activeInputRef])

  const handleInput = (e) => {
    onInputChange(entry.id, e.target.value)
    
    // Track typing activity (not Enter key)
    if (onTyping) {
      onTyping()
    }
    
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

  const fadeClass = shouldFade ? 'faded' : ''

  if (entry.committed) {
    return (
      <div className="entry">
        {timestampElement(fadeClass)}
        <div className={`entry-text ${fadeClass}`}>{entry.text}</div>
      </div>
    )
  }

  return (
    <div className="entry">
      {timestampElement()}
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
  const containerRef = useRef(null)
  const activeInputRef = useRef(null)

  // Focus active input on first touch/click anywhere on the page (for mobile keyboard)
  useEffect(() => {
    const handleFirstInteraction = (e) => {
      if (activeInputRef.current) {
        activeInputRef.current.focus()
        // Remove listeners after first interaction
        document.removeEventListener('touchstart', handleFirstInteraction, true)
        document.removeEventListener('click', handleFirstInteraction, true)
      }
    }

    document.addEventListener('touchstart', handleFirstInteraction, true)
    document.addEventListener('click', handleFirstInteraction, true)

    return () => {
      document.removeEventListener('touchstart', handleFirstInteraction, true)
      document.removeEventListener('click', handleFirstInteraction, true)
    }
  }, [])

  const [shouldFadeOthers, setShouldFadeOthers] = useState(false)
  const typingTimeoutRef = useRef(null)

  const handleTyping = () => {
    // Fade out other entries when typing starts
    setShouldFadeOthers(true)
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    // Set timeout to fade back in after stopping typing
    typingTimeoutRef.current = setTimeout(() => {
      setShouldFadeOthers(false)
    }, 2000) // 2 seconds after stopping typing
  }

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

    // If text is cleared, immediately fade back in
    if (text.length === 0) {
      setShouldFadeOthers(false)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  const handleContainerClick = (e) => {
    // If clicking on container (not on a specific element), focus the active input
    if (e.target === containerRef.current || e.target.classList.contains('container')) {
      if (activeInputRef.current) {
        activeInputRef.current.focus()
      }
    }
  }

  return (
    <div className="container" ref={containerRef} onClick={handleContainerClick} onTouchStart={handleContainerClick}>
      {entries.map((entry) => {
        return (
          <Entry
            key={entry.id}
            entry={entry}
            onCommit={handleCommit}
            onInputChange={handleInputChange}
            onTyping={entry.isActive ? handleTyping : undefined}
            timeFormatIndex={timeFormatIndex}
            cycleTimeFormat={cycleTimeFormat}
            activeInputRef={activeInputRef}
            shouldFade={shouldFadeOthers && !entry.isActive}
          />
        )
      })}
    </div>
  )
}

export default App

