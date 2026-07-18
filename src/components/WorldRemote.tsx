'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bluetooth, BluetoothSearching, Tv, Speaker, X, WifiOff,
  Volume2, VolumeX, Plus, Minus, Power, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  SkipForward, SkipBack, Play, Pause, Fan, Snowflake, Sun, Wind,
  MonitorSpeaker, Gamepad2, Lightbulb, Watch, Headphones, Mouse, Keyboard, Smartphone,
  RefreshCw, Unplug, Zap, BatteryMedium, Home, ArrowLeft, Info, Cpu, Tag, Hash,
  Eye, Send, Bell, BellOff, ChevronRight as ChevRight, Copy, Check, Terminal
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// BLE PROTOCOL CONSTANTS
// ═══════════════════════════════════════════════════════════════

/** Standard BLE GATT Service UUIDs for device probing */
const BLE_SERVICE = {
  GENERIC_ACCESS:       0x1800,
  GENERIC_ATTRIBUTE:    0x1801,
  DEVICE_INFORMATION:   0x180A,
  BATTERY:              0x180F,
  HEART_RATE:           0x180D,
  BLOOD_PRESSURE:       0x1810,
  HEALTH_THERMOMETER:   0x1809,
  HID:                  0x1812,  // Human Interface Device (keyboard/mouse/gamepad)
  RUNNING_SPEED:        0x1814,
  CYCLING_SPEED:        0x1816,
  CYCLING_POWER:        0x1818,
  ENVIRONMENTAL_SENSING:0x181A,
  BODY_COMPOSITION:     0x181B,
  USER_DATA:            0x181C,
  WEIGHT_SCALE:         0x181D,
  BOND_MANAGEMENT:      0x181E,
  GLUCOSE:              0x1808,
  TX_POWER:             0x1804,
  LINK_LOSS:            0x1803,
  IMMEDIATE_ALERT:      0x1802,
  CURRENT_TIME:         0x1805,
  PHONE_ALERT_STATUS:   0x180E,
  ALERT_NOTIFICATION:   0x1811,
  AUTOMATION_IO:        0x1815,
  AUDIO_INPUT_CONTROL:  0xFE2C, // Common for audio devices
  MEDIA_CONTROL:        0x1848,
} as const;

/** Standard BLE GATT Characteristic UUIDs */
const BLE_CHAR = {
  DEVICE_NAME:          0x2A00,
  APPEARANCE:           0x2A01,
  PERIPHERAL_PRIVACY:   0x2A02,
  MANUFACTURER_NAME:    0x2A29,
  MODEL_NUMBER:         0x2A24,
  SERIAL_NUMBER:        0x2A25,
  HARDWARE_REVISION:    0x2A27,
  FIRMWARE_REVISION:    0x2A26,
  SOFTWARE_REVISION:    0x2A28,
  SYSTEM_ID:            0x2A23,
  PNP_ID:               0x2A50,
  BATTERY_LEVEL:        0x2A19,
} as const;

/** BLE GAP Appearance values → device type mapping
 *  From Bluetooth SIG Assigned Numbers:
 *  https://www.bluetooth.com/specifications/assigned-numbers/ */
const APPEARANCE_MAP: Record<number, DeviceType> = {
  // Phone (0x0040–0x007F)
  0x0040: 'phone',
  // Computer (0x0080–0x00BF)
  0x0080: 'unknown', // generic computer
  // Watch (0x00C0–0x00FF)
  0x00C0: 'wearable', 0x00C1: 'wearable', 0x00C2: 'wearable',
  // Display (0x0140–0x017F) → TV/Monitor
  0x0140: 'tv',
  // Remote Control (0x0180–0x01BF)
  0x0180: 'unknown',
  // Thermometer (0x0300)
  0x0300: 'ac',
  // HID (0x03C0–0x03FF)
  0x03C0: 'unknown', // generic HID
  0x03C1: 'keyboard',
  0x03C2: 'mouse',
  0x03C3: 'unknown', // joystick
  0x03C4: 'gamepad',
  0x03C5: 'unknown', // digitizer
  // Pulse Oximeter (0x0C40)
  0x0C40: 'wearable',
  // Outdoor Sports (0x1440–)
  0x1440: 'wearable',
  // Audio Sink (0x0841–0x0842)
  0x0841: 'speaker',  // Standalone Speaker
  0x0842: 'headphones', // Headphones
  0x0843: 'headphones', // Earbuds
  // Generic Audio
  0x0840: 'speaker',
};

/** Classify using BLE Appearance category ranges */
function classifyByAppearance(appearance: number): DeviceType | null {
  // Direct match first
  if (APPEARANCE_MAP[appearance]) return APPEARANCE_MAP[appearance];

  // Range-based classification
  const cat = appearance & 0xFFC0; // category bits (upper 10 bits)
  if (cat >= 0x0040 && cat <= 0x007F) return 'phone';
  if (cat >= 0x00C0 && cat <= 0x00FF) return 'wearable';  // Watch
  if (cat >= 0x0140 && cat <= 0x017F) return 'tv';         // Display
  if (cat >= 0x0300 && cat <= 0x033F) return 'ac';         // Thermometer
  if (cat >= 0x03C0 && cat <= 0x03FF) {                    // HID subtype
    const sub = appearance & 0x003F;
    if (sub === 1) return 'keyboard';
    if (sub === 2) return 'mouse';
    if (sub === 4) return 'gamepad';
    return 'unknown';
  }
  if (cat >= 0x0840 && cat <= 0x087F) return 'speaker';    // Audio
  if (cat >= 0x0940 && cat <= 0x097F) return 'wearable';   // Outdoor Sports
  return null;
}

/** Classify based on which BLE services the device exposes */
function classifyByServices(serviceUUIDs: number[]): DeviceType | null {
  const has = (uuid: number) => serviceUUIDs.includes(uuid);

  if (has(BLE_SERVICE.MEDIA_CONTROL) || has(BLE_SERVICE.AUDIO_INPUT_CONTROL)) return 'speaker';
  if (has(BLE_SERVICE.HID)) {
    // HID could be keyboard, mouse, or gamepad — return generic, name will refine
    return 'gamepad'; // most common BLE HID is game controllers
  }
  if (has(BLE_SERVICE.HEART_RATE) || has(BLE_SERVICE.RUNNING_SPEED) ||
      has(BLE_SERVICE.CYCLING_SPEED) || has(BLE_SERVICE.CYCLING_POWER)) return 'wearable';
  if (has(BLE_SERVICE.ENVIRONMENTAL_SENSING) || has(BLE_SERVICE.HEALTH_THERMOMETER)) return 'ac';
  if (has(BLE_SERVICE.BLOOD_PRESSURE) || has(BLE_SERVICE.GLUCOSE) ||
      has(BLE_SERVICE.BODY_COMPOSITION) || has(BLE_SERVICE.WEIGHT_SCALE)) return 'wearable';
  if (has(BLE_SERVICE.PHONE_ALERT_STATUS)) return 'phone';
  return null;
}

