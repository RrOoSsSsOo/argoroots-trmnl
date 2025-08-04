/**
 * TRMNL Family Calendar Plugin - iCal Parser
 * 
 * A comprehensive RFC 5545 compliant iCal (.ics) parser for TRMNL e-paper displays.
 * Supports recurring events (RRULE), exception dates (EXDATE), recurrence exceptions (RECURRENCE-ID),
 * timezone conversion, and filters to show the next 25 upcoming events.
 * 
 * Features:
 * - Full iCal format support with line unfolding
 * - RRULE parsing for DAILY, WEEKLY, MONTHLY, YEARLY frequencies
 * - EXDATE handling with timezone conversion
 * - RECURRENCE-ID support for modified recurring event instances  
 * - Two-pass parsing architecture for proper exception handling
 * - Automatic deleted/cancelled event detection
 * - Timezone support (IANA identifiers and GMT offsets)
 * - All-day and timed event support
 */

async function main (args) {
  if (!args.url) return { body: 'No URL provided' }

  const response = await fetch(args.url)

  if (!response.ok) return { body: `Error fetching data: ${response.statusText}` }

  const events = parseICS(await response.text())

  // Filter and sort events
  const filteredEvents = filterAndSortEvents(events)

  return {
    body: filteredEvents
  }
}

function parseICS (icsData) {
  const unfoldedLines = unfoldICSLines(icsData)
  const { mainEvents, recurrenceExceptions } = parseEventsFromLines(unfoldedLines)
  
  const events = []
  
  // Process main events with their recurrence exceptions
  mainEvents.forEach(({ event, timezones }) => {
    if (isEventDeleted(event)) {
      return
    }

    if (event.RRULE) {
      const uid = event.UID
      const exceptions = recurrenceExceptions.get(uid) || []
      const recurringEvents = generateRecurringEvents(event, timezones, exceptions)
      events.push(...recurringEvents)
    } else {
      const singleEvent = createEventFromData(event, timezones)
      if (singleEvent) {
        events.push(singleEvent)
      }
    }
  })

  return events
}

function unfoldICSLines (icsData) {
  const lines = icsData.split('\n')
  const unfoldedLines = []
  let currentLine = ''

  lines.forEach((line) => {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      // This is a continuation of the previous line
      currentLine += line.substring(1)
    } else {
      if (currentLine) {
        unfoldedLines.push(currentLine)
      }
      currentLine = line.trim()
    }
  })
  
  if (currentLine) {
    unfoldedLines.push(currentLine)
  }

  return unfoldedLines
}

function parseEventsFromLines (unfoldedLines) {
  const recurrenceExceptions = new Map()
  const mainEvents = []
  let currentEvent = null
  let currentTimezones = {}
  let currentEventLines = []

  unfoldedLines.forEach((line) => {
    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = {}
      currentTimezones = {}
      currentEventLines = [line]
    } else if (line.startsWith('END:VEVENT')) {
      currentEventLines.push(line)

      if (currentEvent) {
        const eventData = {
          event: currentEvent,
          timezones: { ...currentTimezones },
          lines: [...currentEventLines]
        }

        if (currentEvent['RECURRENCE-ID']) {
          // This is a recurrence exception
          const uid = currentEvent.UID
          if (uid) {
            if (!recurrenceExceptions.has(uid)) {
              recurrenceExceptions.set(uid, [])
            }
            recurrenceExceptions.get(uid).push(eventData)
          }
        } else {
          // This is a main event
          mainEvents.push(eventData)
        }
        
        currentEvent = null
        currentTimezones = {}
        currentEventLines = []
      }
    } else if (currentEvent) {
      currentEventLines.push(line)
      parseEventProperty(line, currentEvent, currentTimezones)
    }
  })

  return { mainEvents, recurrenceExceptions }
}

