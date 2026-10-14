/** The common ports worth a connect probe, with the service a reader expects. Pure, so the client can name ports too. */
export const COMMON_PORTS: [number, string][] = [
  [21, 'FTP'], [22, 'SSH'], [23, 'Telnet'], [25, 'SMTP'], [53, 'DNS'],
  [80, 'HTTP'], [110, 'POP3'], [111, 'RPC'], [135, 'MSRPC'], [139, 'NetBIOS'],
  [143, 'IMAP'], [443, 'HTTPS'], [445, 'SMB'], [993, 'IMAPS'], [995, 'POP3S'],
  [1433, 'MSSQL'], [1723, 'PPTP'], [2049, 'NFS'], [3000, 'HTTP alt'], [3306, 'MySQL'],
  [3389, 'RDP'], [5432, 'PostgreSQL'], [5900, 'VNC'], [6379, 'Redis'], [8080, 'HTTP proxy'],
  [8443, 'HTTPS alt'], [9200, 'Elasticsearch'], [11211, 'Memcached'], [27017, 'MongoDB'],
];

// Seen in Shodan records often enough to name, though not worth a live probe.
const MORE: [number, string][] = [
  [102, 'Siemens S7'], [161, 'SNMP'], [179, 'BGP'], [389, 'LDAP'], [465, 'SMTPS'], [502, 'Modbus'],
  [500, 'IKE'], [587, 'SMTP submission'], [631, 'IPP'], [636, 'LDAPS'], [853, 'DNS over TLS'],
  [1883, 'MQTT'], [1900, 'UPnP'], [2082, 'cPanel'], [2083, 'cPanel'], [2222, 'SSH alt'],
  [2375, 'Docker API'], [2376, 'Docker API'], [5060, 'SIP'], [5222, 'XMPP'], [5353, 'mDNS'],
  [5601, 'Kibana'], [5672, 'AMQP'], [5985, 'WinRM'], [6443, 'Kubernetes API'], [7547, 'TR-069'],
  [8000, 'HTTP alt'], [8008, 'HTTP alt'], [8081, 'HTTP alt'], [8888, 'HTTP alt'], [9000, 'HTTP alt'],
  [9090, 'HTTP alt'], [9100, 'Printer'], [10000, 'Webmin'], [20000, 'DNP3'], [47808, 'BACnet'],
];

const NAMES = new Map<number, string>([...COMMON_PORTS, ...MORE]);

export const serviceName = (port: number): string | undefined => NAMES.get(port);
