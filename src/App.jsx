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

function useFontSize() {
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('fontSize')
    return saved ? parseFloat(saved) : 14
  })

  useEffect(() => {
    localStorage.setItem('fontSize', fontSize.toString())
  }, [fontSize])

  // Calculate line spacing multiplier proportionally
  // 4 is to 14px what x is to fontSize
  // So: spacingMultiplier = fontSize * (4/14)
  const spacingMultiplier = fontSize * (4 / 14)

  return [fontSize, setFontSize, spacingMultiplier]
}

function VersionSwitcher({ version, setVersion }) {
  const versions = ['v1', 'v2', 'v3']
  
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

function FontSizeSlider({ fontSize, setFontSize }) {
  const sliderRef = useRef(null)
  const isDraggingRef = useRef(false)
  const minSize = 14
  const maxSize = 24

  const handleMouseDown = (e) => {
    isDraggingRef.current = true
    handleMove(e)
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleTouchStart = (e) => {
    isDraggingRef.current = true
    handleMove(e.touches[0])
    document.addEventListener('touchmove', handleTouchMove)
    document.addEventListener('touchend', handleTouchEnd)
  }

  const handleMove = (e) => {
    if (!isDraggingRef.current || !sliderRef.current) return
    
    const rect = sliderRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, x / rect.width))
    const newSize = minSize + (maxSize - minSize) * percentage
    setFontSize(newSize)
  }

  const handleTouchMove = (e) => {
    if (e.touches.length > 0) {
      handleMove(e.touches[0])
    }
  }

  const handleMouseUp = () => {
    isDraggingRef.current = false
    document.removeEventListener('mousemove', handleMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  const handleTouchEnd = () => {
    isDraggingRef.current = false
    document.removeEventListener('touchmove', handleTouchMove)
    document.removeEventListener('touchend', handleTouchEnd)
  }

  const percentage = ((fontSize - minSize) / (maxSize - minSize)) * 100

  return (
    <div className="font-size-slider-container">
      <div
        ref={sliderRef}
        className="font-size-slider"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="slider-track">
          <div
            className="slider-fill"
            style={{ width: `${percentage}%` }}
          />
          <div
            className="slider-thumb"
            style={{ left: `${percentage}%` }}
          />
        </div>
      </div>
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

function Entry({ entry, onCommit, onInputChange, onTyping, timeFormatIndex, cycleTimeFormat, activeInputRef, shouldFade, placeholder, version, lastCommitTimeRef, onFontWidthChange, fontSize, spacingMultiplier }) {
  const textareaRef = useRef(null)
  const contentEditableRef = useRef(null)
  const [isFocused, setIsFocused] = useState(false)
  const [currentPauseDuration, setCurrentPauseDuration] = useState(0)
  const keystrokeTimesRef = useRef([])
  const lastKeystrokeTimeRef = useRef(null)
  const [fontWidth, setFontWidth] = useState(() => 87.5) // Start at middle (between 25 and 150)
  
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
    <div 
      className={`timestamp clickable ${fadeClass}`} 
      onClick={cycleTimeFormat} 
      title="Click to change time format"
      style={{ fontSize: `${fontSize}px`, lineHeight: `${fontSize + spacingMultiplier}px` }}
    >
      {timestamp}
    </div>
  )

  // Update pause duration in real-time for v2 and v3 when entry is active and empty
  useEffect(() => {
    if (version !== 'v2' && version !== 'v3') {
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

  // Calculate spacing for v2 and v3 based on pause duration
  // Linear growth - converts milliseconds to seconds, then multiplies by constant
  const spacingStyle = (version === 'v2' || version === 'v3') && currentPauseDuration > 0 && entry.id > 0 ? {
    marginTop: `${(currentPauseDuration / 1000) * 4}px`,
    transition: 'margin-top 0.1s ease-out'
  } : (version === 'v2' || version === 'v3') && entry.id === 0 ? {
    marginTop: '0px'
  } : {}
  
  // Render text with per-character widths for v3 committed entries
  const renderTextWithWidths = () => {
    if (version !== 'v3' || !entry.committed || !entry.characterWidths || entry.characterWidths.length === 0) {
      return entry.text
    }
    
    return entry.text.split('').map((char, index) => {
      const width = entry.characterWidths[index] || 87.5
      return (
        <span
          key={index}
          style={{
            fontVariationSettings: `'wdth' ${width}`,
            fontStretch: `${width}%`
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      )
    })
  }
  
  // For active v3 entries, we'll use contenteditable with spans
  const renderActiveTextWithWidths = () => {
    if (version !== 'v3' || entry.committed) {
      return null
    }
    
    if (!entry.characterWidths || entry.characterWidths.length === 0 || entry.text.length === 0) {
      return null
    }
    
    return entry.text.split('').map((char, index) => {
      const width = entry.characterWidths[index] || 87.5
      const span = document.createElement('span')
      span.style.fontVariationSettings = `'wdth' ${width}`
      span.style.fontStretch = `${width}%`
      span.textContent = char === ' ' ? '\u00A0' : char
      return span
    })
  }

  // Reset font width tracking when entry becomes inactive
  useEffect(() => {
    if (!entry.isActive && version === 'v3') {
      keystrokeTimesRef.current = []
      lastKeystrokeTimeRef.current = null
      setFontWidth(87.5)
    }
  }, [entry.isActive, version])
  
  // Update contenteditable content for v3 while preserving cursor
  useEffect(() => {
    if (version === 'v3' && contentEditableRef.current && entry.isActive && !entry.committed) {
      // Save cursor position
      const selection = window.getSelection()
      let cursorOffset = entry.text.length
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const div = contentEditableRef.current
        let offset = 0
        const walker = document.createTreeWalker(
          div,
          NodeFilter.SHOW_TEXT,
          null
        )
        let node
        while ((node = walker.nextNode())) {
          if (node === range.startContainer) {
            offset += range.startOffset
            break
          }
          offset += node.textContent.length
        }
        cursorOffset = offset
      }
      
      // Rebuild content with spans
      if (entry.characterWidths && entry.characterWidths.length > 0 && entry.text.length > 0) {
        const fragment = document.createDocumentFragment()
        entry.text.split('').forEach((char, index) => {
          const width = entry.characterWidths[index] || 87.5
          const span = document.createElement('span')
          span.style.fontVariationSettings = `'wdth' ${width}`
          span.style.fontStretch = `${width}%`
          span.textContent = char === ' ' ? '\u00A0' : char
          fragment.appendChild(span)
        })
        
        contentEditableRef.current.innerHTML = ''
        contentEditableRef.current.appendChild(fragment)
        
        // Restore cursor position
        if (cursorOffset <= entry.text.length) {
          const walker = document.createTreeWalker(
            contentEditableRef.current,
            NodeFilter.SHOW_TEXT,
            null
          )
          let offset = 0
          let node
          while ((node = walker.nextNode()) && offset + node.textContent.length < cursorOffset) {
            offset += node.textContent.length
          }
          if (node) {
            const range = document.createRange()
            const newOffset = Math.min(cursorOffset - offset, node.textContent.length)
            range.setStart(node, newOffset)
            range.setEnd(node, newOffset)
            selection.removeAllRanges()
            selection.addRange(range)
          }
        }
      } else if (entry.text.length === 0) {
        contentEditableRef.current.innerHTML = ''
      }
    }
  }, [entry.text, entry.characterWidths, version, entry.isActive, entry.committed])

  useEffect(() => {
    const inputElement = version === 'v3' ? contentEditableRef.current : textareaRef.current
    
    if (entry.isActive && inputElement) {
      // Update the active input ref for App component
      if (activeInputRef) {
        activeInputRef.current = inputElement
      }
      
      // Immediate focus when entry becomes active
      inputElement.focus()
      setIsFocused(true)
      
      // Keep it focused with interval
      const interval = setInterval(() => {
        if (inputElement && document.activeElement !== inputElement) {
          inputElement.focus()
          setIsFocused(true)
        }
      }, 50)
      
      // Also refocus on blur
      const handleBlurRefocus = () => {
        if (inputElement) {
          // Use setTimeout to ensure focus happens after any other event handlers
          setTimeout(() => {
            if (inputElement && entry.isActive) {
              inputElement.focus()
              setIsFocused(true)
            }
          }, 0)
        }
      }
      
      inputElement.addEventListener('blur', handleBlurRefocus)
      
      return () => {
        clearInterval(interval)
        inputElement.removeEventListener('blur', handleBlurRefocus)
        if (activeInputRef && activeInputRef.current === inputElement) {
          activeInputRef.current = null
        }
      }
    } else if (!entry.isActive) {
      setIsFocused(false)
    }
  }, [entry.isActive, activeInputRef, version])
  

  const handleInput = (e) => {
    const now = Date.now()
    let newText
    let selectionStart
    
    if (version === 'v3' && e.target.contentEditable === 'true') {
      // ContentEditable div - get text from all text nodes
      const div = e.target
      newText = div.textContent || div.innerText || ''
      const selection = window.getSelection()
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        // Calculate cursor position by counting characters before cursor
        let offset = 0
        const walker = document.createTreeWalker(
          div,
          NodeFilter.SHOW_TEXT,
          null
        )
        let node
        while ((node = walker.nextNode())) {
          if (node === range.startContainer) {
            offset += range.startOffset
            break
          }
          offset += node.textContent.length
        }
        selectionStart = offset
      } else {
        selectionStart = newText.length
      }
    } else {
      // Textarea
      newText = e.target.value
      selectionStart = e.target.selectionStart
    }
    
    // Track typing speed for v3 - calculate width for each new character
    if (version === 'v3' && entry.isActive) {
      const oldLength = entry.text.length
      const newLength = newText.length
      const newCharacterWidths = [...(entry.characterWidths || [])]
      
      if (newLength > oldLength) {
        // Characters were added
        const addedChars = newLength - oldLength
        
        // Calculate width based on time since last keystroke
        let width = 87.5 // Default to middle
        
        if (lastKeystrokeTimeRef.current !== null) {
          const interval = now - lastKeystrokeTimeRef.current
          
          // Map typing speed to font width
          // Fast typing (low interval) → narrow (25)
          // Slow typing (high interval) → wide (150)
          const minInterval = 75   // Very fast typing (75ms between chars)
          const maxInterval = 200  // Slow typing (200ms between chars)
          const clampedInterval = Math.max(minInterval, Math.min(maxInterval, interval))
          
          // Inverse mapping: fast = narrow, slow = wide
          const normalized = (clampedInterval - minInterval) / (maxInterval - minInterval)
          width = 25 + (normalized * 125) // Range from 25 (narrow) to 150 (wide)
        }
        
        // Insert width for each new character at the cursor position
        // For simplicity, if we can't determine exact position, append to end
        const insertPos = Math.min(selectionStart, newCharacterWidths.length)
        for (let i = 0; i < addedChars; i++) {
          newCharacterWidths.splice(insertPos + i, 0, width)
        }
        
        lastKeystrokeTimeRef.current = now
        setFontWidth(width)
      } else if (newLength < oldLength) {
        // Characters were deleted
        const deletedCount = oldLength - newLength
        // Remove widths at cursor position or from end
        const deletePos = Math.min(selectionStart, newCharacterWidths.length)
        newCharacterWidths.splice(deletePos, deletedCount)
        lastKeystrokeTimeRef.current = null
        setFontWidth(87.5) // Reset to middle
      } else {
        // Text might have been replaced or modified, sync widths array
        if (newCharacterWidths.length !== newLength) {
          // Adjust array to match text length
          while (newCharacterWidths.length < newLength) {
            newCharacterWidths.push(87.5)
          }
          while (newCharacterWidths.length > newLength) {
            newCharacterWidths.pop()
          }
        }
      }
      
      onInputChange(entry.id, newText, newCharacterWidths, selectionStart)
    } else {
      onInputChange(entry.id, newText, entry.characterWidths, selectionStart)
    }
    
    // Track typing activity (not Enter key)
    if (onTyping) {
      onTyping()
    }
    
    // Auto-resize for textarea
    if (e.target.tagName === 'TEXTAREA') {
      const textarea = e.target
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      
      let currentLine = ''
      
      if (version === 'v3' && e.target.contentEditable === 'true') {
        // For v3 contenteditable, get text before cursor
        const div = e.target
        const selection = window.getSelection()
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)
          // Get all text before cursor
          const textBeforeCursor = div.textContent.substring(0, range.startOffset)
          currentLine = textBeforeCursor.split('\n').pop() || ''
        }
      } else {
        // For v1 and v2 textarea
        const textarea = e.target
        const textBeforeCursor = textarea.value.substring(0, textarea.selectionStart)
        currentLine = textBeforeCursor.split('\n').pop() || ''
      }
      
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

  // Combine spacing styles
  const combinedStyle = { ...spacingStyle }

  if (entry.committed) {
    return (
      <div className="entry">
        {version === 'v1' && timestampElement(fadeClass)}
        <div className={`entry-text ${fadeClass}`} style={{ ...combinedStyle, fontSize: `${fontSize}px`, lineHeight: `${fontSize + spacingMultiplier}px` }}>
          {version === 'v3' ? renderTextWithWidths() : entry.text}
        </div>
      </div>
    )
  }

  // For v3, use contenteditable div to allow per-character styling
  if (version === 'v3') {
    return (
      <div className="entry">
        <div
          ref={contentEditableRef}
          className="entry-input entry-input-contenteditable"
          style={{ ...combinedStyle, fontSize: `${fontSize}px`, lineHeight: `${fontSize + spacingMultiplier}px` }}
          contentEditable="true"
          suppressContentEditableWarning={true}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          data-placeholder={entry.isActive && !isFocused && entry.text === "" ? placeholder : ""}
        />
      </div>
    )
  }

  // For v1 and v2, use textarea
  return (
    <div className="entry">
      {version === 'v1' && timestampElement()}
      <textarea
        ref={textareaRef}
        className="entry-input"
        style={{ ...combinedStyle, fontSize: `${fontSize}px`, lineHeight: `${fontSize + spacingMultiplier}px` }}
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
  const [fontSize, setFontSize, spacingMultiplier] = useFontSize()
  const [timeFormatIndex, cycleTimeFormat] = useFormatPreference('timeFormat', 0)
  const [entries, setEntries] = useState([
    { id: 0, text: '', isActive: true, committed: false, frozen: false, frozenAt: null, startedAt: null, pauseDuration: null, fontWidth: null, characterWidths: [] }
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

  const handleFontWidthChange = (id, width) => {
    setEntries(prev => prev.map(entry => {
      if (entry.id === id) {
        return { ...entry, fontWidth: width }
      }
      return entry
    }))
  }

  const handleInputChange = (id, text, characterWidths = null, selectionStart = null) => {
    const now = Date.now()
    setEntries(prev => prev.map(entry => {
      if (entry.id === id) {
        const updated = { ...entry, text }
        
        // Update character widths if provided (for v3)
        if (characterWidths !== null && version === 'v3') {
          updated.characterWidths = characterWidths
        }
        
        // Record when typing starts (first character) for v2 and v3
        if (!entry.startedAt && text.length > 0 && (version === 'v2' || version === 'v3')) {
          updated.startedAt = now
          // Store the pause duration at the moment typing starts
          if (lastCommitTimeRef.current) {
            updated.pauseDuration = now - lastCommitTimeRef.current
          }
        }
        
        // Reset startedAt and pauseDuration if text is cleared, so spacing can grow again
        if (entry.startedAt && text.length === 0 && (version === 'v2' || version === 'v3')) {
          updated.startedAt = null
          updated.pauseDuration = null
          updated.characterWidths = []
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
          // Store character widths for v3
          return { ...entry, committed: true, isActive: false, pauseDuration: pauseDuration || 0, characterWidths: entry.characterWidths || [] }
        }
        return { ...entry, isActive: false }
      })
      
      const newId = prev.length
      lastCommitTimeRef.current = now
      return [...updated, { id: newId, text: '', isActive: true, committed: false, frozen: false, frozenAt: null, startedAt: null, pauseDuration: null, fontWidth: null, characterWidths: [] }]
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
      <div className="top-controls">
        <VersionSwitcher version={version} setVersion={setVersion} />
        <FontSizeSlider fontSize={fontSize} setFontSize={setFontSize} />
      </div>
      <div className="container" data-version={version} ref={containerRef} onClick={handleContainerClick} onTouchStart={handleContainerClick} style={{ '--font-size': `${fontSize}px` }}>
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
              onFontWidthChange={version === 'v3' ? handleFontWidthChange : undefined}
              fontSize={fontSize}
              spacingMultiplier={spacingMultiplier}
            />
          )
        })}
      </div>
    </>
  )
}

export default App