function parseEventProperty (line, currentEvent, currentTimezones) {
  const colonIndex = line.indexOf(':')
  if (colonIndex <= 0) return

  const key = line.substring(0, colonIndex).trim()
  const value = line.substring(colonIndex + 1).trim()
  const baseKey = key.split(';')[0]

  // Handle properties that can have multiple values
  if (['EXDATE', 'RDATE', 'EXRULE'].includes(baseKey)) {
    if (!currentEvent[baseKey]) {
      currentEvent[baseKey] = []
    }
    currentEvent[baseKey].push(value)
  } else {
    currentEvent[baseKey] = value
    // Also store the full key with parameters for potential analysis
    if (key !== baseKey) {
      currentEvent[key] = value
    }
  }

  // Extract timezone if present
  if (key.includes('TZID=')) {
    const tzidMatch = key.match(/TZID=([^:;]+)/)
    if (tzidMatch) {
      currentTimezones[baseKey] = tzidMatch[1]
      // Also store timezone for EXDATE entries
      if (baseKey === 'EXDATE') {
        currentTimezones.EXDATE = tzidMatch[1]
      }
    }
  }
}

function createEventFromData (event, timezones) {
  const start = formatDateToISO(event.DTSTART, timezones.DTSTART)
  
  let end = null
  if (event.DTEND) {
    if (event.DTEND.match(/^\d{8}$/)) {
      // This is a full-day event end date, mark it for adjustment
      end = formatDateToISO(event.DTEND, 'FULL_DAY_END')
    } else {
      end = formatDateToISO(event.DTEND, timezones.DTEND)
    }
  }

  const title = cleanString(event.SUMMARY)
  const description = cleanString(event.DESCRIPTION)
  const address = cleanAddress(event.LOCATION)

  // Transform the event to only include required fields (no empty strings)
  const transformedEvent = {}
  if (start) transformedEvent.start = start
  if (end) transformedEvent.end = end
  if (title) transformedEvent.title = title
  if (description) transformedEvent.description = description
  if (address) transformedEvent.address = address

  // Only return event if it has at least a start time
  return transformedEvent.start ? transformedEvent : null
}

function isEventDeleted (event) {
  // Check STATUS field for CANCELLED
  if (event.STATUS && event.STATUS.toUpperCase() === 'CANCELLED') {
    return true
  }

  // Check METHOD field for CANCEL
  if (event.METHOD && event.METHOD.toUpperCase() === 'CANCEL') {
    return true
  }

  // Check if SEQUENCE is very high (often indicates deletion/cancellation)
  if (event.SEQUENCE && parseInt(event.SEQUENCE) > 100) {
    return true
  }

  // Check TRANSP (transparency) - TRANSPARENT events might be considered "deleted" in some contexts
  if (event.TRANSP && event.TRANSP.toUpperCase() === 'TRANSPARENT') {
    // This is less definitive - transparent events are often just "free time"
    // but in some cases might indicate deleted events
    // We'll be conservative and not delete based on this alone
  }

  // Check for Apple-specific deletion markers
  if (event['X-APPLE-DELETED-DATE'] || event['X-APPLE-DELETED']) {
    return true
  }

  // Check for Google-specific deletion markers
  if (event['X-GOOGLE-DELETED'] || event.STATUS === 'DELETED') {
    return true
  }

  // Check if the event has no DTSTART or SUMMARY (might indicate corruption/deletion)
  if (!event.DTSTART && !event.SUMMARY) {
    return true
  }

  return false
}

function generateRecurringEvents (event, timezones, recurrenceExceptions = []) {
  const rrule = event.RRULE
  if (!rrule) return []

  const start = formatDateToISO(event.DTSTART, timezones.DTSTART)
  if (!start) return []

  let end = null
  if (event.DTEND) {
    if (event.DTEND.match(/^\d{8}$/)) {
      end = formatDateToISO(event.DTEND, 'FULL_DAY_END')
    } else {
      end = formatDateToISO(event.DTEND, timezones.DTEND)
    }
  }

  const rruleParams = parseRRule(rrule)
  const exdates = parseExceptionDates(event, timezones)
  const exceptionMap = buildExceptionMap(recurrenceExceptions, timezones)
  
  const eventData = {
    start,
    end,
    title: cleanString(event.SUMMARY),
    description: cleanString(event.DESCRIPTION),
    address: cleanAddress(event.LOCATION)
  }

  return generateOccurrences(eventData, rruleParams, exdates, exceptionMap)
}

function parseRRule (rrule) {
  const params = {}
  rrule.split(';').forEach((param) => {
    const [key, value] = param.split('=')
    if (key && value) {
      params[key] = value
    }
  })

  return {
    freq: params.FREQ,
    until: params.UNTIL,
    count: params.COUNT ? parseInt(params.COUNT) : null,
    interval: params.INTERVAL ? parseInt(params.INTERVAL) : 1,
    byday: params.BYDAY ? params.BYDAY.split(',') : null
  }
}