/** Classify by device name (fallback) */
function classifyByName(name: string): DeviceType {
  const n = name.toLowerCase();
  if (/\btv\b|samsung.*(ue|qn|un)|lg.*(oled|nano|uk|um)|sony.*(bravia|kd)|roku|fire.?stick|chromecast|shield|apple.?tv|vizio|tcl|hisense/i.test(n)) return 'tv';
  if (/speaker|soundbar|bose.*(sound|revolve|micro|portable)|jbl.*(flip|charge|go|xtreme|partybox|pulse)|sonos|marshall|harman.?kardon|bang.?olufsen|echo.?dot|echo.?show|homepod|ue.?(boom|megaboom|wonderboom)|pill|anker.?soundcore|tribit|sony.?(srs|xb)|beats.?pill/i.test(n)) return 'speaker';
  if (/\bac\b|air.?con|daikin|mitsubishi.?electric|carrier|trane|gree|haier|fujitsu|panasonic.?cs|midea|hisense.?ac|thermostat|nest|ecobee|honeywell|sensibo|cielo|ambi.?climate|tado/i.test(n)) return 'ac';
  if (/bulb|light|hue|lifx|wiz|nanoleaf|govee|yeelight|lamp|led.?strip|tradfri|sengled|feit|kasa|tuya|magic.?home/i.test(n)) return 'light';
  if (/\bwatch\b|band|fitbit|garmin|mi.?band|galaxy.?watch|apple.?watch|whoop|amazfit|polar|suunto|coros|withings|huawei.?band|vivosmart|vivoactive|fenix|forerunner/i.test(n)) return 'wearable';
  if (/headphone|airpod|buds|earphone|earbud|wh-1000|wf-1000|qc.?[234]|qc.?ultra|momentum|px[78]|aeroex|galaxy.?buds|freebuds|jabra.?elite|nothing.?ear|beats.?(solo|studio|flex|fit)|sennheiser|bowers|b&w|b.?&.?o|sony.?wh|sony.?wf|anc/i.test(n)) return 'headphones';
  if (/gamepad|controller|xbox|playstation|dualsense|dualshock|pro.?controller|joy.?con|stadia|luna|8bitdo|steelseries.?stratus|razer.?(kishi|wolverine)/i.test(n)) return 'gamepad';
  if (/keyboard|keychron|hhkb|nuphy|logitech.?(k[0-9]|mx.?keys|craft)|anne.?pro|ducky|royal.?kludge|rk[0-9]|tofu|gmmk|corsair.?k/i.test(n)) return 'keyboard';
  if (/mouse|mx.?master|mx.?anywhere|trackpad|logitech.?(m[0-9]|g.?pro|gpx|g502)|razer.?(deathadder|viper|basilisk|orochi)|pulsar|zowie|endgame/i.test(n)) return 'mouse';
  if (/phone|iphone|galaxy.?s|galaxy.?a|galaxy.?z|pixel|oneplus|xiaomi|redmi|poco|oppo|vivo|huawei.?p|huawei.?mate|nothing.?phone/i.test(n)) return 'phone';
  return 'unknown';
}

// ── Types ──
interface DeviceInfo {
  manufacturer?: string;
  model?: string;
  serial?: string;
  hardware?: string;
  firmware?: string;
  software?: string;
  appearance?: number;
  appearanceLabel?: string;
  detectedServices: string[];
  classifiedBy: 'appearance' | 'service' | 'name' | 'pnp';
}

interface DiscoveredDevice {
  id: string;
  name: string;
  type: DeviceType;
  connected: boolean;
  battery?: number;
  deviceInfo?: DeviceInfo;
  bluetoothDevice?: BluetoothDevice;
  server?: BluetoothRemoteGATTServer;
  characteristics?: Map<string, BluetoothRemoteGATTCharacteristic>;
  probing?: boolean;
}

type DeviceType = 'tv' | 'speaker' | 'ac' | 'light' | 'wearable' | 'headphones' | 'gamepad' | 'keyboard' | 'mouse' | 'phone' | 'unknown';
type RemoteView = 'home' | 'tv' | 'speaker' | 'ac' | 'explorer';

/** Well-known GATT UUID names for the explorer */
const KNOWN_UUIDS: Record<number, string> = {
  0x1800: 'Generic Access', 0x1801: 'Generic Attribute', 0x180A: 'Device Information',
  0x180F: 'Battery', 0x180D: 'Heart Rate', 0x1810: 'Blood Pressure', 0x1809: 'Health Thermometer',
  0x1812: 'HID', 0x1814: 'Running Speed', 0x1816: 'Cycling Speed', 0x1818: 'Cycling Power',
  0x181A: 'Environmental Sensing', 0x181B: 'Body Composition', 0x181C: 'User Data',
  0x181D: 'Weight Scale', 0x1802: 'Immediate Alert', 0x1803: 'Link Loss', 0x1804: 'TX Power',
  0x1805: 'Current Time', 0x180E: 'Phone Alert Status', 0x1811: 'Alert Notification',
  0x1815: 'Automation IO', 0x1848: 'Media Control',
  // Characteristics
  0x2A00: 'Device Name', 0x2A01: 'Appearance', 0x2A19: 'Battery Level',
  0x2A24: 'Model Number', 0x2A25: 'Serial Number', 0x2A26: 'Firmware Revision',
  0x2A27: 'Hardware Revision', 0x2A28: 'Software Revision', 0x2A29: 'Manufacturer Name',
  0x2A23: 'System ID', 0x2A50: 'PnP ID', 0x2A37: 'Heart Rate Measurement',
  0x2A38: 'Body Sensor Location', 0x2A39: 'Heart Rate Control Point',
  0x2A6E: 'Temperature', 0x2A6F: 'Humidity', 0x2A6D: 'Pressure',
  0x2A6C: 'Elevation', 0x2A77: 'Irradiance',
};

function resolveUUID(uuid: string): string {
  // Standard 16-bit UUIDs are formatted as 0000XXXX-0000-1000-8000-00805f9b34fb
  const match = uuid.match(/^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/i);
  if (match) {
    const short = parseInt(match[1], 16);
    return KNOWN_UUIDS[short] || `0x${match[1].toUpperCase()}`;
  }
  // Custom UUID — show shortened
  return uuid.length > 8 ? uuid.slice(0, 8) + '…' : uuid;
}

interface GATTServiceInfo {
  uuid: string;
  name: string;
  characteristics: GATTCharInfo[];
}
interface GATTCharInfo {
  uuid: string;
  name: string;
  properties: { read: boolean; write: boolean; writeNoResp: boolean; notify: boolean; indicate: boolean };
  value?: string;
  rawHex?: string;
  notifying?: boolean;
  characteristic?: BluetoothRemoteGATTCharacteristic;
}

function getDeviceIcon(type: DeviceType) {
  const map: Record<DeviceType, typeof Bluetooth> = {
    tv: Tv, speaker: Speaker, ac: Fan, light: Lightbulb, wearable: Watch,
    headphones: Headphones, gamepad: Gamepad2, keyboard: Keyboard, mouse: Mouse,
    phone: Smartphone, unknown: Bluetooth,
  };
  return map[type];
}

function getTypeLabel(type: DeviceType): string {
  const map: Record<DeviceType, string> = {
    tv: 'Television', speaker: 'Speaker', ac: 'Climate / AC', light: 'Smart Light',
    wearable: 'Wearable', headphones: 'Headphones', gamepad: 'Game Controller',
    keyboard: 'Keyboard', mouse: 'Mouse', phone: 'Phone', unknown: 'Unknown Device',
  };
  return map[type];
}

/** Read a string characteristic safely */
async function readStringChar(service: BluetoothRemoteGATTService, uuid: number): Promise<string | undefined> {
  try {
    const char = await service.getCharacteristic(uuid);
    const val = await char.readValue();
    return new TextDecoder().decode(val.buffer);
  } catch { return undefined; }
}

