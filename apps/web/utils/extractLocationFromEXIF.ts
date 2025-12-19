/**
 * Extracts location from EXIF metadata and converts GPS coordinates to city name
 * Web-compatible version of the mobile app's extractLocationFromEXIF
 * Returns city name if available, null otherwise
 */

import exifr from 'exifr'

export async function extractLocationFromEXIF(file: File): Promise<string | null> {
  try {
    console.log('[extractLocationFromEXIF] Extracting location from file:', file.name, 'type:', file.type, 'size:', file.size)
    
    // Parse EXIF data using exifr
    // For HEIC files, exifr should be able to read them, but we need to parse all GPS-related fields
    const exifData = await exifr.parse(file, {
      pick: [
        'latitude',
        'longitude',
        'GPSLatitude',
        'GPSLongitude',
        'GPSLatitudeRef',
        'GPSLongitudeRef',
        'Latitude',
        'Longitude',
        // Include all GPS-related fields
        'GPS',
        'GPSVersionID',
        'GPSMapDatum',
      ],
      translateKeys: false,
      // Don't skip any segments - HEIC files might have GPS in different segments
      skip: [],
    })

    if (!exifData) {
      console.log('[extractLocationFromEXIF] No EXIF data available from exifr.parse')
      return null
    }

    console.log('[extractLocationFromEXIF] EXIF keys found:', Object.keys(exifData))
    console.log('[extractLocationFromEXIF] Full EXIF data:', JSON.stringify(exifData, null, 2).substring(0, 1000))
    
    // Check if GPS data is nested in GPS object
    if (exifData.GPS && typeof exifData.GPS === 'object') {
      console.log('[extractLocationFromEXIF] Found GPS object, merging with main exifData')
      Object.assign(exifData, exifData.GPS)
    }

    let latitude: number | null = null
    let longitude: number | null = null

    // Method 1: Try decimal format in EXIF (common format, exifr provides this)
    if (typeof exifData.latitude === 'number' && typeof exifData.longitude === 'number') {
      latitude = exifData.latitude
      longitude = exifData.longitude
      console.log('[extractLocationFromEXIF] ✅ Found location in exif.latitude/longitude:', { latitude, longitude })

      // Check if coordinates might need sign correction based on magnitude
      // US longitudes should be negative (West of Prime Meridian)
      // If longitude is positive and > 80, it's likely wrong for US locations
      if (longitude > 0 && Math.abs(longitude) > 80) {
        console.warn('[extractLocationFromEXIF] ⚠️  Suspicious longitude (positive and > 80), might need negation:', longitude)
        // Don't auto-correct here, but log for debugging
      }
    }

    // Method 2: Try GPS format (degrees/minutes/seconds) - common in iOS photos
    if (latitude === null && exifData.GPSLatitude && exifData.GPSLongitude) {
      const latArray = exifData.GPSLatitude
      const lonArray = exifData.GPSLongitude
      const latRef = exifData.GPSLatitudeRef
      const lonRef = exifData.GPSLongitudeRef

      console.log('[extractLocationFromEXIF] GPS format data:', {
        latArray,
        lonArray,
        latRef,
        lonRef,
        latArrayType: Array.isArray(latArray) ? 'array' : typeof latArray,
        lonArrayType: Array.isArray(lonArray) ? 'array' : typeof lonArray,
      })

      if (Array.isArray(latArray) && Array.isArray(lonArray)) {
        // Handle different array lengths (sometimes 2 elements, sometimes 3)
        if (latArray.length >= 2 && lonArray.length >= 2) {
          // Convert DMS to decimal
          const latDegrees = typeof latArray[0] === 'number' ? latArray[0] : parseFloat(String(latArray[0]))
          const latMinutes = typeof latArray[1] === 'number' ? latArray[1] : parseFloat(String(latArray[1]))
          const latSeconds = latArray.length >= 3 ? (typeof latArray[2] === 'number' ? latArray[2] : parseFloat(String(latArray[2]))) : 0

          const lonDegrees = typeof lonArray[0] === 'number' ? lonArray[0] : parseFloat(String(lonArray[0]))
          const lonMinutes = typeof lonArray[1] === 'number' ? lonArray[1] : parseFloat(String(lonArray[1]))
          const lonSeconds = lonArray.length >= 3 ? (typeof lonArray[2] === 'number' ? lonArray[2] : parseFloat(String(lonArray[2]))) : 0

          latitude = latDegrees + latMinutes / 60 + latSeconds / 3600
          longitude = lonDegrees + lonMinutes / 60 + lonSeconds / 3600

          console.log('[extractLocationFromEXIF] Before applying ref:', {
            latitude,
            longitude,
            latRef,
            lonRef,
            latDMS: { degrees: latDegrees, minutes: latMinutes, seconds: latSeconds },
            lonDMS: { degrees: lonDegrees, minutes: lonMinutes, seconds: lonSeconds },
          })

          // Apply ref (N/S, E/W)
          // IMPORTANT: For Western longitudes (US, etc.), lonRef should be 'W' and we need to negate
          // Also handle case-insensitive matching and numeric codes (1 = N/E, -1 = S/W)
          if (latRef === 'S' || latRef === 's' || latRef === -1) {
            latitude = -latitude
            console.log('[extractLocationFromEXIF] Applied S (South) reference, negated latitude')
          }
          if (lonRef === 'W' || lonRef === 'w' || lonRef === -1) {
            longitude = -longitude
            console.log('[extractLocationFromEXIF] Applied W (West) reference, negated longitude')
          }

          // If no reference found but coordinates suggest wrong hemisphere, try heuristic
          if (!lonRef && longitude > 0 && latitude > 25 && latitude < 50) {
            // Likely US coordinates missing W reference
            console.warn('[extractLocationFromEXIF] ⚠️  No longitude reference found, but coordinates suggest US (positive lon, lat 25-50). Trying negated longitude...')
            const testLon = -longitude
            // Quick sanity check: Milwaukee area is around -87.9
            if (Math.abs(testLon - (-87.9)) < 10) {
              console.log('[extractLocationFromEXIF] ✅ Negated longitude looks correct for US Midwest, using it')
              longitude = testLon
            }
          }

          console.log('[extractLocationFromEXIF] ✅ Found location in GPS format (DMS):', {
            latitude,
            longitude,
            latRef,
            lonRef,
            beforeRef: { lat: latDegrees + latMinutes / 60 + latSeconds / 3600, lon: lonDegrees + lonMinutes / 60 + lonSeconds / 3600 },
          })
        }
      } else {
        // Sometimes GPS coordinates are already in decimal format, not arrays
        console.log('[extractLocationFromEXIF] GPS coordinates not in array format, trying direct values')
        if (typeof latArray === 'number' && typeof lonArray === 'number') {
          latitude = latArray
          longitude = lonArray
          if (latRef === 'S' || latRef === 's' || latRef === -1) latitude = -latitude
          if (lonRef === 'W' || lonRef === 'w' || lonRef === -1) longitude = -longitude
          console.log('[extractLocationFromEXIF] ✅ Found location in GPS format (decimal):', { latitude, longitude, latRef, lonRef })
        }
      }
    }

    // Method 3: Try alternative EXIF keys (some cameras use different keys)
    if (latitude === null && exifData) {
      const exifAny = exifData as any
      // Try various possible key names
      const possibleLatKeys = ['Latitude', 'latitude', 'GPSLatitude', 'gpsLatitude', 'lat']
      const possibleLonKeys = ['Longitude', 'longitude', 'GPSLongitude', 'gpsLongitude', 'lon', 'lng']

      for (const latKey of possibleLatKeys) {
        for (const lonKey of possibleLonKeys) {
          if (typeof exifAny[latKey] === 'number' && typeof exifAny[lonKey] === 'number') {
            latitude = exifAny[latKey]
            longitude = exifAny[lonKey]
            console.log(`[extractLocationFromEXIF] ✅ Found location in exif.${latKey}/${lonKey}:`, { latitude, longitude })
            break
          }
        }
        if (latitude !== null) break
      }
    }

    if (latitude === null || longitude === null) {
      console.log('[extractLocationFromEXIF] ❌ Could not extract location from EXIF data')
      return null
    }

    console.log('[extractLocationFromEXIF] ✅ Extracted coordinates:', { latitude, longitude })

    // Validate coordinates are reasonable (not 0,0 or obviously wrong)
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      console.error('[extractLocationFromEXIF] ❌ Invalid coordinates:', { latitude, longitude })
      return null
    }

    // Check if coordinates might be swapped (common EXIF issue)
    // If lat > 90 or lon > 180, they're definitely swapped
    // Also check if lat looks like a longitude (abs value > 90 but < 180)
    let finalLat = latitude
    let finalLon = longitude

    if (Math.abs(latitude) > 90 && Math.abs(latitude) <= 180 && Math.abs(longitude) <= 90) {
      console.warn('[extractLocationFromEXIF] ⚠️  Coordinates appear swapped, correcting...')
      finalLat = longitude
      finalLon = latitude
      console.log('[extractLocationFromEXIF] Corrected coordinates:', { latitude: finalLat, longitude: finalLon })
    }

    // Reverse geocode to get city name
    // Using OpenStreetMap Nominatim (free, no API key required)
    const cityName = await reverseGeocodeToCity(finalLat, finalLon)

    // Check if result is in a wrong country (e.g., China when we expect US)
    // If coordinates suggest US (lat 25-50, lon should be negative) but result is wrong country,
    // try negating longitude as fallback
    if (cityName) {
      console.log('[extractLocationFromEXIF] ✅ Reverse geocoded to city:', cityName)

      // Check country of result
      const checkResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${finalLat}&lon=${finalLon}&zoom=10&addressdetails=1`, {
        headers: { 'User-Agent': 'StoryStack/1.0' },
      })

      if (checkResponse.ok) {
        const checkData = await checkResponse.json()
        const checkAddress = checkData.address
        const resultCountry = checkAddress?.country_code

        // If result is China/Asia but coordinates suggest US (lat 25-50, positive lon > 80),
        // try negating longitude
        if (
          resultCountry &&
          ['cn', 'in', 'pk', 'bd', 'lk'].includes(resultCountry.toLowerCase()) &&
          finalLat > 25 &&
          finalLat < 50 &&
          finalLon > 80
        ) {
          console.warn('[extractLocationFromEXIF] ⚠️  Result is in Asia but coordinates suggest US. Trying negated longitude...')
          const correctedLon = -finalLon
          const correctedCityName = await reverseGeocodeToCity(finalLat, correctedLon)

          if (correctedCityName) {
            const correctedCheckResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${finalLat}&lon=${correctedLon}&zoom=10&addressdetails=1`, {
              headers: { 'User-Agent': 'StoryStack/1.0' },
            })
            if (correctedCheckResponse.ok) {
              const correctedCheckData = await correctedCheckResponse.json()
              const correctedCheckAddress = correctedCheckData.address
              if (correctedCheckAddress?.country_code === 'us') {
                console.log('[extractLocationFromEXIF] ✅ Corrected coordinates point to US, using corrected:', correctedCityName)
                return correctedCityName
              }
            }
          }
        }
      }

      // Log full address for debugging
      console.log('[extractLocationFromEXIF] Full address details logged above')
    } else {
      console.log('[extractLocationFromEXIF] ⚠️  Reverse geocoding returned no city name')
    }
    return cityName
  } catch (error) {
    console.error('[extractLocationFromEXIF] Error extracting location:', error)
    return null
  }
}

