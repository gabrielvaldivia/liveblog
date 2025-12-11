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

function useVersion() {
  const [version, setVersion] = useState(() => {
    const saved = localStorage.getItem('version')
    return saved || 'v1'
  })

  useEffect(() => {
    localStorage.setItem('version', version)
  }, [version])

  return [version, setVersion]
}

function VersionSwitcher({ version, setVersion }) {
  const versions = ['v1', 'v2']
  
  return (
    <div className="version-switcher">
      {versions.map((v) => (
        <button
          key={v}
          className={`version-btn ${version === v ? 'active' : ''}`}
          onClick={() => setVersion(v)}
        >
          {v}
        </button>
      ))}
    </div>
  )
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

function Entry({ entry, onCommit, onInputChange, onTyping, timeFormatIndex, cycleTimeFormat, activeInputRef, shouldFade, placeholder, version, lastCommitTimeRef }) {
  const textareaRef = useRef(null)
  const [isFocused, setIsFocused] = useState(false)
  const [currentPauseDuration, setCurrentPauseDuration] = useState(0)
  
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

  // Update pause duration in real-time for v2 when entry is active and empty
  useEffect(() => {
    if (version !== 'v2') {
      setCurrentPauseDuration(0)
      return
    }
    
    if (entry.id === 0) {
      setCurrentPauseDuration(0)
      return
    }
    
    // For committed entries, use the stored pauseDuration if available
    if (entry.committed) {
      if (entry.pauseDuration !== null && entry.pauseDuration !== undefined) {
        setCurrentPauseDuration(entry.pauseDuration)
      } else {
        setCurrentPauseDuration(0)
      }
      return
    }
    
    // If typing has started, freeze the pause duration
    if (entry.text.length > 0 && entry.startedAt && lastCommitTimeRef.current) {
      const elapsed = entry.startedAt - lastCommitTimeRef.current
      setCurrentPauseDuration(elapsed)
      return
    }
    
    // For active entries with no text yet, update pause duration in real-time
    if (entry.isActive && entry.text.length === 0 && lastCommitTimeRef.current) {
      const updatePause = () => {
        const elapsed = Date.now() - lastCommitTimeRef.current
        setCurrentPauseDuration(Math.max(0, elapsed))
      }
      
      // Update immediately
      updatePause()
      
      // Update every 50ms for smooth animation
      const interval = setInterval(updatePause, 50)
      return () => clearInterval(interval)
    }
  }, [version, entry.isActive, entry.text.length, entry.id, entry.startedAt, entry.committed, entry.pauseDuration, lastCommitTimeRef])

  // Calculate spacing for v2 based on pause duration
  // Linear growth - converts milliseconds to seconds, then multiplies by constant
  const spacingStyle = version === 'v2' && currentPauseDuration > 0 && entry.id > 0 ? {
    marginTop: `${(currentPauseDuration / 1000) * 4}px`,
    transition: 'margin-top 0.1s ease-out'
  } : version === 'v2' && entry.id === 0 ? {
    marginTop: '0px'
  } : {}

  useEffect(() => {
    if (entry.isActive && textareaRef.current) {
      // Update the active input ref for App component
      if (activeInputRef) {
        activeInputRef.current = textareaRef.current
      }
      
      // Immediate focus when entry becomes active
      textareaRef.current.focus()
      setIsFocused(true)
      
      // Keep it focused with interval
      const interval = setInterval(() => {
        if (textareaRef.current && document.activeElement !== textareaRef.current) {
          textareaRef.current.focus()
          setIsFocused(true)
        }
      }, 50)
      
      // Also refocus on blur
      const handleBlurRefocus = () => {
        if (textareaRef.current) {
          // Use setTimeout to ensure focus happens after any other event handlers
          setTimeout(() => {
            if (textareaRef.current && entry.isActive) {
              textareaRef.current.focus()
              setIsFocused(true)
            }
          }, 0)
        }
      }
      
      const textarea = textareaRef.current
      textarea.addEventListener('blur', handleBlurRefocus)
      
      return () => {
        clearInterval(interval)
        textarea.removeEventListener('blur', handleBlurRefocus)
        if (activeInputRef && activeInputRef.current === textareaRef.current) {
          activeInputRef.current = null
        }
      }
    } else if (!entry.isActive) {
      setIsFocused(false)
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

  const handleFocus = () => {
    setIsFocused(true)
  }

  const handleBlur = (e) => {
    // Only set focused to false if we're not immediately refocusing
    if (entry.isActive) {
      // Delay to check if we're refocusing
      setTimeout(() => {
        if (textareaRef.current && document.activeElement !== textareaRef.current) {
          setIsFocused(false)
        }
      }, 100)
    } else {
      setIsFocused(false)
    }
  }

  const fadeClass = version === 'v1' && shouldFade ? 'faded' : ''

  if (entry.committed) {
    return (
      <div className="entry">
        {version === 'v1' && timestampElement(fadeClass)}
        <div className={`entry-text ${fadeClass}`} style={spacingStyle}>{entry.text}</div>
      </div>
    )
  }

  return (
    <div className="entry">
      {version === 'v1' && timestampElement()}
      <textarea
        ref={textareaRef}
        className="entry-input"
        style={spacingStyle}
        value={entry.text}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        autoFocus={entry.isActive}
        placeholder={entry.isActive && !isFocused && entry.text === "" ? placeholder : ""}
        rows={1}
        cols={100}
      />
    </div>
  )
}

function App() {
  useTheme()
  const [version, setVersion] = useVersion()
  const [timeFormatIndex, cycleTimeFormat] = useFormatPreference('timeFormat', 0)
  const [entries, setEntries] = useState([
    { id: 0, text: '', isActive: true, committed: false, frozen: false, frozenAt: null, startedAt: null, pauseDuration: null }
  ])
  const containerRef = useRef(null)
  const activeInputRef = useRef(null)
  const lastCommitTimeRef = useRef(null)
  
  // Detect if device is mobile (touch device)
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  const placeholderText = isMobile ? "tap to write..." : "start writing..."

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
    // Only fade out other entries in v1
    if (version === 'v1') {
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
  }

  const handleInputChange = (id, text) => {
    const now = Date.now()
    setEntries(prev => prev.map(entry => {
      if (entry.id === id) {
        const updated = { ...entry, text }
        
        // Record when typing starts (first character) for v2
        if (!entry.startedAt && text.length > 0 && version === 'v2') {
          updated.startedAt = now
          // Store the pause duration at the moment typing starts
          if (lastCommitTimeRef.current) {
            updated.pauseDuration = now - lastCommitTimeRef.current
          }
        }
        
        // Reset startedAt and pauseDuration if text is cleared, so spacing can grow again
        if (entry.startedAt && text.length === 0 && version === 'v2') {
          updated.startedAt = null
          updated.pauseDuration = null
        }
        
        if (!entry.frozen && text.length > 0) {
          updated.frozen = true
          updated.frozenAt = new Date()
        }
        return updated
      }
      return entry
    }))

    // If text is cleared, immediately fade back in (v1 only)
    if (text.length === 0 && version === 'v1') {
      setShouldFadeOthers(false)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }

  const handleCommit = (id) => {
    const now = Date.now()
    
    setEntries(prev => {
      const updated = prev.map(entry => {
        if (entry.id === id) {
          // Store the pause duration when committing
          let pauseDuration = entry.pauseDuration
          if (!pauseDuration && entry.startedAt && lastCommitTimeRef.current) {
            pauseDuration = entry.startedAt - lastCommitTimeRef.current
          }
          return { ...entry, committed: true, isActive: false, pauseDuration: pauseDuration || 0 }
        }
        return { ...entry, isActive: false }
      })
      
      const newId = prev.length
      lastCommitTimeRef.current = now
      return [...updated, { id: newId, text: '', isActive: true, committed: false, frozen: false, frozenAt: null, startedAt: null, pauseDuration: null }]
    })
  }

  // Initialize last commit time on mount
  useEffect(() => {
    lastCommitTimeRef.current = Date.now()
  }, [])

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
    <>
      <VersionSwitcher version={version} setVersion={setVersion} />
      <div className="container" data-version={version} ref={containerRef} onClick={handleContainerClick} onTouchStart={handleContainerClick}>
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
              shouldFade={version === 'v1' && shouldFadeOthers && !entry.isActive}
              placeholder={placeholderText}
              version={version}
              lastCommitTimeRef={lastCommitTimeRef}
            />
          )
        })}
      </div>
    </>
  )
}

export default App

