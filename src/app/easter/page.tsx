import type { Metadata } from 'next';
import { EasterDatesPage, easterDatesMetadata } from '@/components/site/dates/easter-dates';

export function generateMetadata(): Promise<Metadata> {
  return easterDatesMetadata();
}

export default function EasterRoute() {
  return EasterDatesPage();
}