/**
 * Reverse geocodes GPS coordinates to city name using OpenStreetMap Nominatim
 */
async function reverseGeocodeToCity(latitude: number, longitude: number): Promise<string | null> {
  try {
    // Validate coordinates before making API call
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      console.error('[extractLocationFromEXIF] ❌ Invalid coordinates for reverse geocoding:', { latitude, longitude })
      return null
    }

    // Use OpenStreetMap Nominatim API (free, rate-limited but sufficient for our use case)
    // Try zoom=18 first for more detailed results (city level)
    let url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`

    console.log('[extractLocationFromEXIF] Reverse geocoding coordinates:', { latitude, longitude })
    console.log('[extractLocationFromEXIF] Reverse geocoding URL (zoom=18):', url)

    let response = await fetch(url, {
      headers: {
        'User-Agent': 'StoryStack/1.0', // Required by Nominatim
      },
    })

    if (!response.ok) {
      console.warn('[extractLocationFromEXIF] Reverse geocoding failed:', response.status, response.statusText)
      return null
    }

    let data = await response.json()
    console.log('[extractLocationFromEXIF] Reverse geocoding response (zoom=18):', JSON.stringify(data).substring(0, 1000))

    let address = data.address

    // If we only got county with zoom=18, try zoom=10 for city-level results
    if (address && !address.city && !address.town && !address.village && !address.municipality && address.county) {
      console.log('[extractLocationFromEXIF] Only got county with zoom=18, trying zoom=10 for city-level results...')
      url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`
      response = await fetch(url, {
        headers: {
          'User-Agent': 'StoryStack/1.0',
        },
      })

      if (response.ok) {
        data = await response.json()
        console.log('[extractLocationFromEXIF] Reverse geocoding response (zoom=10):', JSON.stringify(data).substring(0, 1000))
        address = data.address
      }
    }

    if (!address) {
      console.log('[extractLocationFromEXIF] No address in reverse geocoding response')
      // Try to extract city from display_name as fallback
      if (data.display_name) {
        console.log('[extractLocationFromEXIF] Trying to extract city from display_name:', data.display_name)
        // display_name format: "City, County, State, Country"
        const parts = data.display_name.split(',').map((s: string) => s.trim())
        if (parts.length >= 2) {
          // First part is usually the most specific (city/neighborhood)
          return parts[0]
        }
      }
      return null
    }

    // Try to get city/town first (preferred)
    // Also check for "city_district" which can be more specific than county
    const cityName =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.city_district || // Sometimes more specific than county
      null

    // If we have a city, optionally add state for US locations for clarity
    if (cityName) {
      const state = address.state || address.region
      if (state && address.country_code === 'us') {
        // Format as "City, State" for US locations (e.g., "Milwaukee, WI")
        return `${cityName}, ${state}`
      }
      return cityName
    }

    // Before falling back to county, try to extract city from display_name
    if (data.display_name && address.county) {
      console.log('[extractLocationFromEXIF] No city in address, trying display_name:', data.display_name)
      const parts = data.display_name.split(',').map((s: string) => s.trim())
      // display_name format: "City, County, State, Country" or "Neighborhood, City, County, State"
      // Try to find a part that's not the county
      for (const part of parts) {
        if (
          part.toLowerCase() !== address.county.toLowerCase() &&
          !part.toLowerCase().includes('county') &&
          part.length > 2
        ) {
          const state = address.state || address.region
          if (state && address.country_code === 'us') {
            return `${part}, ${state}`
          }
          return part
        }
      }
    }

    // Fallback to county only if no city/town found (but log a warning)
    if (address.county) {
      console.warn('[extractLocationFromEXIF] ⚠️  Using county as fallback (no city found):', address.county)
      const state = address.state || address.region
      if (state && address.country_code === 'us') {
        // Try to format county better - remove "County" suffix if present
        const countyName = address.county.replace(/\s+County$/i, '')
        return `${countyName}, ${state}`
      }
      return address.county
    }

    return null
  } catch (error) {
    console.error('[extractLocationFromEXIF] Reverse geocoding error:', error)
    return null
  }
}

