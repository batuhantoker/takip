'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bluetooth, BluetoothSearching, Tv, Speaker, X, WifiOff,
  Gamepad2, Lightbulb, Watch, Headphones, Mouse, Keyboard, Smartphone,
  BatteryMedium, Fan, Eye, Send, Bell, BellOff, ChevronRight, Copy, Check,
  AlertTriangle, Radio, Scan, Signal, Zap, Unplug, Terminal,
  Shield, Clock, Server, Layers, Activity, ArrowDown, ChevronDown
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// BLE CONSTANTS
// ═══════════════════════════════════════════════════════════════
const BLE = {
  SVC: { GA:0x1800,GATT:0x1801,DI:0x180A,BAT:0x180F,HR:0x180D,BP:0x1810,HT:0x1809,HID:0x1812,RS:0x1814,CS:0x1816,CP:0x1818,ENV:0x181A,BC:0x181B,UD:0x181C,WS:0x181D,GL:0x1808,TX:0x1804,LL:0x1803,IA:0x1802,CT:0x1805,PAS:0x180E,AN:0x1811,AIO:0x1815,MC:0x1848 },
  CHR: { NAME:0x2A00,APP:0x2A01,MFR:0x2A29,MODEL:0x2A24,SERIAL:0x2A25,HW:0x2A27,FW:0x2A26,SW:0x2A28,SYS:0x2A23,PNP:0x2A50,BATT:0x2A19 },
} as const;
const ALL_SVCS = Object.values(BLE.SVC);
const UUID_NAMES: Record<number,string> = {
  0x1800:'Generic Access',0x1801:'Generic Attribute',0x180A:'Device Information',0x180F:'Battery Service',
  0x180D:'Heart Rate',0x1810:'Blood Pressure',0x1809:'Health Thermometer',0x1812:'Human Interface Device',
  0x1814:'Running Speed',0x1816:'Cycling Speed',0x1818:'Cycling Power',0x181A:'Environmental Sensing',
  0x181B:'Body Composition',0x181C:'User Data',0x181D:'Weight Scale',0x1802:'Immediate Alert',
  0x1803:'Link Loss',0x1804:'TX Power',0x1805:'Current Time',0x180E:'Phone Alert',
  0x1811:'Alert Notification',0x1815:'Automation IO',0x1848:'Media Control',
  0x2A00:'Device Name',0x2A01:'Appearance',0x2A19:'Battery Level',0x2A24:'Model Number',
  0x2A25:'Serial Number',0x2A26:'Firmware Rev',0x2A27:'Hardware Rev',0x2A28:'Software Rev',
  0x2A29:'Manufacturer',0x2A23:'System ID',0x2A50:'PnP ID',0x2A37:'Heart Rate',
  0x2A6E:'Temperature',0x2A6F:'Humidity',0x2A6D:'Pressure',
};

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════
type DType = 'tv'|'speaker'|'ac'|'light'|'wearable'|'headphones'|'gamepad'|'keyboard'|'mouse'|'phone'|'unknown';
type PktOp = 'SCAN'|'PROBE'|'READ'|'WRITE'|'NOTIFY'|'CONNECT'|'DISCONNECT'|'ENUMERATE'|'ERROR'|'SUBSCRIBE'|'INFO';
interface Packet { id: number; ts: number; op: PktOp; device: string; detail: string; hex?: string; bytes?: number; }
interface DInfo { manufacturer?: string; model?: string; serial?: string; hardware?: string; firmware?: string; software?: string; appearance?: number; appearanceLabel?: string; services: string[]; classifiedBy: string; }
interface Device { id: string; name: string; type: DType; connected: boolean; battery?: number; info?: DInfo; bt?: BluetoothDevice; server?: BluetoothRemoteGATTServer; probing?: boolean; probeMs?: number; }
interface SvcInfo { uuid: string; name: string; chars: CharInfo[]; }
interface CharInfo { uuid: string; name: string; value?: string; hex?: string; notifying?: boolean; char?: BluetoothRemoteGATTCharacteristic; props: { r:boolean;w:boolean;wn:boolean;n:boolean;i:boolean }; }

