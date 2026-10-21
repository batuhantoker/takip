import type { Metadata } from 'next';
import { RamadanDatesPage, ramadanDatesMetadata } from '@/components/site/ramadan/ramadan-dates';

export function generateMetadata(): Promise<Metadata> {
  return ramadanDatesMetadata();
}

export default function RamadanRoute() {
  return RamadanDatesPage();
}
