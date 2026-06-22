import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import lStyles from './Lakas.module.css'

// Helper function to calculate distance in km between two GPS points using Haversine formula
function calculateHaversineDistance(coords) {
  if (coords.length < 2) return 0
  let totalDist = 0
  const toRad = x => (x * Math.PI) / 180

  for (let i = 0; i < coords.length - 1; i++) {
    const lon1 = coords[i].lng
    const lat1 = coords[i].lat
    const lon2 = coords[i + 1].lng
    const lat2 = coords[i + 1].lat

    const R = 6371 // Earth radius in km
    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    totalDist += R * c
  }
  return totalDist
}

// Format duration seconds to HH:MM:SS or MM:SS
function formatDuration(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const pad = num => String(num).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

// Format Pace to MM:SS min/km
function formatPace(sec, km) {
  if (km <= 0) return '−:−−'
  const paceSeconds = Math.round(sec / km)
  const m = Math.floor(paceSeconds / 60)
  const s = paceSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// Compute live rolling pace or speed-based pace to handle stationary state
function getLivePace(speed, coordinates, elapsedSeconds) {
  // If GPS speed is provided and valid (greater than a slow walk threshold of 0.5 m/s)
  if (speed !== null && speed !== undefined) {
    if (speed < 0.5) return '−:−−' // Standing still or extremely slow movement
    const paceSeconds = 1000 / speed
    const m = Math.floor(paceSeconds / 60)
    const s = Math.round(paceSeconds % 60)
    if (m > 99) return '−:−−'
    return `${m}:${String(s).padStart(2, '0')}`
  }

  // Fallback to a rolling 15-second window
  if (coordinates.length < 2) return '−:−−'
  const now = Date.now()
  const fifteenSecsAgo = now - 15000
  const recent = coordinates.filter(p => p.timestamp >= fifteenSecsAgo)

  if (recent.length < 2) {
    const lastPoint = coordinates[coordinates.length - 1]
    if (now - lastPoint.timestamp > 10000) return '−:−−' // Stopped for >10s
    return '−:−−'
  }

  const recentDist = calculateHaversineDistance(recent)
  const timeDiff = (recent[recent.length - 1].timestamp - recent[0].timestamp) / 1000

  if (recentDist < 0.003 || timeDiff <= 0) return '−:−−' // Less than 3 meters in 15 seconds

  const paceSeconds = Math.round(timeDiff / recentDist)
  const m = Math.floor(paceSeconds / 60)
  const s = paceSeconds % 60
  if (m > 99) return '−:−−'
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function LakasRunningTracker({ onSave, onClose }) {
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [distance, setDistance] = useState(0)
  const [coordinates, setCoordinates] = useState([])
  const [currentSpeed, setCurrentSpeed] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  const timerRef = useRef(null)
  const watchIdRef = useRef(null)
  const wakeLockRef = useRef(null)
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const pathLayerRef = useRef(null)
  const markerLayerRef = useRef(null)

  // Keep references updated for the tracking callback
  const coordinatesRef = useRef([])
  coordinatesRef.current = coordinates

  // 1. Initialize Map
  useEffect(() => {
    if (!mapRef.current) return

    // Reset container DOM and Leaflet ID to prevent double-initialization crashes in React
    mapRef.current.innerHTML = ''
    if (mapRef.current._leaflet_id) {
      delete mapRef.current._leaflet_id
    }

    // Standard center coordinates (Manila default)
    const defaultCenter = [14.5995, 120.9842]
    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(defaultCenter, 15)

    // Load CartoDB tiles matching the active app theme (Voyager for warm light mode, Dark Matter for dark mode)
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    const tileUrl = isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'

    L.tileLayer(tileUrl, {
      maxZoom: 20,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map)

    // Setup layers
    const pathLayer = L.polyline([], {
      color: '#00f6ff', // Glowing neon blue route
      weight: 5,
      opacity: 0.9,
    }).addTo(map)

    mapInstanceRef.current = map
    pathLayerRef.current = pathLayer

    // Get current location on mount to center the map and display the pin before the run begins
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          const { latitude, longitude } = position.coords
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([latitude, longitude], 16)
            
            // Draw current position circle marker
            if (markerLayerRef.current) {
              markerLayerRef.current.setLatLng([latitude, longitude])
            } else {
              markerLayerRef.current = L.circleMarker([latitude, longitude], {
                radius: 8,
                fillColor: '#00f6ff',
                color: '#ffffff',
                weight: 2.5,
                opacity: 1,
                fillOpacity: 1,
              }).addTo(mapInstanceRef.current)
            }
          }
        },
        err => console.warn('Initial geolocation fetch failed:', err),
        { enableHighAccuracy: true, timeout: 8000 }
      )
    }

    // Force map invalidation after small timeouts to ensure size calculation runs after any modal layout transitions complete
    const t1 = setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize()
    }, 100)
    const t2 = setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize()
    }, 500)

    // Attach ResizeObserver to handle element size calculation lag / visibility changes
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize()
    })
    resizeObserver.observe(mapRef.current)

    // Clean up
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      resizeObserver.disconnect()
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // 2. Timer Effect
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isRunning])

  // 3. Screen Wake Lock handler
  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
      } catch (err) {
        console.warn('Wake Lock request failed:', err)
      }
    }
  }

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().then(() => {
        wakeLockRef.current = null
      })
    }
  }

  // 4. GPS Track position stream
  const startTracking = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.')
      return
    }

    requestWakeLock()

    watchIdRef.current = navigator.geolocation.watchPosition(
      position => {
        const { latitude, longitude, accuracy, speed } = position.coords
        
        // Ignore poor accuracy signals (> 20 meters accuracy range) to avoid sudden large jumps
        if (accuracy !== null && accuracy !== undefined && accuracy > 20) {
          return
        }

        setCurrentSpeed(speed)
        const newPoint = { lat: latitude, longitude, timestamp: Date.now() }
        
        setCoordinates(prev => {
          // If we already have coordinates, avoid adding points that have shifted less than 3 meters (GPS Jitter filter)
          if (prev.length > 0) {
            const lastPoint = prev[prev.length - 1]
            const segmentDist = calculateHaversineDistance([lastPoint, newPoint])
            if (segmentDist < 0.003) {
              return prev
            }
          }

          const next = [...prev, { lat: latitude, lng: longitude, timestamp: newPoint.timestamp }]
          const dist = calculateHaversineDistance(next)
          setDistance(dist)

          // Update Map
          if (mapInstanceRef.current) {
            // Draw path line
            const latLngs = next.map(p => [p.lat, p.lng])
            if (pathLayerRef.current) {
              pathLayerRef.current.setLatLngs(latLngs)
            }

            // Draw current position circle marker
            if (markerLayerRef.current) {
              markerLayerRef.current.setLatLng([latitude, longitude])
            } else {
              markerLayerRef.current = L.circleMarker([latitude, longitude], {
                radius: 7,
                fillColor: '#00f6ff',
                color: '#ffffff',
                weight: 2,
                opacity: 1,
                fillOpacity: 1,
              }).addTo(mapInstanceRef.current)
            }

            // Pan map to follow runner
            mapInstanceRef.current.panTo([latitude, longitude])
          }

          return next
        })
      },
      error => {
        console.error('GPS tracking error:', error)
        setErrorMsg('Unable to retrieve high accuracy GPS position.')
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }

  const stopTracking = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    releaseWakeLock()
  }

  // Effect to manage active GPS stream based on run state
  useEffect(() => {
    if (isRunning) {
      startTracking()
    } else {
      stopTracking()
    }
    return () => stopTracking()
  }, [isRunning])

  const handleStart = () => {
    setIsRunning(true)
  }

  const handlePause = () => {
    setIsRunning(false)
  }

  const handleSave = () => {
    stopTracking()
    // Trigger callback to save run log to parent component
    onSave(elapsedSeconds, distance, coordinates)
  }

  const recenterMap = () => {
    if (coordinates.length > 0) {
      const lastPoint = coordinates[coordinates.length - 1]
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([lastPoint.lat, lastPoint.lng], 16)
      }
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          const { latitude, longitude } = position.coords
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([latitude, longitude], 16)
            
            // Draw current position circle marker
            if (markerLayerRef.current) {
              markerLayerRef.current.setLatLng([latitude, longitude])
            } else {
              markerLayerRef.current = L.circleMarker([latitude, longitude], {
                radius: 8,
                fillColor: '#00f6ff',
                color: '#ffffff',
                weight: 2.5,
                opacity: 1,
                fillOpacity: 1,
              }).addTo(mapInstanceRef.current)
            }
          }
        },
        err => console.warn('Recenter location fetch failed:', err),
        { enableHighAccuracy: true, timeout: 6000 }
      )
    }
  }

  const paceLabel = isRunning ? getLivePace(currentSpeed, coordinates, elapsedSeconds) : '−:−−'

  return (
    <div className={lStyles.runOverlay} role="dialog" aria-modal="true" aria-labelledby="run-session-title">
      <div className={lStyles.runTrackerContainer}>
        {/* Header Bar */}
        <div className={lStyles.runTrackerHeader}>
          <div>
            <span className={lStyles.runTrackerEyebrow}>Outdoor run mode</span>
            <h3 id="run-session-title" className={lStyles.runTrackerTitle}>Cardio Conditioning</h3>
          </div>
          <button type="button" className={lStyles.runTrackerClose} onClick={onClose} aria-label="Close run session">
            Cancel
          </button>
        </div>

        {/* Live Map Area */}
        <div className={lStyles.runMapWrapper}>
          <div ref={mapRef} className={lStyles.runMap} />
          <button 
            type="button" 
            className={lStyles.mapRecenterBtn} 
            onClick={recenterMap}
            aria-label="Recenter map on current location"
            title="Recenter location"
          >
            🎯
          </button>
          {errorMsg && <div className={lStyles.runMapError}>{errorMsg}</div>}
        </div>

        {/* Live Dashboard Overlay */}
        <div className={lStyles.runDash}>
          <div className={lStyles.runStatGrid}>
            <div className={lStyles.runStat}>
              <span className={lStyles.runStatLabel}>Distance</span>
              <strong className={lStyles.runStatValue}>{distance.toFixed(2)} <small>km</small></strong>
            </div>
            <div className={lStyles.runStat}>
              <span className={lStyles.runStatLabel}>Time</span>
              <strong className={lStyles.runStatValue}>{formatDuration(elapsedSeconds)}</strong>
            </div>
            <div className={lStyles.runStat}>
              <span className={lStyles.runStatLabel}>Pace</span>
              <strong className={lStyles.runStatValue}>{paceLabel} <small>/km</small></strong>
            </div>
          </div>

          {/* Controls button actions */}
          <div className={lStyles.runControls}>
            {!isRunning && elapsedSeconds === 0 ? (
              <button type="button" className={lStyles.runStartBtn} onClick={handleStart}>
                Start Run
              </button>
            ) : isRunning ? (
              <button type="button" className={lStyles.runPauseBtn} onClick={handlePause}>
                Pause Run
              </button>
            ) : (
              <div className={lStyles.runActionGroup}>
                <button type="button" className={lStyles.runResumeBtn} onClick={handleStart}>
                  Resume
                </button>
                <button type="button" className={lStyles.runSaveBtn} onClick={handleSave} disabled={coordinates.length === 0}>
                  Finish & Save
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
