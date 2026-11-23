const axios = require('axios');

// In-memory cache for resolved IP locations to avoid redundant lookups
const ipCache = new Map();
const CACHE_LIMIT = 500;

/**
 * Checks if an IP is in private/loopback RFC 1918 or localhost range.
 */
const isPrivateIp = (ip) => {
  if (!ip) return true;
  const clean = ip.replace(/^::ffff:/, '').trim();
  if (clean === '127.0.0.1' || clean === '::1' || clean === 'localhost') return true;
  if (clean.startsWith('10.') || clean.startsWith('192.168.')) return true;
  const match172 = clean.match(/^172\.(\d+)\./);
  if (match172 && parseInt(match172[1], 10) >= 16 && parseInt(match172[1], 10) <= 31) return true;
  return false;
};

/**
 * Resolves IP geolocation without inventing or randomizing data.
 * - Respects simulated headers for controlled SOC testing.
 * - Recognizes local/intranet IPs as Bengaluru Company Network.
 * - Resolves public IPs using live geolocation API.
 * - Falls back to "Location unavailable" if unresolvable.
 */
const resolveLocation = async (req) => {
  // 1. Check for explicit simulation headers (from Demo Portal / tests)
  const customCity = req.headers['x-simulated-city'];
  const customCountry = req.headers['x-simulated-country'];
  const customState = req.headers['x-simulated-state'];
  const customIp = req.headers['x-simulated-ip'];

  if (customCity || customCountry || customIp) {
    return {
      ipAddress: customIp || req.ip || '185.220.101.5',
      country: customCountry || 'Russia',
      state: customState || customCity || 'Moscow Region',
      city: customCity || 'Moscow',
      latitude: customCountry === 'Russia' ? 55.7558 : 12.9716,
      longitude: customCountry === 'Russia' ? 37.6173 : 77.5946,
      isSimulated: true,
      approximate: true,
      note: 'Controlled SOC demonstration simulation telemetry.',
    };
  }

  // 2. Extract client IP from trusted reverse proxy headers or socket
  const rawIp =
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    '127.0.0.1';

  const cleanIp = rawIp.replace(/^::ffff:/, '').trim();

  // 3. Handle local / private intranet connections
  if (isPrivateIp(cleanIp)) {
    return {
      ipAddress: cleanIp,
      country: 'India',
      state: 'Karnataka',
      city: 'Bengaluru',
      latitude: 12.9716,
      longitude: 77.5946,
      isPrivate: true,
      approximate: true,
      note: 'Local Intranet / Bengaluru Company Network (127.0.0.1 / private subnet)',
    };
  }

  // 4. Check cache for public IP
  if (ipCache.has(cleanIp)) {
    return ipCache.get(cleanIp);
  }

  // 5. Query IP geolocation API with safe timeout
  try {
    const response = await axios.get(`http://ip-api.com/json/${cleanIp}?fields=status,message,country,regionName,city,lat,lon`, {
      timeout: 2500,
    });

    if (response.data && response.data.status === 'success') {
      const locationData = {
        ipAddress: cleanIp,
        country: response.data.country || 'Location unavailable',
        state: response.data.regionName || 'Location unavailable',
        city: response.data.city || 'Location unavailable',
        latitude: response.data.lat || null,
        longitude: response.data.lon || null,
        isPrivate: false,
        approximate: true,
        note: 'Resolved via IP geolocation. Note: IP-based geolocation is approximate and cannot prove exact physical presence.',
      };

      if (ipCache.size > CACHE_LIMIT) ipCache.clear();
      ipCache.set(cleanIp, locationData);
      return locationData;
    }
  } catch (err) {
    console.warn(`[GEO] IP geolocation resolution failed for ${cleanIp}: ${err.message}`);
  }

  // 6. Return graceful "Location unavailable" rather than inventing data
  const unavailableData = {
    ipAddress: cleanIp,
    country: 'Location unavailable',
    state: 'Location unavailable',
    city: 'Location unavailable',
    latitude: null,
    longitude: null,
    isPrivate: false,
    approximate: true,
    note: 'Location unavailable. IP geolocation could not resolve this address.',
  };

  return unavailableData;
};

module.exports = { resolveLocation, isPrivateIp };