function parseExceptionDates (event, timezones) {
  const exdates = []
  if (event.EXDATE) {
    event.EXDATE.forEach(exdate => {
      const exdateFormatted = formatDateToISO(exdate, timezones.EXDATE || timezones.DTSTART)
      if (exdateFormatted) {
        exdates.push(exdateFormatted)
      }
    })
  }
  return exdates
}

function buildExceptionMap (recurrenceExceptions, defaultTimezones) {
  const exceptionMap = new Map()
  
  recurrenceExceptions.forEach(exception => {
    const recurrenceId = exception.event['RECURRENCE-ID']
    if (recurrenceId) {
      const recurrenceIdFormatted = formatDateToISO(
        recurrenceId, 
        exception.timezones['RECURRENCE-ID'] || defaultTimezones.DTSTART
      )
      if (recurrenceIdFormatted) {
        exceptionMap.set(recurrenceIdFormatted, exception)
      }
    }
  })
  
  return exceptionMap
}

function generateOccurrences (eventData, rruleParams, exdates, exceptionMap) {
  const events = []
  const { freq, until, count, interval, byday } = rruleParams
  
  if (!freq) return events

  const durationMs = calculateDuration(eventData.start, eventData.end)
  const { currentDate, untilDate, maxOccurrences } = setupDateLimits(eventData.start, until, count)
  
  let occurrenceCount = 0

  while (occurrenceCount < maxOccurrences && currentDate <= new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000)) {
    if (untilDate && currentDate > untilDate) break

    if (shouldIncludeDate(currentDate, freq, byday)) {
      const occurrence = createOccurrence(currentDate, eventData, durationMs, exdates, exceptionMap)
      
      if (occurrence) {
        events.push(occurrence)
        occurrenceCount++
      }
    }

    advanceToNextDate(currentDate, freq, interval, byday)
  }

  return events
}

function calculateDuration (start, end) {
  if (!end || !start) return 0
  return new Date(end).getTime() - new Date(start).getTime()
}

function setupDateLimits (start, until, count) {
  const currentDate = new Date(start)
  let untilDate = null
  
  if (until) {
    if (until.match(/^\d{8}$/)) {
      const year = until.substr(0, 4)
      const month = until.substr(4, 2)
      const day = until.substr(6, 2)
      untilDate = new Date(`${year}-${month}-${day}`)
    } else if (until.match(/^\d{8}T\d{6}Z?$/)) {
      untilDate = new Date(formatDateToISO(until))
    }
  }

  const maxOccurrences = count || 100

  return { currentDate, untilDate, maxOccurrences }
}

function shouldIncludeDate (currentDate, freq, byday) {
  if (!byday || freq !== 'WEEKLY') return true
  
  const dayMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }
  const currentDayOfWeek = currentDate.getDay()
  
  return byday.some((day) => dayMap[day] === currentDayOfWeek)
}

function createOccurrence (currentDate, eventData, durationMs, exdates, exceptionMap) {
  const isAllDayEvent = eventData.start.match(/^\d{4}-\d{2}-\d{2}$/)
  
  let eventStart, eventEnd = null

  if (isAllDayEvent) {
    eventStart = currentDate.toISOString().split('T')[0]
    if (eventData.end) {
      const endDate = new Date(currentDate)
      if (durationMs > 0) {
        endDate.setTime(endDate.getTime() + durationMs)
      }
      eventEnd = endDate.toISOString().split('T')[0]
    }
  } else {
    eventStart = currentDate.toISOString().replace(/\.\d{3}Z$/, 'Z')
    if (durationMs > 0) {
      eventEnd = new Date(currentDate.getTime() + durationMs).toISOString().replace(/\.\d{3}Z$/, 'Z')
    }
  }

  // Check if this date is excluded by EXDATE
  if (isDateExcluded(eventStart, exdates, isAllDayEvent)) {
    return null
  }

  // Check if this occurrence has a recurrence exception
  const hasException = exceptionMap.has(eventStart)

  if (hasException) {
    return createExceptionEvent(exceptionMap.get(eventStart))
  } else {
    return createNormalEvent(eventStart, eventEnd, eventData)
  }
}