// ═══════════════════════════════════════════════════════════════
// PURE HELPERS
// ═══════════════════════════════════════════════════════════════
function byAppearance(a:number):DType|null{const m:Record<number,DType>={0x0040:'phone',0x00C0:'wearable',0x00C1:'wearable',0x00C2:'wearable',0x0140:'tv',0x0300:'ac',0x03C1:'keyboard',0x03C2:'mouse',0x03C4:'gamepad',0x0840:'speaker',0x0841:'speaker',0x0842:'headphones',0x0843:'headphones',0x0C40:'wearable',0x1440:'wearable'};if(m[a])return m[a];const c=a&0xFFC0;if(c>=0x40&&c<=0x7F)return'phone';if(c>=0xC0&&c<=0xFF)return'wearable';if(c>=0x140&&c<=0x17F)return'tv';if(c>=0x3C0&&c<=0x3FF){const s=a&0x3F;return s===1?'keyboard':s===2?'mouse':s===4?'gamepad':null;}if(c>=0x840&&c<=0x87F)return'speaker';return null;}
function bySvcs(u:number[]):DType|null{const h=(x:number)=>u.includes(x);if(h(0x1848))return'speaker';if(h(0x1812))return'gamepad';if(h(0x180D)||h(0x1814)||h(0x1816)||h(0x1818))return'wearable';if(h(0x181A)||h(0x1809))return'ac';if(h(0x1810)||h(0x1808)||h(0x181B)||h(0x181D))return'wearable';if(h(0x180E))return'phone';return null;}
function byName(n:string):DType{const l=n.toLowerCase();if(/\btv\b|bravia|roku|chromecast|fire.?stick|apple.?tv|shield|vizio/i.test(l))return'tv';if(/speaker|soundbar|bose|jbl|sonos|marshall|echo|homepod|soundcore/i.test(l))return'speaker';if(/\bac\b|thermostat|nest|ecobee|daikin|sensibo/i.test(l))return'ac';if(/bulb|light|hue|lifx|nanoleaf|govee|yeelight/i.test(l))return'light';if(/watch|band|fitbit|garmin|amazfit|polar|suunto|whoop/i.test(l))return'wearable';if(/headphone|airpod|buds|earbud|wh-1000|wf-1000|qc|momentum|jabra|galaxy.?buds|freebuds/i.test(l))return'headphones';if(/gamepad|controller|xbox|playstation|dualsense|joy.?con|8bitdo/i.test(l))return'gamepad';if(/keyboard|keychron|hhkb|nuphy/i.test(l))return'keyboard';if(/mouse|mx.?master|trackpad/i.test(l))return'mouse';if(/phone|iphone|galaxy.?[saz]|pixel|oneplus|xiaomi/i.test(l))return'phone';return'unknown';}
function byMfr(m:string):DType|null{if(/bose|jbl|sonos|harman|marshall|yamaha|denon/i.test(m))return'speaker';if(/samsung|lg|sony|vizio|tcl|hisense/i.test(m))return'tv';if(/logitech|corsair|razer|steelseries/i.test(m))return'mouse';if(/fitbit|garmin|polar|suunto|coros|whoop/i.test(m))return'wearable';return null;}
function resolveUUID(u:string):string{const m=u.match(/^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/i);if(m)return UUID_NAMES[parseInt(m[1],16)]||`0x${m[1].toUpperCase()}`;return u.length>8?u.slice(0,8)+'…':u;}
async function readStr(s:BluetoothRemoteGATTService,u:number){try{const c=await s.getCharacteristic(u);const v=await c.readValue();return new TextDecoder().decode(v.buffer).replace(/\0+$/g,'')||undefined;}catch{return undefined;}}
function decode(dv:DataView){const b=new Uint8Array(dv.buffer);const hex=Array.from(b).map(x=>x.toString(16).padStart(2,'0')).join(' ');try{const t=new TextDecoder().decode(dv.buffer);if(/^[\x20-\x7E\n\r\t]+$/.test(t))return{text:t,hex};}catch{}return{text:hex,hex};}
function validHex(s:string){const h=s.replace(/[\s,:-]/g,'');return h.length>0&&h.length%2===0&&/^[0-9a-fA-F]+$/.test(h);}
function parseHex(s:string){const h=s.replace(/[\s,:-]/g,'');return new Uint8Array((h.match(/.{1,2}/g)||[]).map(b=>parseInt(b,16)));}
async function writeSafe(ch:BluetoothRemoteGATTCharacteristic,d:Uint8Array,resp:boolean){if(resp&&typeof ch.writeValueWithResponse==='function')await ch.writeValueWithResponse(d);else if(!resp&&typeof ch.writeValueWithoutResponse==='function')await ch.writeValueWithoutResponse(d);else await(ch as any).writeValue(d);}
function appLabel(a:number){const c=(a>>6)&0x3FF;const m:Record<number,string>={0:'Unknown',1:'Phone',2:'Computer',3:'Watch',5:'Display',6:'Remote',10:'Media Player',15:'HID',48:'Audio Sink'};return m[c]||`0x${a.toString(16)}`;}
function fmtTs(ts:number){const d=new Date(ts);return d.toLocaleTimeString('en-US',{hour12:false})+'.'+d.getMilliseconds().toString().padStart(3,'0');}

const META: Record<DType,{icon:typeof Bluetooth;color:string;label:string}> = {
  tv:{icon:Tv,color:'#00E6FF',label:'Television'},speaker:{icon:Speaker,color:'#FFB800',label:'Speaker'},
  ac:{icon:Fan,color:'#00FF88',label:'Climate'},light:{icon:Lightbulb,color:'#FFD700',label:'Light'},
  wearable:{icon:Watch,color:'#FF6BCD',label:'Wearable'},headphones:{icon:Headphones,color:'#B388FF',label:'Headphones'},
  gamepad:{icon:Gamepad2,color:'#FF6B6B',label:'Controller'},keyboard:{icon:Keyboard,color:'#64FFDA',label:'Keyboard'},
  mouse:{icon:Mouse,color:'#80DEEA',label:'Mouse'},phone:{icon:Smartphone,color:'#FFB74D',label:'Phone'},
  unknown:{icon:Bluetooth,color:'#90A4AE',label:'Device'},
};