// ── Animated press button ──
function PressButton({ children, onClick, className, title, disabled }: {
  children: React.ReactNode; onClick?: () => void; className?: string; title?: string; disabled?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.05 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      onClick={onClick} className={className} title={title} disabled={disabled}
    >{children}</motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function WorldRemote({ onClose }: { onClose?: () => void }) {
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [activeDevice, setActiveDevice] = useState<DiscoveredDevice | null>(null);
  const [remoteView, setRemoteView] = useState<RemoteView>('home');
  const [btSupported, setBtSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [showDeviceInfo, setShowDeviceInfo] = useState<string | null>(null);
  const [explorerServices, setExplorerServices] = useState<GATTServiceInfo[]>([]);
  const [explorerLoading, setExplorerLoading] = useState(false);
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [writeInput, setWriteInput] = useState<Record<string, string>>({});
  const [copiedChar, setCopiedChar] = useState<string | null>(null);

  // Remote state
  const [volume, setVolume] = useState(50);
  const [acTemp, setAcTemp] = useState(22);
  const [acMode, setAcMode] = useState<'cool' | 'heat' | 'fan' | 'auto'>('cool');
  const [acFanSpeed, setAcFanSpeed] = useState<'low' | 'med' | 'high' | 'auto'>('auto');
  const [acPower, setAcPower] = useState(false);
  const [tvPower, setTvPower] = useState(true);
  const [tvChannel, setTvChannel] = useState(1);
  const [speakerPlaying, setSpeakerPlaying] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const actionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && !navigator.bluetooth) setBtSupported(false);
    return () => { if (actionTimeout.current) clearTimeout(actionTimeout.current); };
  }, []);

  const flash = useCallback((action: string) => {
    setLastAction(action);
    if (actionTimeout.current) clearTimeout(actionTimeout.current);
    actionTimeout.current = setTimeout(() => setLastAction(null), 800);
  }, []);

  // ══════════════════════════════════════════════════════════
  // CORE: Probe device via GATT to identify type & read info
  // ══════════════════════════════════════════════════════════
  const probeDevice = useCallback(async (device: DiscoveredDevice): Promise<DiscoveredDevice> => {
    if (!device.bluetoothDevice?.gatt) return device;

    const info: DeviceInfo = { detectedServices: [], classifiedBy: 'name' };
    let detectedType: DeviceType | null = null;
    let server: BluetoothRemoteGATTServer | undefined;
    let battery: number | undefined;
    const chars = new Map<string, BluetoothRemoteGATTCharacteristic>();

    try {
      server = await device.bluetoothDevice.gatt.connect();
      if (!server) return device;

      // ── 1. Read Generic Access → Appearance ──
      try {
        const gas = await server.getPrimaryService(BLE_SERVICE.GENERIC_ACCESS);
        try {
          const appChar = await gas.getCharacteristic(BLE_CHAR.APPEARANCE);
          const appVal = await appChar.readValue();
          const appearance = appVal.getUint16(0, true); // little-endian
          info.appearance = appearance;

          // Map appearance to human label
          const cat = (appearance >> 6) & 0x3FF;
          const labels: Record<number, string> = {
            0: 'Unknown', 1: 'Phone', 2: 'Computer', 3: 'Watch', 4: 'Clock',
            5: 'Display', 6: 'Remote Control', 7: 'Eyeglasses', 8: 'Tag', 9: 'Keyring',
            10: 'Media Player', 15: 'HID', 33: 'Pulse Oximeter', 34: 'Weight Scale',
            36: 'Outdoor Sports', 48: 'Audio Sink', 49: 'Audio Source',
          };
          info.appearanceLabel = labels[cat] || `Category ${cat}`;

          const typeFromAppearance = classifyByAppearance(appearance);
          if (typeFromAppearance && typeFromAppearance !== 'unknown') {
            detectedType = typeFromAppearance;
            info.classifiedBy = 'appearance';
          }
        } catch { /* no appearance characteristic */ }

        // Also try reading device name from GATT (may differ from advertising name)
        try {
          const nameChar = await gas.getCharacteristic(BLE_CHAR.DEVICE_NAME);
          const nameVal = await nameChar.readValue();
          const gattName = new TextDecoder().decode(nameVal.buffer);
          if (gattName && gattName.length > 0 && gattName !== device.name) {
            // GATT name is often more descriptive
            device = { ...device, name: gattName };
          }
        } catch {}
      } catch { info.detectedServices.push('No Generic Access'); }

      // ── 2. Read Device Information Service ──
      try {
        const dis = await server.getPrimaryService(BLE_SERVICE.DEVICE_INFORMATION);
        info.detectedServices.push('Device Information');

        info.manufacturer = await readStringChar(dis, BLE_CHAR.MANUFACTURER_NAME);
        info.model        = await readStringChar(dis, BLE_CHAR.MODEL_NUMBER);
        info.serial       = await readStringChar(dis, BLE_CHAR.SERIAL_NUMBER);
        info.hardware     = await readStringChar(dis, BLE_CHAR.HARDWARE_REVISION);
        info.firmware     = await readStringChar(dis, BLE_CHAR.FIRMWARE_REVISION);
        info.software     = await readStringChar(dis, BLE_CHAR.SOFTWARE_REVISION);

        // ── PnP ID: contains vendor/product IDs ──
        try {
          const pnp = await dis.getCharacteristic(BLE_CHAR.PNP_ID);
          const pnpVal = await pnp.readValue();
          const vendorSource = pnpVal.getUint8(0); // 1=Bluetooth SIG, 2=USB
          const vendorId = pnpVal.getUint16(1, true);
          const productId = pnpVal.getUint16(3, true);

          // Use manufacturer name or vendor for classification boost
          const mfr = (info.manufacturer || '').toLowerCase();
          if (/bose|jbl|sonos|harman|marshall|bang|olufsen|klipsch|denon|marantz|yamaha|pioneer|onkyo|altec|ultimate.?ears/i.test(mfr)) {
            if (!detectedType) { detectedType = 'speaker'; info.classifiedBy = 'pnp'; }
          }
          if (/samsung|lg|sony|vizio|tcl|hisense|panasonic|sharp|philips|toshiba/i.test(mfr)) {
            if (!detectedType) { detectedType = 'tv'; info.classifiedBy = 'pnp'; }
          }
          if (/apple|google|samsung|huawei|xiaomi|oneplus|oppo|vivo|motorola|nokia/i.test(mfr)) {
            // These make many things — don't override if already classified
          }
          if (/logitech|corsair|razer|steelseries/i.test(mfr)) {
            if (!detectedType) { detectedType = 'mouse'; info.classifiedBy = 'pnp'; }
          }
          if (/fitbit|garmin|polar|suunto|coros|whoop|withings/i.test(mfr)) {
            if (!detectedType) { detectedType = 'wearable'; info.classifiedBy = 'pnp'; }
          }
        } catch { /* no PnP ID */ }
      } catch { /* no Device Information service */ }

      // ── 3. Probe for specific services ──
      const probedServiceUUIDs: number[] = [];
      const servicesToProbe = [
        BLE_SERVICE.BATTERY, BLE_SERVICE.HEART_RATE, BLE_SERVICE.HID,
        BLE_SERVICE.RUNNING_SPEED, BLE_SERVICE.CYCLING_SPEED,
        BLE_SERVICE.ENVIRONMENTAL_SENSING, BLE_SERVICE.HEALTH_THERMOMETER,
        BLE_SERVICE.BLOOD_PRESSURE, BLE_SERVICE.GLUCOSE,
        BLE_SERVICE.BODY_COMPOSITION, BLE_SERVICE.WEIGHT_SCALE,
        BLE_SERVICE.PHONE_ALERT_STATUS, BLE_SERVICE.MEDIA_CONTROL,
        BLE_SERVICE.AUTOMATION_IO,
      ];

      for (const svc of servicesToProbe) {
        try {
          const s = await server.getPrimaryService(svc);
          probedServiceUUIDs.push(svc);
          const svcName = Object.entries(BLE_SERVICE).find(([, v]) => v === svc)?.[0] || `0x${svc.toString(16)}`;
          info.detectedServices.push(svcName.replace(/_/g, ' '));

          // Read battery if found
          if (svc === BLE_SERVICE.BATTERY) {
            try {
              const bc = await s.getCharacteristic(BLE_CHAR.BATTERY_LEVEL);
              battery = (await bc.readValue()).getUint8(0);
              chars.set('battery', bc);
            } catch {}
          }
        } catch { /* service not available */ }
      }

      // Service-based classification (only if appearance didn't already determine type)
      if (!detectedType || detectedType === 'unknown') {
        const serviceType = classifyByServices(probedServiceUUIDs);
        if (serviceType) {
          detectedType = serviceType;
          info.classifiedBy = 'service';
        }
      }

      // ── 4. Name-based classification (final fallback) ──
      if (!detectedType || detectedType === 'unknown') {
        detectedType = classifyByName(device.name);
        if (detectedType !== 'unknown') info.classifiedBy = 'name';
      }

      // Also try classifying by manufacturer name if still unknown
      if (detectedType === 'unknown' && info.manufacturer) {
        const mfrType = classifyByName(info.manufacturer + ' ' + (info.model || ''));
        if (mfrType !== 'unknown') {
          detectedType = mfrType;
          info.classifiedBy = 'name';
        }
      }

      // Disconnect after probing (user can reconnect intentionally)
      server.disconnect();

    } catch (e: any) {
      // Couldn't probe — fall back to name classification
      if (!detectedType) detectedType = classifyByName(device.name);
    }

    return {
      ...device,
      type: detectedType || classifyByName(device.name),
      deviceInfo: info,
      battery,
      characteristics: chars,
      connected: false,
      probing: false,
    };
  }, []);

  // ══════════════════════════════════════════════════════════
  // SCAN: Request device → auto-probe
  // ══════════════════════════════════════════════════════════
  const scanDevices = useCallback(async () => {
    if (!navigator.bluetooth) { setError('Web Bluetooth not supported. Use Chrome or Edge.'); return; }
    setScanning(true); setError(null);
    try {
      // Request all services we might probe (must be listed as optionalServices)
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          BLE_SERVICE.GENERIC_ACCESS, BLE_SERVICE.DEVICE_INFORMATION, BLE_SERVICE.BATTERY,
          BLE_SERVICE.HEART_RATE, BLE_SERVICE.HID, BLE_SERVICE.RUNNING_SPEED,
          BLE_SERVICE.CYCLING_SPEED, BLE_SERVICE.ENVIRONMENTAL_SENSING,
          BLE_SERVICE.HEALTH_THERMOMETER, BLE_SERVICE.BLOOD_PRESSURE, BLE_SERVICE.GLUCOSE,
          BLE_SERVICE.BODY_COMPOSITION, BLE_SERVICE.WEIGHT_SCALE,
          BLE_SERVICE.PHONE_ALERT_STATUS, BLE_SERVICE.MEDIA_CONTROL, BLE_SERVICE.AUTOMATION_IO,
        ],
      });

      if (device) {
        // Check if already discovered
        if (devices.find(d => d.id === device.id)) {
          setScanning(false); return;
        }

        const rawDevice: DiscoveredDevice = {
          id: device.id,
          name: device.name || `Device ${device.id.slice(0, 8)}`,
          type: 'unknown',
          connected: false,
          bluetoothDevice: device,
          probing: true,
        };

        // Add immediately with "probing" state
        setDevices(prev => [...prev, rawDevice]);

        // Auto-probe the device to identify it
        const probedDevice = await probeDevice(rawDevice);
        setDevices(prev => prev.map(d => d.id === device.id ? probedDevice : d));
      }
    } catch (e: any) {
      if (e.name !== 'NotFoundError') setError(e.message || 'Scan failed');
    } finally { setScanning(false); }
  }, [devices, probeDevice]);

  // ── Connect for control ──
  const connectDevice = useCallback(async (device: DiscoveredDevice) => {
    if (!device.bluetoothDevice) return;
    setConnecting(device.id); setError(null);
    try {
      const server = await device.bluetoothDevice.gatt?.connect();
      if (!server) throw new Error('GATT connect failed');
      const chars = device.characteristics || new Map();
      let battery = device.battery;

      // Re-read battery on connect
      try {
        const bs = await server.getPrimaryService(BLE_SERVICE.BATTERY);
        const bc = await bs.getCharacteristic(BLE_CHAR.BATTERY_LEVEL);
        battery = (await bc.readValue()).getUint8(0);
        chars.set('battery', bc);
      } catch {}

      const updated = { ...device, connected: true, server, battery, characteristics: chars };
      setDevices(prev => prev.map(d => d.id === device.id ? updated : d));
      setActiveDevice(updated);

      if (device.type === 'tv') setRemoteView('tv');
      else if (device.type === 'speaker' || device.type === 'headphones') setRemoteView('speaker');
      else if (device.type === 'ac') setRemoteView('ac');
    } catch (e: any) { setError(`Connect failed: ${e.message}`); }
    finally { setConnecting(null); }
  }, []);

  // ── Disconnect ──
  const disconnectDevice = useCallback(async (device: DiscoveredDevice) => {
    device.bluetoothDevice?.gatt?.connected && device.bluetoothDevice.gatt.disconnect();
    setDevices(prev => prev.map(d => d.id === device.id ? { ...d, connected: false, server: undefined } : d));
    if (activeDevice?.id === device.id) { setActiveDevice(null); setRemoteView('home'); }
  }, [activeDevice]);

  // ── Explore GATT services on a connected device ──
  const exploreDevice = useCallback(async (device: DiscoveredDevice) => {
    if (!device.bluetoothDevice?.gatt?.connected) {
      // Try to reconnect
      try {
        await device.bluetoothDevice?.gatt?.connect();
      } catch { setError('Device not connected. Pair first.'); return; }
    }
    const server = device.bluetoothDevice?.gatt;
    if (!server) { setError('No GATT connection.'); return; }

    setActiveDevice(device);
    setRemoteView('explorer');
    setExplorerLoading(true);
    setExplorerServices([]);
    setExpandedService(null);

    try {
      const services = await server.getPrimaryServices();
      const result: GATTServiceInfo[] = [];

      for (const svc of services) {
        const svcName = resolveUUID(svc.uuid);
        const charInfos: GATTCharInfo[] = [];

        try {
          const chars = await svc.getCharacteristics();
          for (const ch of chars) {
            const charName = resolveUUID(ch.uuid);
            const props = ch.properties;
            let value: string | undefined;
            let rawHex: string | undefined;

            // Auto-read readable characteristics
            if (props.read) {
              try {
                const val = await ch.readValue();
                const bytes = new Uint8Array(val.buffer);
                rawHex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
                try {
                  const text = new TextDecoder().decode(val.buffer);
                  value = /^[\x20-\x7E\n\r\t]+$/.test(text) ? text : rawHex;
                } catch { value = rawHex; }
              } catch { /* can't read during enumeration */ }
            }

            charInfos.push({
              uuid: ch.uuid,
              name: charName,
              properties: {
                read: props.read,
                write: props.write,
                writeNoResp: props.writeWithoutResponse,
                notify: props.notify,
                indicate: props.indicate,
              },
              value,
              rawHex,
              characteristic: ch,
            });
          }
        } catch { /* can't enumerate chars */ }

        result.push({ uuid: svc.uuid, name: svcName, characteristics: charInfos });
      }

      setExplorerServices(result);
      // Auto-expand first service
      if (result.length > 0) setExpandedService(result[0].uuid);
    } catch (e: any) {
      setError(`Explore failed: ${e.message}`);
    } finally {
      setExplorerLoading(false);
    }
  }, []);

  const connectedCount = devices.filter(d => d.connected).length;

  // ═══ RENDER ═══
  return (
    <div className="glass-panel p-0 w-full max-h-[600px] flex flex-col overflow-hidden osiris-glow" style={{ minWidth: 280 }}>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-primary)]">
        <div className="flex items-center gap-2">
          {remoteView !== 'home' ? (
            <PressButton onClick={() => { setRemoteView('home'); setActiveDevice(null); }} className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
              <ArrowLeft className="w-3 h-3 text-[var(--text-muted)]" />
            </PressButton>
          ) : (
            <div className="w-6 h-6 rounded-lg bg-[var(--cyan-primary)]/10 flex items-center justify-center">
              <Bluetooth className="w-3 h-3 text-[var(--cyan-primary)]" />
            </div>
          )}
          <div>
            <h3 className="text-[10px] font-mono font-bold tracking-wider text-[var(--text-primary)]">
              {remoteView === 'home' ? 'WORLD REMOTE' : remoteView === 'tv' ? 'TV REMOTE' : remoteView === 'speaker' ? 'SPEAKER' : remoteView === 'explorer' ? 'GATT EXPLORER' : 'CLIMATE'}
            </h3>
            <span className="text-[7px] font-mono text-[var(--text-muted)] tracking-widest">
              {activeDevice ? activeDevice.name : connectedCount > 0 ? `${connectedCount} CONNECTED` : 'TAP TO START'}
            </span>
          </div>
        </div>
        {onClose && (
          <PressButton onClick={onClose} className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/5 transition-colors">
            <X className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          </PressButton>
        )}
      </div>

      {/* Action Toast */}
      <AnimatePresence>
        {lastAction && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="absolute top-12 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 rounded-lg bg-[var(--cyan-primary)]/20 border border-[var(--cyan-primary)]/30 backdrop-blur-sm">
            <span className="text-[8px] font-mono font-bold text-[var(--cyan-primary)] tracking-wider">{lastAction}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 overflow-y-auto styled-scrollbar p-3 relative">
        <AnimatePresence mode="wait">

          {/* ════ HOME ════ */}
          {remoteView === 'home' && (
            <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -20 }}>

              {!btSupported && (
                <div className="glass-panel-sm p-2.5 mb-3 border-[#FF3D3D]/20">
                  <div className="flex items-center gap-2">
                    <WifiOff className="w-3 h-3 text-[#FF3D3D] shrink-0" />
                    <span className="text-[8px] font-mono text-[#FF3D3D] leading-relaxed">Bluetooth not available. Use Chrome or Edge desktop.</span>
                  </div>
                </div>
              )}

              {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel-sm p-2 mb-3 border-[#FF3D3D]/20">
                  <p className="text-[8px] font-mono text-[#FF3D3D]">{error}</p>
                </motion.div>
              )}

              {/* Quick Remotes */}
              <div className="mb-3">
                <span className="text-[7px] font-mono text-[var(--text-muted)] tracking-widest block mb-2 uppercase">Quick Controls</span>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { view: 'tv' as RemoteView, icon: Tv, label: 'TV', color: '#00E6FF', bg: 'rgba(0,230,255,0.08)' },
                    { view: 'speaker' as RemoteView, icon: Speaker, label: 'Audio', color: '#D4AF37', bg: 'rgba(212,175,55,0.08)' },
                    { view: 'ac' as RemoteView, icon: Snowflake, label: 'Climate', color: '#39FF14', bg: 'rgba(57,255,20,0.08)' },
                  ]).map(p => (
                    <PressButton key={p.view} onClick={() => setRemoteView(p.view)}
                      className="relative p-4 rounded-xl flex flex-col items-center gap-2 transition-all border border-transparent hover:border-white/5">
                      <div className="absolute inset-0 rounded-xl" style={{ background: p.bg }} />
                      <p.icon className="w-6 h-6 relative z-10" style={{ color: p.color }} />
                      <span className="text-[8px] font-mono font-bold tracking-wider relative z-10" style={{ color: p.color }}>{p.label}</span>
                    </PressButton>
                  ))}
                </div>
              </div>

              {/* Scan Button */}
              <PressButton onClick={scanDevices} disabled={scanning || !btSupported}
                className="w-full glass-panel-sm p-2.5 flex items-center justify-center gap-2 mb-3 hover:bg-white/5 transition-all disabled:opacity-30">
                {scanning ? <BluetoothSearching className="w-3.5 h-3.5 text-[var(--cyan-primary)] animate-pulse" />
                  : <Bluetooth className="w-3.5 h-3.5 text-[var(--cyan-primary)]" />}
                <span className="text-[8px] font-mono font-bold tracking-wider text-[var(--cyan-primary)]">
                  {scanning ? 'SCANNING...' : 'SCAN BLUETOOTH DEVICES'}
                </span>
              </PressButton>

              {/* Device List */}
              {devices.length > 0 && (
                <div>
                  <span className="text-[7px] font-mono text-[var(--text-muted)] tracking-widest block mb-1.5 uppercase">
                    Nearby ({devices.length})
                  </span>
                  <div className="space-y-1.5">
                    {devices.map(device => {
                      const DevIcon = getDeviceIcon(device.type);
                      const isConnecting = connecting === device.id;
                      const isInfoOpen = showDeviceInfo === device.id;
                      return (
                        <motion.div key={device.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                          <div className={`glass-panel-sm p-2 flex items-center gap-2 transition-all ${device.connected ? 'border-[var(--cyan-primary)]/20' : ''}`}>
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${device.connected ? 'bg-[var(--cyan-primary)]/15' : 'bg-white/5'}`}>
                              {device.probing || isConnecting ? (
                                <div className="w-3 h-3 border-2 border-[var(--cyan-primary)] border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <DevIcon className="w-3.5 h-3.5" style={{ color: device.connected ? 'var(--cyan-primary)' : 'var(--text-muted)' }} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[9px] font-mono font-bold text-[var(--text-primary)] truncate">{device.name}</div>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                {device.probing ? (
                                  <span className="text-[7px] font-mono text-[var(--cyan-primary)] tracking-wider animate-pulse">IDENTIFYING...</span>
                                ) : device.connected ? (
                                  <span className="text-[7px] font-mono text-[var(--alert-green)] tracking-wider">● PAIRED</span>
                                ) : (
                                  <span className="text-[7px] font-mono text-[var(--text-muted)] tracking-wider">{getTypeLabel(device.type)}</span>
                                )}
                                {device.battery != null && (
                                  <span className="flex items-center gap-0.5 text-[7px] font-mono text-[var(--text-muted)]">
                                    <BatteryMedium className="w-2.5 h-2.5" />{device.battery}%
                                  </span>
                                )}
                                {device.deviceInfo?.classifiedBy && !device.probing && (
                                  <span className="text-[6px] font-mono px-1 py-0.5 rounded bg-white/5 text-[var(--text-muted)] tracking-wider">
                                    via {device.deviceInfo.classifiedBy.toUpperCase()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              {device.deviceInfo && (
                                <PressButton onClick={() => setShowDeviceInfo(isInfoOpen ? null : device.id)}
                                  className="px-1 py-1 rounded-md hover:bg-white/5 transition-colors">
                                  <Info className="w-2.5 h-2.5 text-[var(--text-muted)]" />
                                </PressButton>
                              )}
                              {device.connected && (
                                <PressButton onClick={() => exploreDevice(device)}
                                  className="px-1.5 py-1 rounded-md bg-[var(--cyan-primary)]/10 hover:bg-[var(--cyan-primary)]/20 transition-colors"
                                  title="Browse GATT services & characteristics">
                                  <Terminal className="w-2.5 h-2.5 text-[var(--cyan-primary)]" />
                                </PressButton>
                              )}
                              {device.connected ? (
                                <PressButton onClick={() => disconnectDevice(device)} className="px-1.5 py-1 rounded-md hover:bg-[#FF3D3D]/10 transition-colors">
                                  <Unplug className="w-3 h-3 text-[#FF3D3D]" />
                                </PressButton>
                              ) : !device.probing && (
                                <PressButton onClick={() => connectDevice(device)} className="px-2 py-1 rounded-md bg-[var(--cyan-primary)]/10 hover:bg-[var(--cyan-primary)]/20 transition-colors">
                                  <Zap className="w-3 h-3 text-[var(--cyan-primary)]" />
                                </PressButton>
                              )}
                            </div>
                          </div>

                          {/* ── Device Info Expand ── */}
                          <AnimatePresence>
                            {isInfoOpen && device.deviceInfo && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden">
                                <div className="glass-panel-sm p-2 mt-1 space-y-1.5 border-[var(--cyan-primary)]/10">
                                  {device.deviceInfo.manufacturer && (
                                    <div className="flex items-center gap-1.5">
                                      <Tag className="w-2.5 h-2.5 text-[var(--text-muted)] shrink-0" />
                                      <span className="text-[7px] font-mono text-[var(--text-muted)] w-14 shrink-0">MFR</span>
                                      <span className="text-[7px] font-mono text-[var(--text-primary)] truncate">{device.deviceInfo.manufacturer}</span>
                                    </div>
                                  )}
                                  {device.deviceInfo.model && (
                                    <div className="flex items-center gap-1.5">
                                      <Cpu className="w-2.5 h-2.5 text-[var(--text-muted)] shrink-0" />
                                      <span className="text-[7px] font-mono text-[var(--text-muted)] w-14 shrink-0">MODEL</span>
                                      <span className="text-[7px] font-mono text-[var(--text-primary)] truncate">{device.deviceInfo.model}</span>
                                    </div>
                                  )}
                                  {device.deviceInfo.firmware && (
                                    <div className="flex items-center gap-1.5">
                                      <Hash className="w-2.5 h-2.5 text-[var(--text-muted)] shrink-0" />
                                      <span className="text-[7px] font-mono text-[var(--text-muted)] w-14 shrink-0">FW</span>
                                      <span className="text-[7px] font-mono text-[var(--text-primary)] truncate">{device.deviceInfo.firmware}</span>
                                    </div>
                                  )}
                                  {device.deviceInfo.hardware && (
                                    <div className="flex items-center gap-1.5">
                                      <Cpu className="w-2.5 h-2.5 text-[var(--text-muted)] shrink-0" />
                                      <span className="text-[7px] font-mono text-[var(--text-muted)] w-14 shrink-0">HW</span>
                                      <span className="text-[7px] font-mono text-[var(--text-primary)] truncate">{device.deviceInfo.hardware}</span>
                                    </div>
                                  )}
                                  {device.deviceInfo.serial && (
                                    <div className="flex items-center gap-1.5">
                                      <Hash className="w-2.5 h-2.5 text-[var(--text-muted)] shrink-0" />
                                      <span className="text-[7px] font-mono text-[var(--text-muted)] w-14 shrink-0">S/N</span>
                                      <span className="text-[7px] font-mono text-[var(--text-primary)] truncate">{device.deviceInfo.serial}</span>
                                    </div>
                                  )}
                                  {device.deviceInfo.appearance != null && (
                                    <div className="flex items-center gap-1.5">
                                      <Info className="w-2.5 h-2.5 text-[var(--text-muted)] shrink-0" />
                                      <span className="text-[7px] font-mono text-[var(--text-muted)] w-14 shrink-0">TYPE</span>
                                      <span className="text-[7px] font-mono text-[var(--cyan-primary)]">{device.deviceInfo.appearanceLabel} (0x{device.deviceInfo.appearance.toString(16).padStart(4, '0')})</span>
                                    </div>
                                  )}
                                  {device.deviceInfo.detectedServices.length > 0 && (
                                    <div className="flex items-start gap-1.5">
                                      <Bluetooth className="w-2.5 h-2.5 text-[var(--text-muted)] shrink-0 mt-0.5" />
                                      <span className="text-[7px] font-mono text-[var(--text-muted)] w-14 shrink-0">SVCS</span>
                                      <span className="text-[7px] font-mono text-[var(--text-primary)] leading-relaxed">{device.deviceInfo.detectedServices.join(', ')}</span>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {devices.length === 0 && !scanning && btSupported && (
                <div className="text-center py-4 opacity-40">
                  <Bluetooth className="w-6 h-6 mx-auto mb-1.5 text-[var(--text-muted)]" />
                  <p className="text-[7px] font-mono text-[var(--text-muted)] tracking-wider leading-relaxed">
                    Scan for nearby devices or use<br />quick controls above
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* ════ TV REMOTE ════ */}
          {remoteView === 'tv' && (
            <motion.div key="tv" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col items-center">
              <div className="flex items-center justify-between w-full mb-4 px-2">
                <PressButton onClick={() => { setTvPower(!tvPower); flash(tvPower ? 'POWER OFF' : 'POWER ON'); }}
                  className={`w-11 h-11 rounded-full flex items-center justify-center transition-all border ${tvPower ? 'bg-[var(--alert-green)]/10 border-[var(--alert-green)]/30 text-[var(--alert-green)]' : 'bg-[#FF3D3D]/10 border-[#FF3D3D]/30 text-[#FF3D3D]'}`}>
                  <Power className="w-5 h-5" />
                </PressButton>
                <div className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${tvPower ? 'bg-[var(--alert-green)] animate-pulse' : 'bg-[#FF3D3D]'}`} />
                  <span className="text-[7px] font-mono tracking-wider" style={{ color: tvPower ? 'var(--alert-green)' : '#FF3D3D' }}>{tvPower ? 'ON' : 'OFF'}</span>
                </div>
                <PressButton onClick={() => { setVolume(v => v === 0 ? 50 : 0); flash(volume === 0 ? 'UNMUTE' : 'MUTE'); }} className="w-11 h-11 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors text-[var(--text-muted)]">
                  {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </PressButton>
              </div>
              <div className="relative w-40 h-40 mb-4">
                <div className="absolute inset-2 rounded-full border border-white/5" />
                <PressButton onClick={() => flash('▲ UP')} className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-12 rounded-xl flex items-center justify-center bg-white/5 hover:bg-[var(--cyan-primary)]/15 hover:text-[var(--cyan-primary)] transition-all text-[var(--text-muted)]"><ChevronUp className="w-5 h-5" /></PressButton>
                <PressButton onClick={() => flash('▼ DOWN')} className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-12 rounded-xl flex items-center justify-center bg-white/5 hover:bg-[var(--cyan-primary)]/15 hover:text-[var(--cyan-primary)] transition-all text-[var(--text-muted)]"><ChevronDown className="w-5 h-5" /></PressButton>
                <PressButton onClick={() => flash('◀ LEFT')} className="absolute left-0 top-1/2 -translate-y-1/2 w-12 h-12 rounded-xl flex items-center justify-center bg-white/5 hover:bg-[var(--cyan-primary)]/15 hover:text-[var(--cyan-primary)] transition-all text-[var(--text-muted)]"><ChevronLeft className="w-5 h-5" /></PressButton>
                <PressButton onClick={() => flash('▶ RIGHT')} className="absolute right-0 top-1/2 -translate-y-1/2 w-12 h-12 rounded-xl flex items-center justify-center bg-white/5 hover:bg-[var(--cyan-primary)]/15 hover:text-[var(--cyan-primary)] transition-all text-[var(--text-muted)]"><ChevronRight className="w-5 h-5" /></PressButton>
                <PressButton onClick={() => flash('SELECT')} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full flex items-center justify-center bg-[var(--cyan-primary)]/8 hover:bg-[var(--cyan-primary)]/20 border border-[var(--cyan-primary)]/20 transition-all">
                  <span className="text-[9px] font-mono font-bold text-[var(--cyan-primary)] tracking-widest">OK</span>
                </PressButton>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full mb-3">
                <div className="glass-panel-sm p-2 flex flex-col items-center gap-1.5 rounded-xl">
                  <span className="text-[6px] font-mono text-[var(--text-muted)] tracking-widest">VOLUME</span>
                  <div className="flex items-center gap-1.5">
                    <PressButton onClick={() => { setVolume(v => Math.max(0, v - 5)); flash(`VOL ${Math.max(0, volume - 5)}`); }} className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/10"><Minus className="w-3 h-3 text-[var(--text-muted)]" /></PressButton>
                    <span className="text-[13px] font-mono font-bold text-[var(--gold-primary)] tabular-nums w-7 text-center">{volume}</span>
                    <PressButton onClick={() => { setVolume(v => Math.min(100, v + 5)); flash(`VOL ${Math.min(100, volume + 5)}`); }} className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/10"><Plus className="w-3 h-3 text-[var(--text-muted)]" /></PressButton>
                  </div>
                </div>
                <div className="glass-panel-sm p-2 flex flex-col items-center gap-1.5 rounded-xl">
                  <span className="text-[6px] font-mono text-[var(--text-muted)] tracking-widest">CHANNEL</span>
                  <div className="flex items-center gap-1.5">
                    <PressButton onClick={() => { setTvChannel(c => Math.max(1, c - 1)); flash(`CH ${Math.max(1, tvChannel - 1)}`); }} className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/10"><Minus className="w-3 h-3 text-[var(--text-muted)]" /></PressButton>
                    <span className="text-[13px] font-mono font-bold text-[var(--cyan-primary)] tabular-nums w-7 text-center">{tvChannel}</span>
                    <PressButton onClick={() => { setTvChannel(c => c + 1); flash(`CH ${tvChannel + 1}`); }} className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/10"><Plus className="w-3 h-3 text-[var(--text-muted)]" /></PressButton>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1 w-48">
                {[1,2,3,4,5,6,7,8,9,null,0,null].map((n, i) => n !== null ? (
                  <PressButton key={i} onClick={() => { setTvChannel(n); flash(`CH ${n}`); }} className="h-9 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/10 text-[11px] font-mono font-bold text-[var(--text-primary)]">{n}</PressButton>
                ) : <div key={i} />)}
              </div>
              <div className="flex items-center justify-center gap-2 mt-3">
                <PressButton onClick={() => flash('INPUT: HDMI')} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[7px] font-mono tracking-wider text-[var(--text-muted)]">HDMI</PressButton>
                <PressButton onClick={() => flash('HOME')} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[var(--text-muted)]"><Home className="w-3 h-3" /></PressButton>
                <PressButton onClick={() => flash('INPUT: SOURCE')} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[7px] font-mono tracking-wider text-[var(--text-muted)]">SOURCE</PressButton>
              </div>
            </motion.div>
          )}

          {/* ════ SPEAKER ════ */}
          {remoteView === 'speaker' && (
            <motion.div key="speaker" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col items-center">
              <div className="w-full h-20 rounded-xl mb-4 flex items-end justify-center gap-[3px] px-6 overflow-hidden" style={{ background: 'linear-gradient(180deg, rgba(212,175,55,0.03), rgba(212,175,55,0.08))' }}>
                {Array.from({ length: 24 }).map((_, i) => (
                  <motion.div key={i} animate={{ height: speakerPlaying ? 8 + Math.random() * 52 : 4 }} transition={{ duration: 0.15 }}
                    className="w-[3px] rounded-full" style={{ background: 'linear-gradient(to top, var(--gold-primary), rgba(212,175,55,0.3))', minHeight: 4, opacity: speakerPlaying ? 0.8 : 0.15 }} />
                ))}
              </div>
              <div className="text-center mb-4">
                <div className="text-[10px] font-mono font-bold text-[var(--text-primary)] tracking-wider">{speakerPlaying ? 'PLAYING' : 'PAUSED'}</div>
                <div className="text-[8px] font-mono text-[var(--text-muted)] tracking-wider mt-0.5">{activeDevice?.name || 'Tap play to start'}</div>
              </div>
              <div className="flex items-center gap-5 mb-5">
                <PressButton onClick={() => flash('⏮ PREV')} className="w-11 h-11 rounded-xl flex items-center justify-center bg-white/5 hover:bg-white/10 text-[var(--text-muted)]"><SkipBack className="w-4 h-4" /></PressButton>
                <PressButton onClick={() => { setSpeakerPlaying(!speakerPlaying); flash(speakerPlaying ? '⏸ PAUSED' : '▶ PLAYING'); }}
                  className="w-16 h-16 rounded-full flex items-center justify-center bg-[var(--gold-primary)]/12 hover:bg-[var(--gold-primary)]/25 border-2 border-[var(--gold-primary)]/20 transition-all">
                  {speakerPlaying ? <Pause className="w-7 h-7 text-[var(--gold-primary)]" /> : <Play className="w-7 h-7 text-[var(--gold-primary)] ml-0.5" />}
                </PressButton>
                <PressButton onClick={() => flash('⏭ NEXT')} className="w-11 h-11 rounded-xl flex items-center justify-center bg-white/5 hover:bg-white/10 text-[var(--text-muted)]"><SkipForward className="w-4 h-4" /></PressButton>
              </div>
              <div className="w-full px-3">
                <div className="flex items-center gap-2.5">
                  <PressButton onClick={() => { setVolume(v => Math.max(0, v - 5)); flash('VOL −'); }}><VolumeX className="w-3.5 h-3.5 text-[var(--text-muted)]" /></PressButton>
                  <div className="flex-1 h-8 flex items-center">
                    <input type="range" min="0" max="100" value={volume} onChange={e => { setVolume(parseInt(e.target.value)); flash(`VOL ${e.target.value}`); }}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{ background: `linear-gradient(to right, var(--gold-primary) 0%, var(--gold-primary) ${volume}%, rgba(255,255,255,0.08) ${volume}%, rgba(255,255,255,0.08) 100%)` }} />
                  </div>
                  <PressButton onClick={() => { setVolume(v => Math.min(100, v + 5)); flash('VOL +'); }}><Volume2 className="w-3.5 h-3.5 text-[var(--text-muted)]" /></PressButton>
                  <span className="text-[10px] font-mono font-bold text-[var(--gold-primary)] tabular-nums w-7 text-right">{volume}</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* ════ AC / CLIMATE ════ */}
          {remoteView === 'ac' && (
            <motion.div key="ac" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col items-center">
              <PressButton onClick={() => { setAcPower(!acPower); flash(acPower ? 'AC OFF' : 'AC ON'); }}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all border-2 mb-4 ${acPower ? 'bg-[var(--alert-green)]/10 border-[var(--alert-green)]/30 text-[var(--alert-green)]' : 'bg-white/5 border-white/10 text-[var(--text-muted)]'}`}>
                <Power className="w-7 h-7" />
              </PressButton>
              <div className="flex items-center gap-5 mb-4">
                <PressButton onClick={() => { setAcTemp(t => Math.max(16, t - 1)); flash(`${Math.max(16, acTemp - 1)}°C`); }}
                  className="w-12 h-12 rounded-xl flex items-center justify-center bg-[var(--cyan-primary)]/8 hover:bg-[var(--cyan-primary)]/18 text-[var(--cyan-primary)]"><Minus className="w-5 h-5" /></PressButton>
                <div className="text-center w-20">
                  <motion.span key={acTemp} initial={{ scale: 1.2, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }}
                    className="text-5xl font-mono font-bold tabular-nums block leading-none"
                    style={{ color: acTemp <= 20 ? 'var(--cyan-primary)' : acTemp >= 26 ? '#FF6B00' : 'var(--alert-green)' }}>{acTemp}</motion.span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">°C</span>
                </div>
                <PressButton onClick={() => { setAcTemp(t => Math.min(32, t + 1)); flash(`${Math.min(32, acTemp + 1)}°C`); }}
                  className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#FF6B00]/8 hover:bg-[#FF6B00]/18 text-[#FF6B00]"><Plus className="w-5 h-5" /></PressButton>
              </div>
              <span className="text-[7px] font-mono text-[var(--text-muted)] tracking-widest mb-2 uppercase">Mode</span>
              <div className="grid grid-cols-4 gap-2 w-full mb-4">
                {([
                  { mode: 'cool' as const, icon: Snowflake, label: 'Cool', color: 'var(--cyan-primary)' },
                  { mode: 'heat' as const, icon: Sun, label: 'Heat', color: '#FF6B00' },
                  { mode: 'fan' as const, icon: Wind, label: 'Fan', color: 'var(--text-primary)' },
                  { mode: 'auto' as const, icon: RefreshCw, label: 'Auto', color: 'var(--alert-green)' },
                ]).map(m => (
                  <PressButton key={m.mode} onClick={() => { setAcMode(m.mode); flash(m.label.toUpperCase()); }}
                    className={`p-2.5 rounded-xl flex flex-col items-center gap-1.5 transition-all border ${acMode === m.mode ? 'border-white/15 bg-white/8' : 'border-transparent bg-white/3 hover:bg-white/5'}`}>
                    <m.icon className="w-4 h-4" style={{ color: acMode === m.mode ? m.color : 'var(--text-muted)' }} />
                    <span className="text-[7px] font-mono tracking-wider" style={{ color: acMode === m.mode ? m.color : 'var(--text-muted)' }}>{m.label}</span>
                  </PressButton>
                ))}
              </div>
              <span className="text-[7px] font-mono text-[var(--text-muted)] tracking-widest mb-2 uppercase">Fan Speed</span>
              <div className="flex items-center gap-1.5 w-full">
                {(['low', 'med', 'high', 'auto'] as const).map(speed => (
                  <PressButton key={speed} onClick={() => { setAcFanSpeed(speed); flash(`FAN: ${speed.toUpperCase()}`); }}
                    className={`flex-1 py-2 rounded-lg text-[7px] font-mono font-bold tracking-wider transition-all border ${acFanSpeed === speed ? 'bg-white/10 border-white/10 text-[var(--text-primary)]' : 'bg-white/3 border-transparent text-[var(--text-muted)] hover:bg-white/5'}`}>
                    {speed.toUpperCase()}
                  </PressButton>
                ))}
              </div>
            </motion.div>
          )}

          {/* ════ SERVICE EXPLORER ════ */}
          {remoteView === 'explorer' && (
            <motion.div key="explorer" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              {explorerLoading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-[var(--cyan-primary)] border-t-transparent rounded-full animate-spin mb-3" />
                  <span className="text-[8px] font-mono text-[var(--cyan-primary)] tracking-wider animate-pulse">ENUMERATING GATT SERVICES...</span>
                </div>
              ) : explorerServices.length === 0 ? (
                <div className="text-center py-8 opacity-50">
                  <Terminal className="w-6 h-6 mx-auto mb-2 text-[var(--text-muted)]" />
                  <p className="text-[8px] font-mono text-[var(--text-muted)]">No services found.</p>
                  <p className="text-[7px] font-mono text-[var(--text-muted)] mt-1">Device may have disconnected.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {explorerServices.map(svc => (
                    <div key={svc.uuid}>
                      <button
                        onClick={() => setExpandedService(expandedService === svc.uuid ? null : svc.uuid)}
                        className={`w-full glass-panel-sm p-2 flex items-center gap-2 transition-all hover:bg-white/5 ${expandedService === svc.uuid ? 'border-[var(--cyan-primary)]/20' : ''}`}
                      >
                        <Bluetooth className="w-3 h-3 text-[var(--cyan-primary)] shrink-0" />
                        <div className="flex-1 text-left min-w-0">
                          <div className="text-[8px] font-mono font-bold text-[var(--text-primary)] truncate">{svc.name}</div>
                          <div className="text-[6px] font-mono text-[var(--text-muted)] truncate">{svc.uuid}</div>
                        </div>
                        <span className="text-[7px] font-mono text-[var(--text-muted)]">{svc.characteristics.length} CHAR{svc.characteristics.length !== 1 ? 'S' : ''}</span>
                        <ChevRight className={`w-3 h-3 text-[var(--text-muted)] transition-transform ${expandedService === svc.uuid ? 'rotate-90' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {expandedService === svc.uuid && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="pl-3 pr-1 py-1 space-y-1">
                              {svc.characteristics.map(ch => {
                                const charKey = `${svc.uuid}/${ch.uuid}`;
                                const props = [];
                                if (ch.properties.read) props.push('R');
                                if (ch.properties.write || ch.properties.writeNoResp) props.push('W');
                                if (ch.properties.notify) props.push('N');
                                if (ch.properties.indicate) props.push('I');
                                return (
                                  <div key={ch.uuid} className="glass-panel-sm p-2 border-l-2 border-[var(--cyan-primary)]/10">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <span className="text-[7px] font-mono font-bold text-[var(--text-primary)] truncate flex-1">{ch.name}</span>
                                      <span className="text-[6px] font-mono px-1 py-0.5 rounded bg-[var(--cyan-primary)]/10 text-[var(--cyan-primary)] shrink-0">{props.join('·')}</span>
                                    </div>
                                    <div className="text-[6px] font-mono text-[var(--text-muted)] truncate mb-1.5">{ch.uuid}</div>

                                    {/* Value display */}
                                    {ch.value && (
                                      <div className="flex items-center gap-1 mb-1.5">
                                        <div className="flex-1 bg-black/30 rounded px-1.5 py-1 min-w-0">
                                          <div className="text-[7px] font-mono text-[var(--alert-green)] truncate">{ch.value}</div>
                                          {ch.rawHex && <div className="text-[6px] font-mono text-[var(--text-muted)] truncate">{ch.rawHex}</div>}
                                        </div>
                                        <PressButton
                                          onClick={() => {
                                            navigator.clipboard?.writeText(ch.value || '');
                                            setCopiedChar(charKey);
                                            setTimeout(() => setCopiedChar(null), 1500);
                                          }}
                                          className="p-1 rounded hover:bg-white/5 transition-colors shrink-0"
                                          title="Copy value"
                                        >
                                          {copiedChar === charKey ? <Check className="w-2.5 h-2.5 text-[var(--alert-green)]" /> : <Copy className="w-2.5 h-2.5 text-[var(--text-muted)]" />}
                                        </PressButton>
                                      </div>
                                    )}

                                    {/* Action buttons */}
                                    <div className="flex items-center gap-1 flex-wrap">
                                      {ch.properties.read && (
                                        <PressButton
                                          onClick={async () => {
                                            if (!ch.characteristic) return;
                                            try {
                                              const val = await ch.characteristic.readValue();
                                              const bytes = new Uint8Array(val.buffer);
                                              const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
                                              let text: string;
                                              try { text = new TextDecoder().decode(val.buffer); } catch { text = hex; }
                                              // Check if text is printable
                                              const isPrintable = /^[\x20-\x7E\n\r\t]+$/.test(text);
                                              setExplorerServices(prev => prev.map(s =>
                                                s.uuid === svc.uuid ? {
                                                  ...s, characteristics: s.characteristics.map(c =>
                                                    c.uuid === ch.uuid ? { ...c, value: isPrintable ? text : hex, rawHex: hex } : c
                                                  )
                                                } : s
                                              ));
                                              flash(`READ: ${isPrintable ? text.slice(0, 20) : hex.slice(0, 20)}`);
                                            } catch (e: any) { flash(`READ FAIL: ${e.message?.slice(0, 30)}`); }
                                          }}
                                          className="flex items-center gap-0.5 px-1.5 py-1 rounded text-[6px] font-mono tracking-wider bg-[var(--cyan-primary)]/10 text-[var(--cyan-primary)] hover:bg-[var(--cyan-primary)]/20 transition-colors"
                                        >
                                          <Eye className="w-2.5 h-2.5" /> READ
                                        </PressButton>
                                      )}

                                      {ch.properties.notify && (
                                        <PressButton
                                          onClick={async () => {
                                            if (!ch.characteristic) return;
                                            try {
                                              if (ch.notifying) {
                                                await ch.characteristic.stopNotifications();
                                                ch.characteristic.removeEventListener('characteristicvaluechanged', () => {});
                                                setExplorerServices(prev => prev.map(s =>
                                                  s.uuid === svc.uuid ? { ...s, characteristics: s.characteristics.map(c => c.uuid === ch.uuid ? { ...c, notifying: false } : c) } : s
                                                ));
                                                flash('NOTIFY: OFF');
                                              } else {
                                                await ch.characteristic.startNotifications();
                                                ch.characteristic.addEventListener('characteristicvaluechanged', (event: Event) => {
                                                  const target = event.target as BluetoothRemoteGATTCharacteristic;
                                                  const val = target.value;
                                                  if (!val) return;
                                                  const bytes = new Uint8Array(val.buffer);
                                                  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
                                                  let text: string;
                                                  try { text = new TextDecoder().decode(val.buffer); } catch { text = hex; }
                                                  const isPrintable = /^[\x20-\x7E\n\r\t]+$/.test(text);
                                                  setExplorerServices(prev => prev.map(s =>
                                                    s.uuid === svc.uuid ? { ...s, characteristics: s.characteristics.map(c => c.uuid === ch.uuid ? { ...c, value: isPrintable ? text : hex, rawHex: hex } : c) } : s
                                                  ));
                                                });
                                                setExplorerServices(prev => prev.map(s =>
                                                  s.uuid === svc.uuid ? { ...s, characteristics: s.characteristics.map(c => c.uuid === ch.uuid ? { ...c, notifying: true } : c) } : s
                                                ));
                                                flash('NOTIFY: ON');
                                              }
                                            } catch (e: any) { flash(`NOTIFY FAIL: ${e.message?.slice(0, 30)}`); }
                                          }}
                                          className={`flex items-center gap-0.5 px-1.5 py-1 rounded text-[6px] font-mono tracking-wider transition-colors ${ch.notifying ? 'bg-[var(--gold-primary)]/15 text-[var(--gold-primary)]' : 'bg-white/5 text-[var(--text-muted)] hover:bg-white/10'}`}
                                        >
                                          {ch.notifying ? <Bell className="w-2.5 h-2.5" /> : <BellOff className="w-2.5 h-2.5" />}
                                          {ch.notifying ? 'LISTENING' : 'NOTIFY'}
                                        </PressButton>
                                      )}

                                      {(ch.properties.write || ch.properties.writeNoResp) && (
                                        <div className="flex items-center gap-0.5 flex-1">
                                          <input
                                            type="text"
                                            placeholder="hex: FF 01"
                                            value={writeInput[charKey] || ''}
                                            onChange={e => setWriteInput(prev => ({ ...prev, [charKey]: e.target.value }))}
                                            className="flex-1 bg-black/30 rounded px-1.5 py-1 text-[7px] font-mono text-[var(--text-primary)] outline-none border border-transparent focus:border-[var(--gold-primary)]/30 min-w-0"
                                          />
                                          <PressButton
                                            onClick={async () => {
                                              if (!ch.characteristic || !writeInput[charKey]) return;
                                              try {
                                                const hexStr = writeInput[charKey].replace(/[^0-9a-fA-F]/g, '');
                                                const bytes = new Uint8Array((hexStr.match(/.{1,2}/g) || []).map(b => parseInt(b, 16)));
                                                if (ch.properties.writeNoResp) {
                                                  await ch.characteristic.writeValueWithoutResponse(bytes);
                                                } else {
                                                  await ch.characteristic.writeValueWithResponse(bytes);
                                                }
                                                flash(`SENT: ${writeInput[charKey]}`);
                                                setWriteInput(prev => ({ ...prev, [charKey]: '' }));
                                              } catch (e: any) { flash(`WRITE FAIL: ${e.message?.slice(0, 30)}`); }
                                            }}
                                            className="p-1 rounded bg-[var(--gold-primary)]/10 text-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/20 transition-colors shrink-0"
                                            title="Send hex bytes"
                                          >
                                            <Send className="w-2.5 h-2.5" />
                                          </PressButton>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-[var(--border-secondary)] flex items-center justify-between">
        <span className="text-[6px] font-mono text-[var(--text-muted)] tracking-widest opacity-40">
          {btSupported ? '● BT READY' : '○ BT UNAVAILABLE'}
        </span>
        {devices.length > 0 && (
          <span className="text-[6px] font-mono text-[var(--text-muted)] tracking-widest opacity-40">
            {devices.length} DEVICE{devices.length !== 1 ? 'S' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