function isDateExcluded (eventStart, exdates, isAllDayEvent) {
  return exdates.some(exdate => {
    if (isAllDayEvent) {
      return exdate.split('T')[0] === eventStart
    } else {
      const exdateTime = new Date(exdate)
      const eventTime = new Date(eventStart)
      
      return (
        exdateTime.getFullYear() === eventTime.getFullYear() &&
        exdateTime.getMonth() === eventTime.getMonth() &&
        exdateTime.getDate() === eventTime.getDate() &&
        exdateTime.getHours() === eventTime.getHours() &&
        exdateTime.getMinutes() === eventTime.getMinutes()
      )
    }
  })
}

function createExceptionEvent (exception) {
  const exceptionEvent = exception.event
  const exceptionTimezones = exception.timezones
  
  const start = formatDateToISO(exceptionEvent.DTSTART, exceptionTimezones.DTSTART)
  const end = exceptionEvent.DTEND ? formatDateToISO(exceptionEvent.DTEND, exceptionTimezones.DTEND) : null
  const title = cleanString(exceptionEvent.SUMMARY)
  const description = cleanString(exceptionEvent.DESCRIPTION)
  const address = cleanAddress(exceptionEvent.LOCATION)

  const transformedEvent = {}
  if (start) transformedEvent.start = start
  if (end) transformedEvent.end = end
  if (title) transformedEvent.title = title
  if (description) transformedEvent.description = description
  if (address) transformedEvent.address = address

  return transformedEvent
}

function createNormalEvent (eventStart, eventEnd, eventData) {
  const transformedEvent = {}
  if (eventStart) transformedEvent.start = eventStart
  if (eventEnd) transformedEvent.end = eventEnd
  if (eventData.title) transformedEvent.title = eventData.title
  if (eventData.description) transformedEvent.description = eventData.description
  if (eventData.address) transformedEvent.address = eventData.address

  return transformedEvent
}

function advanceToNextDate (currentDate, freq, interval, byday) {
  if (freq === 'YEARLY') {
    currentDate.setFullYear(currentDate.getFullYear() + interval)
  } else if (freq === 'MONTHLY') {
    currentDate.setMonth(currentDate.getMonth() + interval)
  } else if (freq === 'WEEKLY') {
    if (byday && byday.length > 1) {
      advanceToNextWeeklyDay(currentDate, byday, interval)
    } else {
      currentDate.setDate(currentDate.getDate() + (7 * interval))
    }
  } else if (freq === 'DAILY') {
    currentDate.setDate(currentDate.getDate() + interval)
  } else {
    // Break infinite loop for unsupported frequencies
    currentDate.setFullYear(currentDate.getFullYear() + 10)
  }
}

function advanceToNextWeeklyDay (currentDate, byday, interval) {
  const dayMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }
  let daysToAdd = 1
  let nextDayOfWeek = (currentDate.getDay() + 1) % 7

  // Find the next matching day in the current interval period
  while (daysToAdd <= 7 * interval) {
    if (byday.some((day) => dayMap[day] === nextDayOfWeek)) {
      currentDate.setDate(currentDate.getDate() + daysToAdd)
      return
    }
    daysToAdd++
    nextDayOfWeek = (nextDayOfWeek + 1) % 7
  }

  // If we've gone through a full interval period, reset to first day of next interval
  currentDate.setDate(currentDate.getDate() + (7 * interval))
  // Adjust to first matching day of the week
  const targetDay = dayMap[byday[0]]
  const currentDay = currentDate.getDay()
  const daysUntilTarget = (targetDay - currentDay + 7) % 7
  currentDate.setDate(currentDate.getDate() + daysUntilTarget)
}

function filterAndSortEvents (events) {
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(23, 59, 59, 999) // End of yesterday

  // Filter events that end after yesterday
  const validEvents = events.filter((event) => {
    if (!event.start) return false

    const eventEndDate = event.end ? new Date(event.end) : new Date(event.start)
    return eventEndDate > yesterday
  })

  // Sort all valid events by start date (earliest first)
  validEvents.sort((a, b) => {
    const dateA = new Date(a.start)
    const dateB = new Date(b.start)
    return dateA - dateB
  })

  // Return only the first 25 events
  return validEvents.slice(0, 25)
}

