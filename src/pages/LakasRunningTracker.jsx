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

export default function LakasRunningTracker({ onSave, onClose }) {
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [distance, setDistance] = useState(0)
  const [coordinates, setCoordinates] = useState([])
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

    // Standard center coordinates (Manila default)
    const defaultCenter = [14.5995, 120.9842]
    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView(defaultCenter, 15)

    // Load OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map)

    // Setup layers
    const pathLayer = L.polyline([], {
      color: '#00f6ff', // Glowing neon blue route
      weight: 5,
      opacity: 0.9,
    }).addTo(map)

    mapInstanceRef.current = map
    pathLayerRef.current = pathLayer

    // Clean up
    return () => {
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
        const { latitude, longitude } = position.coords
        const newPoint = { lat: latitude, lng: longitude, timestamp: Date.now() }
        
        setCoordinates(prev => {
          const next = [...prev, newPoint]
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

  const paceLabel = formatPace(elapsedSeconds, distance)

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
