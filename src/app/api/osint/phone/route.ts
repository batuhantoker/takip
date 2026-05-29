import { NextResponse } from 'next/server';

const COUNTRY_CODES: Record<string, string> = {
  '1': 'US/Canada', '44': 'United Kingdom', '61': 'Australia', '81': 'Japan', '86': 'China',
  '49': 'Germany', '33': 'France', '7': 'Russia/Kazakhstan', '55': 'Brazil', '91': 'India',
  '27': 'South Africa', '82': 'South Korea', '34': 'Spain', '39': 'Italy', '52': 'Mexico',
  '31': 'Netherlands', '46': 'Sweden', '41': 'Switzerland', '48': 'Poland', '43': 'Austria',
  '32': 'Belgium', '45': 'Denmark', '358': 'Finland', '47': 'Norway', '353': 'Ireland',
  '64': 'New Zealand', '65': 'Singapore', '60': 'Malaysia', '62': 'Indonesia', '63': 'Philippines',
  '66': 'Thailand', '84': 'Vietnam', '92': 'Pakistan', '880': 'Bangladesh', '94': 'Sri Lanka',
  '98': 'Iran', '90': 'Turkey', '972': 'Israel', '966': 'Saudi Arabia', '971': 'UAE',
  '20': 'Egypt', '234': 'Nigeria', '254': 'Kenya', '255': 'Tanzania', '256': 'Uganda',
  '212': 'Morocco', '213': 'Algeria', '216': 'Tunisia', '218': 'Libya', '221': 'Senegal',
  '225': 'Ivory Coast', '233': 'Ghana', '237': 'Cameroon', '244': 'Angola', '258': 'Mozambique',
  '260': 'Zambia', '263': 'Zimbabwe', '264': 'Namibia', '267': 'Botswana', '268': 'Eswatini',
  '54': 'Argentina', '56': 'Chile', '57': 'Colombia', '58': 'Venezuela', '51': 'Peru',
  '591': 'Bolivia', '593': 'Ecuador', '595': 'Paraguay', '598': 'Uruguay', '53': 'Cuba',
  '501': 'Belize', '502': 'Guatemala', '503': 'El Salvador', '504': 'Honduras', '505': 'Nicaragua',
  '506': 'Costa Rica', '507': 'Panama', '509': 'Haiti', '1809': 'Dominican Republic', '1829': 'Dominican Republic',
  '1849': 'Dominican Republic', '1787': 'Puerto Rico', '1939': 'Puerto Rico', '1876': 'Jamaica',
  '380': 'Ukraine', '375': 'Belarus', '370': 'Lithuania', '371': 'Latvia', '372': 'Estonia'
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const number = searchParams.get('number');

  if (!number) {
    return NextResponse.json({ error: 'Missing phone number parameter' }, { status: 400 });
  }

  // Pure JS parsing to avoid Turbopack NPM caching issues on live servers
  let cleanNumber = number.replace(/[^\d+]/g, '');
  
  // Default assumptions if + is missing
  if (!cleanNumber.startsWith('+') && cleanNumber.length > 10) {
     cleanNumber = '+' + cleanNumber.replace(/^00/, '');
  } else if (!cleanNumber.startsWith('+') && cleanNumber.length === 10) {
     cleanNumber = '+1' + cleanNumber; // Assume US format for 10 digits
  }

  let cc = '';
  let national = cleanNumber.replace('+', '');
  
  if (cleanNumber.startsWith('+')) {
     const withoutPlus = cleanNumber.substring(1);
     // Try 4, 3, 2, 1 digit country codes
     for (let i = 4; i >= 1; i--) {
        const prefix = withoutPlus.substring(0, i);
        if (COUNTRY_CODES[prefix]) {
           cc = prefix;
           national = withoutPlus.substring(i);
           break;
        }
     }
  }

  // Simulate Line Type heuristically
  const firstDigit = national.charAt(0);
  let lineType = 'LANDLINE';
  if (cc === '1' && national.length === 10) {
     lineType = 'MOBILE_OR_LANDLINE';
  } else if (firstDigit === '7' || firstDigit === '8' || firstDigit === '9') {
     lineType = 'MOBILE'; // Common in Europe/Asia
  }

  const region = cc ? COUNTRY_CODES[cc] : 'Unknown Region';
  
  return NextResponse.json({
      query: number,
      valid: cleanNumber.length >= 7,
      number: cleanNumber.startsWith('+') ? cleanNumber : `+${cleanNumber}`,
      international: cleanNumber.startsWith('+') ? `${cleanNumber.substring(0, cc.length+1)} ${national}` : cleanNumber,
      national: national,
      country_code: cc ? `+${cc}` : 'Unknown',
      region: region,
      line_type: lineType
  });
}