function cleanString (str) {
  if (!str) return ''

  return unescapeICS(str)
    .replace(/\n/g, ' ') // Replace actual newlines with space
    .replace(/\r/g, ' ') // Replace carriage returns with space
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim() // Remove leading/trailing whitespace
}

function cleanAddress (str) {
  if (!str) return ''

  return unescapeICS(str)
    .replace(/\n/g, ', ') // Replace actual newlines with comma-space
    .replace(/\r/g, ', ') // Replace carriage returns with comma-space
    .replace(/,\s*,/g, ',') // Remove duplicate commas
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim() // Remove leading/trailing whitespace
}

function unescapeICS (str) {
  if (!str) return ''

  // Handle ICS escape sequences according to RFC 5545
  return str
    .replace(/\\n/g, '\n') // Escaped newline becomes actual newline
    .replace(/\\N/g, '\n') // Alternative escaped newline
    .replace(/\\r/g, '\r') // Escaped carriage return
    .replace(/\\t/g, '\t') // Escaped tab
    .replace(/\\,/g, ',') // Escaped comma
    .replace(/\\;/g, ';') // Escaped semicolon
    .replace(/\\"/g, '"') // Escaped quote
    .replace(/\\\\/g, '\\') // Escaped backslash (must be last)
}

function formatDateToISO (dateString, timezone) {
  if (!dateString) return ''

  // Handle YYYYMMDDTHHMMSSZ format (UTC)
  if (dateString.match(/^\d{8}T\d{6}Z$/)) {
    const year = dateString.substr(0, 4)
    const month = dateString.substr(4, 2)
    const day = dateString.substr(6, 2)
    const hour = dateString.substr(9, 2)
    const minute = dateString.substr(11, 2)
    const second = dateString.substr(13, 2)

    return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`
  }

  // Handle YYYYMMDDTHHMMSS format (local time, possibly with timezone)
  if (dateString.match(/^\d{8}T\d{6}$/)) {
    const year = dateString.substr(0, 4)
    const month = dateString.substr(4, 2)
    const day = dateString.substr(6, 2)
    const hour = dateString.substr(9, 2)
    const minute = dateString.substr(11, 2)
    const second = dateString.substr(13, 2)

    const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}`

    if (timezone) {
      try {
        // Handle GMT offset timezones (e.g., GMT+0200, GMT-0500)
        if (timezone.match(/^GMT[+-]\d{4}$/)) {
          const sign = timezone.charAt(3) === '+' ? 1 : -1
          const hours = parseInt(timezone.substr(4, 2))
          const minutes = parseInt(timezone.substr(6, 2))
          const offsetMinutes = sign * (hours * 60 + minutes)

          // Apply the offset to convert local time to UTC
          const date = new Date(isoString)
          const utcDate = new Date(date.getTime() - (offsetMinutes * 60 * 1000))
          return utcDate.toISOString().replace(/\.\d{3}Z$/, 'Z')
        }

        // Use Intl.DateTimeFormat for IANA timezone identifiers
        const date = new Date(isoString)
        const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }))
        const localDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }))
        const offsetMs = utcDate.getTime() - localDate.getTime()

        // Apply the offset to convert local time to UTC
        const correctedDate = new Date(date.getTime() + offsetMs)
        return correctedDate.toISOString().replace(/\.\d{3}Z$/, 'Z')
      }
      catch {
        // If timezone is not recognized, return local time
      }
    }

    return isoString
  }

  // Handle YYYYMMDD format (date only)
  if (dateString.match(/^\d{8}$/)) {
    const year = dateString.substr(0, 4)
    const month = dateString.substr(4, 2)
    const day = dateString.substr(6, 2)

    const dateOnly = `${year}-${month}-${day}`

    // For full-day events, if this is an end date, subtract one day
    // since iCal end dates are exclusive (next day after event)
    if (timezone === 'FULL_DAY_END') {
      const date = new Date(dateOnly)
      date.setDate(date.getDate() - 1)
      return date.toISOString().split('T')[0]
    }

    return dateOnly
  }

  // Return as-is if already in a recognizable format
  return dateString
}

// Export the main function for use as a module
module.exports = { main }