const OP_COLORS: Record<PktOp,string> = {
  SCAN:'#00E6FF',PROBE:'#B388FF',READ:'#64FFDA',WRITE:'#FFB800',NOTIFY:'#00FF88',
  CONNECT:'#00E6FF',DISCONNECT:'#FF6B6B',ENUMERATE:'#80DEEA',ERROR:'#FF3D3D',
  SUBSCRIBE:'#FF6BCD',INFO:'#90A4AE',
};

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function WorldRemote({ onClose }: { onClose?: () => void }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [scanning, setScanning] = useState(false);
  const [btOk, setBtOk] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [connecting, setConnecting] = useState<string|null>(null);
  const [gattTarget, setGattTarget] = useState<string|null>(null);
  const [gattSvcs, setGattSvcs] = useState<SvcInfo[]>([]);
  const [gattLoading, setGattLoading] = useState(false);
  const [expandedSvc, setExpandedSvc] = useState<string|null>(null);
  const [writeInput, setWriteInput] = useState<Record<string,string>>({});
  const [copied, setCopied] = useState<string|null>(null);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [view, setView] = useState<'devices'|'packets'>('devices');
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedDevice, setExpandedDevice] = useState<string|null>(null);

  const mounted = useRef(true);
  const errT = useRef<ReturnType<typeof setTimeout>|null>(null);
  const nListeners = useRef<Map<string,(e:Event)=>void>>(new Map());
  const pktId = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);
  const startTime = useRef(Date.now());

  useEffect(() => { if(typeof navigator!=='undefined'&&!navigator.bluetooth)setBtOk(false); mounted.current=true; startTime.current=Date.now(); return()=>{mounted.current=false;if(errT.current)clearTimeout(errT.current);nListeners.current.clear();}; }, []);
  useEffect(() => { if(autoScroll && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [packets, autoScroll]);

  const setErr = useCallback((m:string|null)=>{if(!mounted.current)return;setError(m);if(errT.current)clearTimeout(errT.current);if(m)errT.current=setTimeout(()=>{if(mounted.current)setError(null);},6000);},[]);

  // ── PACKET LOGGER ──
  const log = useCallback((op:PktOp, device:string, detail:string, hex?:string, bytes?:number) => {
    if(!mounted.current) return;
    const pkt: Packet = { id: ++pktId.current, ts: Date.now(), op, device, detail, hex, bytes };
    setPackets(p => { const next = [...p, pkt]; return next.length > 500 ? next.slice(-500) : next; });
    if(bytes) setTotalBytes(b => b + bytes);
  }, []);

  const onDC = useCallback((e:Event)=>{if(!mounted.current)return;const d=e.target as BluetoothDevice;setDevices(p=>p.map(x=>x.bt===d?{...x,connected:false,server:undefined}:x));log('DISCONNECT',d.name||'?','GATT server disconnected');},[log]);

  // ── PROBE ──
  const probe = useCallback(async(dev:Device):Promise<Device>=>{
    if(!dev.bt?.gatt)return{...dev,type:byName(dev.name),probing:false};
    const info:DInfo={services:[],classifiedBy:'name'};let type:DType|null=null;let batt:number|undefined;let name=dev.name;const t0=performance.now();
    log('PROBE',dev.name,'Initiating GATT connection for deep probe...');
    try{
      const s=await dev.bt.gatt.connect(); if(!s)return{...dev,type:byName(dev.name),probing:false};
      log('CONNECT',dev.name,'GATT server connected');
      // Generic Access
      try{const g=await s.getPrimaryService(0x1800);info.services.push('Generic Access');log('ENUMERATE',dev.name,'Service: Generic Access (0x1800)');
        try{const c=await g.getCharacteristic(0x2A01);const v=await c.readValue();const a=v.getUint16(0,true);info.appearance=a;info.appearanceLabel=appLabel(a);
          const hex=Array.from(new Uint8Array(v.buffer)).map(x=>x.toString(16).padStart(2,'0')).join(' ');
          log('READ',dev.name,`Appearance: ${appLabel(a)} (0x${a.toString(16).padStart(4,'0')})`,hex,v.byteLength);
          const t=byAppearance(a);if(t&&t!=='unknown'){type=t;info.classifiedBy='appearance';}
        }catch{}
        try{const c=await g.getCharacteristic(0x2A00);const v=await c.readValue();const n=new TextDecoder().decode(v.buffer).replace(/\0+$/g,'');
          if(n&&n.length>0){name=n;const hex=Array.from(new Uint8Array(v.buffer)).map(x=>x.toString(16).padStart(2,'0')).join(' ');log('READ',dev.name,`Device Name: "${n}"`,hex,v.byteLength);}
        }catch{}
      }catch{log('INFO',dev.name,'Generic Access service not available');}
      // Device Info
      try{const d=await s.getPrimaryService(0x180A);info.services.push('Device Information');log('ENUMERATE',dev.name,'Service: Device Information (0x180A)');
        const fields:[string,number,keyof DInfo][]=[['Manufacturer',0x2A29,'manufacturer'],['Model',0x2A24,'model'],['Serial',0x2A25,'serial'],['Hardware Rev',0x2A27,'hardware'],['Firmware Rev',0x2A26,'firmware'],['Software Rev',0x2A28,'software']];
        for(const[label,uuid,key]of fields){const val=await readStr(d,uuid);if(val){(info as any)[key]=val;log('READ',name,`${label}: "${val}"`,Array.from(new TextEncoder().encode(val)).map(x=>x.toString(16).padStart(2,'0')).join(' '),val.length);}}
        if(!type&&info.manufacturer){const mt=byMfr(info.manufacturer);if(mt){type=mt;info.classifiedBy='pnp';}}
      }catch{log('INFO',name,'Device Information service not available');}
      // Service probe
      const found:number[]=[];
      for(const svc of[0x180F,0x180D,0x1812,0x1814,0x1816,0x181A,0x1809,0x1810,0x1808,0x181B,0x181D,0x180E,0x1848,0x1815]){
        try{const sv=await s.getPrimaryService(svc);found.push(svc);const sn=Object.entries(BLE.SVC).find(([,v])=>v===svc)?.[0]?.replace(/_/g,' ')||`0x${svc.toString(16)}`;info.services.push(sn);
          log('ENUMERATE',name,`Service: ${sn} (0x${svc.toString(16)})`);
          if(svc===0x180F){try{const bc=await sv.getCharacteristic(0x2A19);const bv=await bc.readValue();batt=bv.getUint8(0);log('READ',name,`Battery: ${batt}%`,bv.getUint8(0).toString(16).padStart(2,'0'),1);}catch{}}
        }catch{}}
      if(!type||type==='unknown'){const st=bySvcs(found);if(st){type=st;info.classifiedBy='service';}}
      if(!type||type==='unknown'){type=byName(name);if(type!=='unknown')info.classifiedBy='name';}
      if(type==='unknown'&&info.manufacturer){const mt=byName(`${info.manufacturer} ${info.model||''}`);if(mt!=='unknown'){type=mt;info.classifiedBy='name';}}
      try{s.disconnect();}catch{}
      const ms=Math.round(performance.now()-t0);
      log('INFO',name,`Probe complete: ${type?.toUpperCase()} via ${info.classifiedBy} (${ms}ms, ${info.services.length} services)`);
    }catch(e:any){log('ERROR',dev.name,`Probe failed: ${e.message}`);if(!type)type=byName(dev.name);}
    return{...dev,name,type:type||'unknown',info,battery:batt,connected:false,probing:false,probeMs:Math.round(performance.now()-t0)};
  },[log]);

  // ── SCAN ──
  const scan = useCallback(async()=>{
    if(!navigator.bluetooth||scanning)return; setScanning(true);setErr(null);
    log('SCAN','SCANNER','Bluetooth device picker opened...');
    try{
      const d=await navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices:ALL_SVCS});
      if(d){
        log('SCAN','SCANNER',`Device selected: "${d.name||d.id}" (${d.id.slice(0,8)}...)`);
        if(devices.find(x=>x.id===d.id)){log('INFO','SCANNER','Device already in list — skipping');setScanning(false);return;}
        d.addEventListener('gattserverdisconnected',onDC);
        const raw:Device={id:d.id,name:d.name||`Device-${d.id.slice(0,6)}`,type:'unknown',connected:false,bt:d,probing:true};
        setDevices(p=>[...p,raw]);
        const probed=await probe(raw);
        if(mounted.current)setDevices(p=>p.map(x=>x.id===d.id?probed:x));
      }else{log('INFO','SCANNER','Picker cancelled by user');}
    }catch(e:any){if(e.name!=='NotFoundError'){setErr(e.message);log('ERROR','SCANNER',e.message);}else log('INFO','SCANNER','Picker dismissed');}
    finally{if(mounted.current)setScanning(false);}
  },[devices,scanning,probe,onDC,setErr,log]);

  // ── CONNECT ──
  const connect = useCallback(async(dev:Device)=>{
    if(!dev.bt?.gatt||connecting)return;setConnecting(dev.id);setErr(null);
    log('CONNECT',dev.name,'Initiating GATT connection...');
    try{const s=await dev.bt.gatt.connect();if(!s)throw new Error('GATT failed');let b=dev.battery;
      try{const bs=await s.getPrimaryService(0x180F);const bc=await bs.getCharacteristic(0x2A19);b=(await bc.readValue()).getUint8(0);log('READ',dev.name,`Battery: ${b}%`);}catch{}
      setDevices(p=>p.map(d=>d.id===dev.id?{...d,connected:true,server:s,battery:b}:d));
      log('CONNECT',dev.name,'Connected successfully');
    }catch(e:any){setErr(`Connect: ${e.message}`);log('ERROR',dev.name,`Connect failed: ${e.message}`);}
    finally{if(mounted.current)setConnecting(null);}
  },[connecting,setErr,log]);

  const disconnect = useCallback((dev:Device)=>{try{dev.bt?.gatt?.connected&&dev.bt.gatt.disconnect();}catch{}
    setDevices(p=>p.map(d=>d.id===dev.id?{...d,connected:false,server:undefined}:d));
    if(gattTarget===dev.id){setGattTarget(null);setGattSvcs([]);}
    log('DISCONNECT',dev.name,'Connection dropped');
  },[gattTarget,log]);

  // ── EXPLORE GATT (auto-reads everything) ──
  const explore = useCallback(async(dev:Device)=>{
    if(!dev.bt?.gatt)return;
    if(!dev.bt.gatt.connected){try{await dev.bt.gatt.connect();}catch{setErr('Reconnect failed');return;}}
    setGattTarget(dev.id);setGattLoading(true);setGattSvcs([]);setExpandedSvc(null);
    log('ENUMERATE',dev.name,'Enumerating all GATT services...');
    try{
      const svcs=await dev.bt.gatt.getPrimaryServices();
      log('ENUMERATE',dev.name,`Found ${svcs.length} primary services`);
      const result:SvcInfo[]=[];
      for(const s of svcs){
        const sName=resolveUUID(s.uuid);
        log('ENUMERATE',dev.name,`Service: ${sName} (${s.uuid.slice(0,8)})`);
        const chars:CharInfo[]=[];
        try{
          const chs=await s.getCharacteristics();
          log('ENUMERATE',dev.name,`  └─ ${chs.length} characteristics`);
          for(const ch of chs){
            let value:string|undefined,hex:string|undefined;
            if(ch.properties.read){
              try{
                const v=await ch.readValue();const d=decode(v);value=d.text;hex=d.hex;
                log('READ',dev.name,`  ${resolveUUID(ch.uuid)}: ${d.text.slice(0,40)}`,d.hex,v.byteLength);
              }catch{log('ERROR',dev.name,`  ${resolveUUID(ch.uuid)}: read denied`);}
            }
            chars.push({uuid:ch.uuid,name:resolveUUID(ch.uuid),props:{r:ch.properties.read,w:ch.properties.write,wn:ch.properties.writeWithoutResponse,n:ch.properties.notify,i:ch.properties.indicate},value,hex,char:ch});
          }
        }catch{}
        result.push({uuid:s.uuid,name:sName,chars});
      }
      if(mounted.current){setGattSvcs(result);if(result.length>0)setExpandedSvc(result[0].uuid);}
      log('INFO',dev.name,`GATT exploration complete: ${result.length} services, ${result.reduce((a,s)=>a+s.chars.length,0)} characteristics`);
    }catch(e:any){setErr(`Explore: ${e.message}`);log('ERROR',dev.name,`Exploration failed: ${e.message}`);}
    finally{if(mounted.current)setGattLoading(false);}
  },[setErr,log]);

  // ── NOTIFY ──
  const toggleNotify = useCallback(async(su:string,ch:CharInfo,devName:string)=>{
    if(!ch.char)return;const key=`${su}/${ch.uuid}`;
    try{if(ch.notifying){await ch.char.stopNotifications();const l=nListeners.current.get(key);if(l){ch.char.removeEventListener('characteristicvaluechanged',l);nListeners.current.delete(key);}
      setGattSvcs(p=>p.map(s=>s.uuid===su?{...s,chars:s.chars.map(c=>c.uuid===ch.uuid?{...c,notifying:false}:c)}:s));
      log('SUBSCRIBE',devName,`Unsubscribed: ${ch.name}`);
    }else{await ch.char.startNotifications();
      const listener=(e:Event)=>{if(!mounted.current)return;const t=(e.target as BluetoothRemoteGATTCharacteristic).value;if(!t)return;const d=decode(t);
        setGattSvcs(p=>p.map(s=>s.uuid===su?{...s,chars:s.chars.map(c=>c.uuid===ch.uuid?{...c,value:d.text,hex:d.hex}:c)}:s));
        log('NOTIFY',devName,`${ch.name}: ${d.text.slice(0,40)}`,d.hex,t.byteLength);
      };
      ch.char.addEventListener('characteristicvaluechanged',listener);nListeners.current.set(key,listener);
      setGattSvcs(p=>p.map(s=>s.uuid===su?{...s,chars:s.chars.map(c=>c.uuid===ch.uuid?{...c,notifying:true}:c)}:s));
      log('SUBSCRIBE',devName,`Subscribed: ${ch.name} — listening for notifications`);
    }}catch(e:any){log('ERROR',devName,`Notify fail: ${(e.message||'').slice(0,40)}`);}
  },[log]);

  const connCount = devices.filter(d=>d.connected).length;
  const uptime = Math.floor((Date.now() - startTime.current) / 1000);
  const uptimeStr = `${Math.floor(uptime/60).toString().padStart(2,'0')}:${(uptime%60).toString().padStart(2,'0')}`;

  return (
    <div className="w-full flex flex-col overflow-hidden" style={{ minWidth: 340, maxHeight: 700, background:'#06080c', borderRadius:14, border:'1px solid rgba(0,230,255,0.06)', boxShadow:'0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.02)' }}>

      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background:'linear-gradient(180deg, rgba(0,230,255,0.03), transparent)', borderBottom:'1px solid rgba(0,230,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center relative" style={{ background:'rgba(0,230,255,0.06)',border:'1px solid rgba(0,230,255,0.1)' }}>
            <Radio className="w-4 h-4 text-[var(--cyan-primary)]" />
            {scanning && <motion.div className="absolute inset-0 rounded-lg" animate={{ boxShadow:['0 0 0px rgba(0,230,255,0.2)','0 0 15px rgba(0,230,255,0.4)','0 0 0px rgba(0,230,255,0.2)'] }} transition={{ duration:1.5,repeat:Infinity }} />}
          </div>
          <div>
            <h3 className="text-[11px] font-mono font-bold tracking-[0.25em] text-[var(--text-primary)]">BLE SNIFFER</h3>
            <span className="text-[7px] font-mono text-[var(--cyan-primary)]/40 tracking-widest">{scanning?'SCANNING...':'PASSIVE'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Stats */}
          <div className="flex items-center gap-3 mr-2">
            <div className="text-right"><span className="text-[6px] font-mono text-[var(--text-muted)] tracking-widest block">PKTS</span><span className="text-[9px] font-mono font-bold text-[var(--cyan-primary)] tabular-nums">{packets.length}</span></div>
            <div className="text-right"><span className="text-[6px] font-mono text-[var(--text-muted)] tracking-widest block">BYTES</span><span className="text-[9px] font-mono font-bold text-[var(--alert-green)] tabular-nums">{totalBytes > 1024 ? `${(totalBytes/1024).toFixed(1)}K` : totalBytes}</span></div>
            <div className="text-right"><span className="text-[6px] font-mono text-[var(--text-muted)] tracking-widest block">UP</span><span className="text-[9px] font-mono font-bold text-[var(--text-muted)] tabular-nums">{uptimeStr}</span></div>
          </div>
          {onClose && <button onClick={onClose} className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/5"><X className="w-3 h-3 text-[var(--text-muted)]" /></button>}
        </div>
      </div>

      {/* ═══ TAB BAR ═══ */}
      <div className="flex items-center px-4 py-0" style={{ borderBottom:'1px solid rgba(255,255,255,0.03)',background:'rgba(0,0,0,0.3)' }}>
        {(['devices','packets'] as const).map(tab => (
          <button key={tab} onClick={()=>setView(tab)} className="relative px-4 py-2.5 text-[8px] font-mono font-bold tracking-[0.2em] uppercase transition-colors"
            style={{ color: view===tab ? 'var(--cyan-primary)' : 'var(--text-muted)' }}>
            {tab === 'devices' ? `DEVICES (${devices.length})` : `PACKETS (${packets.length})`}
            {view===tab && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background:'var(--cyan-primary)' }} />}
          </button>
        ))}
        <div className="flex-1" />
        <motion.button whileTap={{scale:0.95}} onClick={scan} disabled={scanning||!btOk}
          className="px-3 py-1.5 rounded-lg text-[7px] font-mono font-bold tracking-[0.15em] flex items-center gap-1.5 disabled:opacity-30"
          style={{ background:'rgba(0,230,255,0.06)',color:'var(--cyan-primary)',border:'1px solid rgba(0,230,255,0.1)' }}>
          {scanning ? <BluetoothSearching className="w-3 h-3 animate-pulse" /> : <Scan className="w-3 h-3" />}
          {scanning ? 'SCANNING' : 'SCAN'}
        </motion.button>
      </div>

      {/* ═══ CONTENT ═══ */}
      <div className="flex-1 overflow-hidden flex flex-col">

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{height:0}} animate={{height:'auto'}} exit={{height:0}} className="overflow-hidden">
              <div className="mx-3 mt-2 p-2 rounded-lg flex items-center gap-2" style={{background:'rgba(255,61,61,0.04)',border:'1px solid rgba(255,61,61,0.1)'}}>
                <AlertTriangle className="w-3 h-3 text-[#FF3D3D] shrink-0" /><span className="text-[7px] font-mono text-[#FF3D3D] flex-1">{error}</span>
                <button onClick={()=>setError(null)}><X className="w-2.5 h-2.5 text-[#FF3D3D]/50" /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ DEVICES VIEW ═══ */}
        {view === 'devices' && (
          <div className="flex-1 overflow-y-auto styled-scrollbar px-3 py-3 space-y-2">
            {devices.length === 0 && !scanning && btOk && (
              <div className="flex flex-col items-center py-10 opacity-40">
                <Radio className="w-8 h-8 text-[var(--cyan-primary)]/30 mb-3" />
                <p className="text-[8px] font-mono text-[var(--text-muted)] tracking-wider text-center">No devices captured.<br/>Tap SCAN to detect nearby BLE peripherals.</p>
              </div>
            )}
            {!btOk && <div className="p-3 rounded-lg" style={{background:'rgba(255,61,61,0.04)',border:'1px solid rgba(255,61,61,0.08)'}}><span className="text-[8px] font-mono text-[#FF3D3D]">Web Bluetooth unavailable — use Chrome or Edge</span></div>}

            {devices.map(dev => {
              const m = META[dev.type]; const Icon = m.icon; const isConn = connecting===dev.id; const isGatt = gattTarget===dev.id; const isExp = expandedDevice===dev.id;
              return (
                <motion.div key={dev.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} layout>
                  <div className="rounded-xl overflow-hidden" style={{ background:dev.connected?`linear-gradient(135deg,${m.color}06,${m.color}02)`:'rgba(255,255,255,0.015)', border:`1px solid ${dev.connected?m.color+'15':'rgba(255,255,255,0.04)'}`, boxShadow:dev.connected?`0 0 20px ${m.color}08`:'none' }}>

                    {/* Card */}
                    <button className="w-full p-3.5 flex items-start gap-3 text-left" onClick={()=>setExpandedDevice(isExp?null:dev.id)}>
                      <motion.div animate={dev.probing?{rotate:[0,360]}:{}} transition={{duration:2,repeat:Infinity,ease:'linear'}}
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative"
                        style={{ background:`linear-gradient(135deg,${m.color}12,${m.color}05)`,border:`1px solid ${m.color}18` }}>
                        {dev.probing||isConn ? <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{borderColor:m.color,borderTopColor:'transparent'}} /> : <Icon className="w-5 h-5" style={{color:m.color}} />}
                        {dev.connected && <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[var(--alert-green)] border-2 animate-pulse" style={{borderColor:'#06080c'}} />}
                      </motion.div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono font-bold text-[var(--text-primary)] truncate">{dev.name}</span>
                          {dev.connected && <span className="text-[5px] font-mono px-1 py-0.5 rounded bg-[var(--alert-green)]/10 text-[var(--alert-green)] tracking-widest">LIVE</span>}
                        </div>
                        {dev.probing ? (
                          <div className="flex items-center gap-2">
                            <motion.div className="h-1 rounded-full flex-1" style={{background:`${m.color}10`}}>
                              <motion.div className="h-full rounded-full" style={{background:m.color}} animate={{width:['0%','60%','100%']}} transition={{duration:3}} />
                            </motion.div>
                            <span className="text-[6px] font-mono tracking-wider" style={{color:m.color}}>PROBING</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[7px] font-mono px-1.5 py-0.5 rounded-md tracking-wider font-bold" style={{background:`${m.color}10`,color:m.color,border:`1px solid ${m.color}12`}}>{m.label.toUpperCase()}</span>
                            {dev.info?.classifiedBy && <span className="text-[5px] font-mono px-1 py-0.5 rounded bg-white/4 text-[var(--text-muted)] tracking-[0.15em]">{dev.info.classifiedBy.toUpperCase()}</span>}
                            {dev.battery!=null && <span className="text-[6px] font-mono" style={{color:dev.battery>50?'var(--alert-green)':dev.battery>20?'#FFB800':'#FF3D3D'}}>{dev.battery}%</span>}
                            {dev.probeMs!=null && <span className="text-[5px] font-mono text-[var(--text-muted)]">{dev.probeMs}ms</span>}
                            {dev.info&&dev.info.services.length>0 && <span className="text-[5px] font-mono text-[var(--text-muted)]">{dev.info.services.length} svcs</span>}
                          </div>
                        )}
                      </div>
                      <ChevronDown className={`w-3 h-3 text-[var(--text-muted)] transition-transform mt-1 shrink-0 ${isExp?'rotate-180':''}`} />
                    </button>

                    {/* Expanded */}
                    <AnimatePresence>
                      {isExp && !dev.probing && (
                        <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
                          <div className="px-3.5 pb-3.5 pt-0" style={{borderTop:`1px solid rgba(255,255,255,0.03)`}}>

                            {/* Detail pills */}
                            {dev.info && (dev.info.manufacturer||dev.info.model||dev.info.firmware||dev.info.hardware||dev.info.serial) && (
                              <div className="flex flex-wrap gap-1.5 mt-2.5 mb-2">
                                {dev.info.manufacturer && <span className="text-[6px] font-mono px-2 py-1 rounded-lg bg-white/3 text-[var(--text-secondary)] tracking-wider"><Tag className="w-2 h-2 inline mr-1 opacity-40" />{dev.info.manufacturer}</span>}
                                {dev.info.model && <span className="text-[6px] font-mono px-2 py-1 rounded-lg bg-white/3 text-[var(--text-secondary)] tracking-wider"><Cpu className="w-2 h-2 inline mr-1 opacity-40" />{dev.info.model}</span>}
                                {dev.info.firmware && <span className="text-[6px] font-mono px-2 py-1 rounded-lg bg-white/3 text-[var(--text-muted)] tracking-wider">FW {dev.info.firmware}</span>}
                                {dev.info.hardware && <span className="text-[6px] font-mono px-2 py-1 rounded-lg bg-white/3 text-[var(--text-muted)] tracking-wider">HW {dev.info.hardware}</span>}
                                {dev.info.serial && <span className="text-[6px] font-mono px-2 py-1 rounded-lg bg-white/3 text-[var(--text-muted)] tracking-wider">S/N {dev.info.serial}</span>}
                                {dev.info.appearance!=null && <span className="text-[6px] font-mono px-2 py-1 rounded-lg tracking-wider" style={{background:`${m.color}06`,color:`${m.color}90`}}>{dev.info.appearanceLabel} · 0x{dev.info.appearance.toString(16).padStart(4,'0')}</span>}
                              </div>
                            )}

                            {/* Services */}
                            {dev.info && dev.info.services.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-3">
                                {dev.info.services.map((s,i) => <span key={i} className="text-[5px] font-mono px-1.5 py-0.5 rounded tracking-wider" style={{background:`${m.color}06`,color:`${m.color}70`}}>{s}</span>)}
                              </div>
                            )}

                            {/* ID */}
                            <div className="text-[5px] font-mono text-[var(--text-muted)] mb-3 tracking-wider opacity-50">ID: {dev.id}</div>

                            {/* Actions */}
                            <div className="flex gap-2">
                              {dev.connected ? (
                                <>
                                  <motion.button whileTap={{scale:0.95}} onClick={()=>explore(dev)} className="flex-1 py-2 rounded-lg text-[7px] font-mono font-bold tracking-[0.15em] flex items-center justify-center gap-1.5" style={{background:`${m.color}08`,color:m.color,border:`1px solid ${m.color}10`}}><Layers className="w-3 h-3"/>EXPLORE GATT</motion.button>
                                  <motion.button whileTap={{scale:0.95}} onClick={()=>disconnect(dev)} className="py-2 px-3 rounded-lg text-[7px] font-mono font-bold tracking-[0.15em] flex items-center gap-1.5" style={{background:'rgba(255,61,61,0.05)',color:'#FF6B6B',border:'1px solid rgba(255,61,61,0.06)'}}><Unplug className="w-3 h-3"/>DROP</motion.button>
                                </>
                              ) : (
                                <motion.button whileTap={{scale:0.95}} onClick={()=>connect(dev)} disabled={!!connecting} className="flex-1 py-2.5 rounded-lg text-[8px] font-mono font-bold tracking-[0.15em] flex items-center justify-center gap-2 disabled:opacity-30" style={{background:`${m.color}08`,color:m.color,border:`1px solid ${m.color}10`}}><Zap className="w-3.5 h-3.5"/>{isConn?'PAIRING...':'CONNECT'}</motion.button>
                              )}
                            </div>

                            {/* ── GATT Explorer ── */}
                            <AnimatePresence>
                              {isGatt && (
                                <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
                                  <div className="mt-3 pt-3" style={{borderTop:`1px solid ${m.color}08`}}>
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-1.5"><Terminal className="w-3 h-3" style={{color:m.color}}/><span className="text-[7px] font-mono font-bold tracking-[0.15em]" style={{color:m.color}}>GATT TREE</span></div>
                                      <button onClick={()=>{setGattTarget(null);setGattSvcs([]);}} className="p-1 rounded hover:bg-white/5"><X className="w-2.5 h-2.5 text-[var(--text-muted)]" /></button>
                                    </div>
                                    {gattLoading ? (
                                      <div className="flex items-center justify-center py-5 gap-2"><div className="w-4 h-4 border-2 rounded-full animate-spin" style={{borderColor:m.color,borderTopColor:'transparent'}}/><span className="text-[7px] font-mono tracking-wider animate-pulse" style={{color:m.color}}>ENUMERATING...</span></div>
                                    ) : gattSvcs.length===0 ? (
                                      <div className="text-center py-4"><p className="text-[7px] font-mono text-[var(--text-muted)]">No services</p></div>
                                    ) : (
                                      <div className="space-y-1">
                                        {gattSvcs.map(svc => (
                                          <div key={svc.uuid}>
                                            <button onClick={()=>setExpandedSvc(expandedSvc===svc.uuid?null:svc.uuid)} className="w-full p-2 rounded-lg flex items-center gap-2 text-left hover:bg-white/2" style={{background:expandedSvc===svc.uuid?'rgba(255,255,255,0.02)':'transparent'}}>
                                              <Bluetooth className="w-2.5 h-2.5 shrink-0" style={{color:m.color}}/><span className="text-[7px] font-mono font-bold text-[var(--text-primary)] truncate flex-1">{svc.name}</span>
                                              <span className="text-[6px] font-mono px-1 py-0.5 rounded" style={{background:`${m.color}08`,color:`${m.color}80`}}>{svc.chars.length}</span>
                                              <ChevronRight className={`w-2.5 h-2.5 text-[var(--text-muted)] transition-transform ${expandedSvc===svc.uuid?'rotate-90':''}`}/>
                                            </button>
                                            <AnimatePresence>
                                              {expandedSvc===svc.uuid && (
                                                <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
                                                  <div className="pl-4 pr-1 py-1 space-y-1">
                                                    {svc.chars.map(ch => {
                                                      const ck=`${svc.uuid}/${ch.uuid}`;const flags=[ch.props.r&&'R',ch.props.w&&'W',ch.props.wn&&'Wn',ch.props.n&&'N',ch.props.i&&'I'].filter(Boolean).join('·');const wVal=writeInput[ck]||'';const wOk=!wVal||validHex(wVal);
                                                      return (
                                                        <div key={ch.uuid} className="p-2 rounded-lg" style={{background:'rgba(0,0,0,0.25)',borderLeft:`2px solid ${m.color}12`}}>
                                                          <div className="flex items-center gap-1 mb-1"><span className="text-[6px] font-mono font-bold text-[var(--text-primary)] truncate flex-1">{ch.name}</span><span className="text-[5px] font-mono px-1 py-0.5 rounded tracking-wider" style={{background:`${m.color}06`,color:`${m.color}80`}}>{flags}</span></div>
                                                          <div className="text-[4px] font-mono text-[var(--text-muted)] truncate mb-1.5 opacity-60">{ch.uuid}</div>
                                                          {ch.value && (
                                                            <div className="flex items-center gap-1 mb-1.5">
                                                              <div className="flex-1 rounded-lg px-2 py-1 min-w-0 font-mono" style={{background:'rgba(0,0,0,0.3)'}}>
                                                                <div className="text-[7px] text-[var(--alert-green)] truncate">{ch.value}</div>
                                                                {ch.hex&&ch.hex!==ch.value && <div className="text-[5px] text-[var(--text-muted)] truncate mt-0.5 opacity-60">{ch.hex}</div>}
                                                              </div>
                                                              <button onClick={()=>{navigator.clipboard?.writeText(ch.value||'');setCopied(ck);setTimeout(()=>setCopied(null),1500);}} className="p-1 rounded hover:bg-white/5 shrink-0">
                                                                {copied===ck?<Check className="w-2 h-2 text-[var(--alert-green)]"/>:<Copy className="w-2 h-2 text-[var(--text-muted)]"/>}
                                                              </button>
                                                            </div>
                                                          )}
                                                          <div className="flex items-center gap-1 flex-wrap">
                                                            {ch.props.r && <button onClick={async()=>{if(!ch.char)return;try{const v=await ch.char.readValue();const d=decode(v);setGattSvcs(p=>p.map(s=>s.uuid===svc.uuid?{...s,chars:s.chars.map(c=>c.uuid===ch.uuid?{...c,value:d.text,hex:d.hex}:c)}:s));log('READ',dev.name,`${ch.name}: ${d.text.slice(0,40)}`,d.hex,v.byteLength);}catch(e:any){log('ERROR',dev.name,`Read fail: ${ch.name}`);}}} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[5px] font-mono tracking-wider" style={{background:`${m.color}06`,color:m.color}}><Eye className="w-2 h-2"/>READ</button>}
                                                            {ch.props.n && <button onClick={()=>toggleNotify(svc.uuid,ch,dev.name)} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[5px] font-mono tracking-wider" style={{background:ch.notifying?'rgba(0,255,136,0.06)':'rgba(255,255,255,0.02)',color:ch.notifying?'#00FF88':'var(--text-muted)'}}>{ch.notifying?<Bell className="w-2 h-2"/>:<BellOff className="w-2 h-2"/>}{ch.notifying?'LIVE':'SUB'}</button>}
                                                            {(ch.props.w||ch.props.wn) && (
                                                              <div className="flex items-center gap-0.5 flex-1">
                                                                <input type="text" placeholder="FF 01" value={wVal} onChange={e=>setWriteInput(p=>({...p,[ck]:e.target.value}))} className="flex-1 rounded px-1.5 py-0.5 text-[6px] font-mono text-[var(--text-primary)] outline-none min-w-0" style={{background:'rgba(0,0,0,0.3)',border:`1px solid ${wOk?'transparent':'rgba(255,61,61,0.3)'}`}} />
                                                                <button onClick={async()=>{if(!ch.char||!wVal||!validHex(wVal))return;try{await writeSafe(ch.char,parseHex(wVal),ch.props.w);log('WRITE',dev.name,`${ch.name}: ${wVal}`,wVal.replace(/\s/g,''),parseHex(wVal).length);setWriteInput(p=>({...p,[ck]:''}));}catch(e:any){log('ERROR',dev.name,`Write fail: ${ch.name}`);}}} disabled={!wVal||!wOk} className="p-0.5 rounded shrink-0 disabled:opacity-30" style={{color:'#FFB800'}}><Send className="w-2 h-2"/></button>
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
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ═══ PACKET LOG VIEW ═══ */}
        {view === 'packets' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Log header */}
            <div className="flex items-center justify-between px-4 py-1.5" style={{background:'rgba(0,0,0,0.3)',borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
              <span className="text-[6px] font-mono text-[var(--text-muted)] tracking-[0.2em]">TIME · OP · DEVICE · DETAIL · HEX</span>
              <div className="flex items-center gap-2">
                <button onClick={()=>setAutoScroll(!autoScroll)} className={`text-[6px] font-mono tracking-wider px-1.5 py-0.5 rounded ${autoScroll?'text-[var(--alert-green)]':'text-[var(--text-muted)]'}`}>{autoScroll?'▼ AUTO':'⏸ HOLD'}</button>
                <button onClick={()=>{setPackets([]);setTotalBytes(0);pktId.current=0;}} className="text-[6px] font-mono text-[var(--text-muted)] tracking-wider px-1.5 py-0.5 rounded hover:bg-white/5">CLEAR</button>
              </div>
            </div>
            {/* Log body */}
            <div ref={logRef} className="flex-1 overflow-y-auto styled-scrollbar font-mono" style={{background:'#020304'}}>
              {packets.length === 0 ? (
                <div className="flex items-center justify-center h-full opacity-30"><span className="text-[8px] font-mono text-[var(--text-muted)] tracking-wider">Waiting for BLE activity...</span></div>
              ) : (
                <div className="py-1">
                  {packets.map(pkt => {
                    const opColor = OP_COLORS[pkt.op] || '#90A4AE';
                    return (
                      <div key={pkt.id} className="px-3 py-[3px] flex items-start gap-0 hover:bg-white/[0.02] transition-colors group" style={{fontSize:10,lineHeight:'16px'}}>
                        <span className="text-[var(--text-muted)] opacity-40 shrink-0 w-[72px] tabular-nums">{fmtTs(pkt.ts)}</span>
                        <span className="shrink-0 w-[80px] font-bold tracking-wider" style={{color:opColor}}>{pkt.op}</span>
                        <span className="text-[var(--cyan-primary)] opacity-60 shrink-0 w-[90px] truncate">{pkt.device}</span>
                        <span className="text-[var(--text-secondary)] flex-1 truncate">{pkt.detail}</span>
                        {pkt.hex && <span className="text-[var(--text-muted)] opacity-30 ml-2 truncate max-w-[100px] group-hover:opacity-60 hidden sm:block">{pkt.hex}</span>}
                        {pkt.bytes!=null && <span className="text-[var(--text-muted)] opacity-20 ml-1 shrink-0 tabular-nums">{pkt.bytes}B</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ FOOTER ═══ */}
      <div className="flex items-center justify-between px-4 py-2" style={{background:'rgba(0,0,0,0.4)',borderTop:'1px solid rgba(255,255,255,0.03)'}}>
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${btOk?'bg-[var(--alert-green)]':'bg-[#FF3D3D]'} ${scanning?'animate-pulse':''}`} />
          <span className="text-[6px] font-mono text-[var(--text-muted)] tracking-[0.15em]">{btOk?'WEB BLUETOOTH':'UNAVAILABLE'}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[5px] font-mono text-[var(--text-muted)]/30 tracking-widest">OSIRIS · BLE SNIFFER</span>
          {connCount > 0 && <span className="text-[6px] font-mono text-[var(--alert-green)] tracking-wider animate-pulse">● {connCount} LIVE</span>}
        </div>
      </div>
    </div>
  );
}
