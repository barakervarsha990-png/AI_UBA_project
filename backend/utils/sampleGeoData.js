// Sample "approximate geolocation" dataset used so the demo works without a real
// IP-geolocation API. In production, replace resolveIp() with a call to a real
// IP geolocation provider (e.g. ipapi.co, MaxMind GeoIP2) using an API key from env.

const LOCATIONS = [
  { country: 'India', state: 'Karnataka', city: 'Bengaluru', latitude: 12.9716, longitude: 77.5946, ipPrefix: '103.21.58' },
  { country: 'India', state: 'Maharashtra', city: 'Mumbai', latitude: 19.076, longitude: 72.8777, ipPrefix: '103.22.14' },
  { country: 'India', state: 'Delhi', city: 'New Delhi', latitude: 28.6139, longitude: 77.209, ipPrefix: '103.25.66' },
  { country: 'USA', state: 'New York', city: 'New York', latitude: 40.7128, longitude: -74.006, ipPrefix: '104.28.11' },
  { country: 'USA', state: 'California', city: 'Los Angeles', latitude: 34.0522, longitude: -118.2437, ipPrefix: '104.29.44' },
  { country: 'Russia', state: 'Moscow', city: 'Moscow', latitude: 55.7558, longitude: 37.6173, ipPrefix: '91.108.12' },
  { country: 'Nigeria', state: 'Lagos', city: 'Lagos', latitude: 6.5244, longitude: 3.3792, ipPrefix: '105.112.9' },
  { country: 'China', state: 'Beijing', city: 'Beijing', latitude: 39.9042, longitude: 116.4074, ipPrefix: '119.28.77' },
  { country: 'Germany', state: 'Berlin', city: 'Berlin', latitude: 52.52, longitude: 13.405, ipPrefix: '85.214.33' },
  { country: 'UK', state: 'England', city: 'London', latitude: 51.5074, longitude: -0.1278, ipPrefix: '81.2.69' },
];

const DEVICES = [
  { device: 'Dell Latitude 5420 (Laptop)', os: 'Windows 11', browser: 'Chrome 126' },
  { device: 'MacBook Pro 14"', os: 'macOS Sonoma', browser: 'Safari 17' },
  { device: 'HP EliteBook 840', os: 'Windows 10', browser: 'Edge 125' },
  { device: 'iPhone 14', os: 'iOS 17', browser: 'Safari Mobile' },
  { device: 'Samsung Galaxy S23', os: 'Android 14', browser: 'Chrome Mobile' },
  { device: 'Unknown Linux Workstation', os: 'Ubuntu 22.04', browser: 'Firefox 127' },
];

const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const randomIpFromPrefix = (prefix) => `${prefix}.${Math.floor(Math.random() * 254) + 1}`;

const HOME_LOCATION = LOCATIONS[0]; // Bengaluru, Karnataka, India used as default "home" baseline location
const HOME_DEVICE = DEVICES[0];

const getRandomLocation = (excludeCountry) => {
  const pool = excludeCountry ? LOCATIONS.filter((l) => l.country !== excludeCountry) : LOCATIONS;
  return randomFrom(pool);
};

const getRandomDevice = (excludeDevice) => {
  const pool = excludeDevice ? DEVICES.filter((d) => d.device !== excludeDevice) : DEVICES;
  return randomFrom(pool);
};

module.exports = {
  LOCATIONS,
  DEVICES,
  HOME_LOCATION,
  HOME_DEVICE,
  randomFrom,
  randomIpFromPrefix,
  getRandomLocation,
  getRandomDevice,
};
