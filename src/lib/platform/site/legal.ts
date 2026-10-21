import { msg } from '@/lib/core/i18n/translator';

/** Where people reach TAKIP: Cloudflare Email Routing forwards it. */
export const CONTACT_EMAIL = 'hello@takip.dev';

/** The pages about TAKIP itself, linked from every public page's footer, the map's hidden outline and the 404. */
export const POLICY_LINKS = [
  { href: '/about', label: msg('About TAKIP') },
  { href: '/contact', label: msg('Contact') },
  { href: '/privacy', label: msg('Privacy') },
  { href: '/cookies', label: msg('Cookies') },
  { href: '/terms', label: msg('Terms') },
  { href: '/disclaimer', label: msg('Disclaimer') },
  { href: '/copyright', label: msg('Copyright and removal') },
] as const;
