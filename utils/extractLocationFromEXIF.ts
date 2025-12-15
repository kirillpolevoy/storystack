import * as ImagePicker from 'expo-image-picker';

/**
 * Extracts location from EXIF metadata and converts GPS coordinates to city name
 * Returns city name if available, null otherwise
 */
export async function extractLocationFromEXIF(
  asset: ImagePicker.ImagePickerAsset
): Promise<string | null> {
  try {
    // Log full asset structure for debugging
    console.log('[extractLocationFromEXIF] Full asset keys:', Object.keys(asset));
    console.log('[extractLocationFromEXIF] Asset location property:', (asset as any).location);
    
    // Check if asset has location data
    // expo-image-picker provides location in exif field OR directly in asset
    const exif = asset.exif;
    
    // Log full EXIF structure
    if (exif) {
      console.log('[extractLocationFromEXIF] EXIF keys:', Object.keys(exif));
      console.log('[extractLocationFromEXIF] Full EXIF data:', JSON.stringify(exif, null, 2).substring(0, 1000));
    } else {
      console.log('[extractLocationFromEXIF] No EXIF data available');
    }
    
    let latitude: number | null = null;
    let longitude: number | null = null;

    // Method 1: Try direct location property (iOS sometimes provides this)
    if ('location' in asset && asset.location) {
      const loc = asset.location as any;
      console.log('[extractLocationFromEXIF] asset.location type:', typeof loc, 'value:', loc);
      if (loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
        latitude = loc.latitude;
        longitude = loc.longitude;
        console.log('[extractLocationFromEXIF] ✅ Found location in asset.location:', { latitude, longitude });
      }
    }

    // Method 2: Try decimal format in EXIF (common format)
    if (latitude === null && exif && typeof (exif as any).latitude === 'number' && typeof (exif as any).longitude === 'number') {
      latitude = (exif as any).latitude;
      longitude = (exif as any).longitude;
      console.log('[extractLocationFromEXIF] ✅ Found location in exif.latitude/longitude:', { latitude, longitude });
    }
    
    // Method 3: Try GPS format (degrees/minutes/seconds) - common in iOS photos
    if (latitude === null && exif && (exif as any).GPSLatitude && (exif as any).GPSLongitude) {
      const latArray = (exif as any).GPSLatitude;
      const lonArray = (exif as any).GPSLongitude;
      const latRef = (exif as any).GPSLatitudeRef;
      const lonRef = (exif as any).GPSLongitudeRef;
      
      console.log('[extractLocationFromEXIF] GPS format data:', { latArray, lonArray, latRef, lonRef });

      if (Array.isArray(latArray) && Array.isArray(lonArray)) {
        // Handle different array lengths (sometimes 2 elements, sometimes 3)
        if (latArray.length >= 2 && lonArray.length >= 2) {
          // Convert DMS to decimal
          const latDegrees = typeof latArray[0] === 'number' ? latArray[0] : parseFloat(String(latArray[0]));
          const latMinutes = typeof latArray[1] === 'number' ? latArray[1] : parseFloat(String(latArray[1]));
          const latSeconds = latArray.length >= 3 ? (typeof latArray[2] === 'number' ? latArray[2] : parseFloat(String(latArray[2]))) : 0;
          
          const lonDegrees = typeof lonArray[0] === 'number' ? lonArray[0] : parseFloat(String(lonArray[0]));
          const lonMinutes = typeof lonArray[1] === 'number' ? lonArray[1] : parseFloat(String(lonArray[1]));
          const lonSeconds = lonArray.length >= 3 ? (typeof lonArray[2] === 'number' ? lonArray[2] : parseFloat(String(lonArray[2]))) : 0;
          
          latitude = latDegrees + latMinutes / 60 + latSeconds / 3600;
          longitude = lonDegrees + lonMinutes / 60 + lonSeconds / 3600;

          // Apply ref (N/S, E/W)
          if (latRef === 'S' || latRef === 's') latitude = -latitude;
          if (lonRef === 'W' || lonRef === 'w') longitude = -longitude;
          console.log('[extractLocationFromEXIF] ✅ Found location in GPS format (DMS):', { latitude, longitude, latRef, lonRef });
        }
      }
    }
    
    // Method 4: Try alternative EXIF keys (some iOS versions use different keys)
    if (latitude === null && exif) {
      const exifAny = exif as any;
      // Try various possible key names
      const possibleLatKeys = ['Latitude', 'latitude', 'GPSLatitude', 'gpsLatitude', 'lat'];
      const possibleLonKeys = ['Longitude', 'longitude', 'GPSLongitude', 'gpsLongitude', 'lon', 'lng'];
      
      for (const latKey of possibleLatKeys) {
        for (const lonKey of possibleLonKeys) {
          if (typeof exifAny[latKey] === 'number' && typeof exifAny[lonKey] === 'number') {
            latitude = exifAny[latKey];
            longitude = exifAny[lonKey];
            console.log(`[extractLocationFromEXIF] ✅ Found location in exif.${latKey}/${lonKey}:`, { latitude, longitude });
            break;
          }
        }
        if (latitude !== null) break;
      }
    }

    if (latitude === null || longitude === null) {
      console.log('[extractLocationFromEXIF] ❌ Could not extract location from EXIF data');
      return null;
    }

    console.log('[extractLocationFromEXIF] ✅ Extracted coordinates:', { latitude, longitude });
    
    // Reverse geocode to get city name
    // Using OpenStreetMap Nominatim (free, no API key required)
    const cityName = await reverseGeocodeToCity(latitude, longitude);
    if (cityName) {
      console.log('[extractLocationFromEXIF] ✅ Reverse geocoded to city:', cityName);
    } else {
      console.log('[extractLocationFromEXIF] ⚠️  Reverse geocoding returned no city name');
    }
    return cityName;
  } catch (error) {
    console.error('[extractLocationFromEXIF] Error extracting location:', error);
    return null;
  }
}

/**
 * Reverse geocodes GPS coordinates to city name using OpenStreetMap Nominatim
 */
async function reverseGeocodeToCity(latitude: number, longitude: number): Promise<string | null> {
  try {
    // Use OpenStreetMap Nominatim API (free, rate-limited but sufficient for our use case)
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`;
    
    console.log('[extractLocationFromEXIF] Reverse geocoding URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'StoryStack/1.0', // Required by Nominatim
      },
    });

    if (!response.ok) {
      console.warn('[extractLocationFromEXIF] Reverse geocoding failed:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    console.log('[extractLocationFromEXIF] Reverse geocoding response:', JSON.stringify(data).substring(0, 500));
    
    // Extract city name from address components
    // Priority: city > town > village > municipality
    const address = data.address;
    if (!address) {
      console.log('[extractLocationFromEXIF] No address in reverse geocoding response');
      return null;
    }

    const cityName = 
      address.city || 
      address.town || 
      address.village || 
      address.municipality ||
      address.county ||
      null;

    return cityName;
  } catch (error) {
    console.error('[extractLocationFromEXIF] Reverse geocoding error:', error);
    return null;
  }
}


