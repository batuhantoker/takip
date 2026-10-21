import type { Metadata } from 'next';
import { JewishHolidaysPage, jewishHolidaysMetadata } from '@/components/site/dates/jewish-holidays';

export function generateMetadata(): Promise<Metadata> {
  return jewishHolidaysMetadata();
}

export default function JewishHolidaysRoute() {
  return JewishHolidaysPage();
}
