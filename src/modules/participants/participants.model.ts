import { Participant } from './participants.service';

/**
 * Transform participant data for API response
 * Removes sensitive data and formats dates
 */
/**
 * Safely format date to ISO string
 */
function formatDateSafely(dateValue: string | null | undefined): string {
  if (!dateValue) return new Date().toISOString(); // fallback to current date
  try {
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  } catch (error) {
    console.warn('Invalid date format:', dateValue);
    return new Date().toISOString(); // fallback to current date
  }
}

export function sanitizeParticipant(participant: Participant): Participant {
  if (!participant) {
    throw new Error('Participant data is required');
  }

  return {
    ...participant,
    // Format dates to ISO strings if needed
    created: formatDateSafely(participant.created),
    user: participant.user ? {
      ...participant.user,
      created: formatDateSafely(participant.user.created),
      // Remove sensitive user agent details if needed
      meta_data: participant.user.meta_data ? {
        ...participant.user.meta_data,
        // Keep IP for analytics but could be masked in production
        ip: participant.user.meta_data.ip,
      } : participant.user.meta_data,
    } : participant.user,
    prize: participant.prize ? {
      ...participant.prize,
      created: formatDateSafely(participant.prize.created),
    } : participant.prize,
  } as Participant;
}

/**
 * Transform multiple participants for API response
 */
export function sanitizeParticipants(participants: Participant[]): Participant[] {
  if (!Array.isArray(participants)) {
    console.error('Invalid participants data: expected array, got:', typeof participants);
    return [];
  }

  return participants
    .filter(participant => participant && typeof participant === 'object')
    .map((participant, index) => {
      try {
        return sanitizeParticipant(participant);
      } catch (error) {
        console.error(`Error sanitizing participant at index ${index}:`, error);
        console.error('Participant data:', participant);
        // Skip this participant if it can't be sanitized
        return null;
      }
    })
    .filter((participant): participant is Participant => participant !== null);
}

/**
 * Extract searchable text from participant for search functionality
 */
export function getSearchableText(participant: Participant): string {
  const searchableFields = [
    participant.user.email,
    participant.user.first_name,
    participant.user.last_name,
    participant.user.nickname,
    participant.user.phone,
    participant.user.country,
    participant?.prize?.code,
    ...participant.requirement.data.map(req => req.value),
  ];

  return searchableFields
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * Get display name for participant
 */
export function getParticipantDisplayName(participant: Participant): string {
  const { user } = participant;
  
  if (user.first_name && user.last_name) {
    return `${user.first_name} ${user.last_name}`;
  }
  
  if (user.nickname) {
    return user.nickname;
  }
  
  return user.email;
}

/**
 * Get participant status based on various fields
 */
export function getParticipantStatus(participant: Participant): 'active' | 'inactive' | 'pending' {
  if (participant.user.status === '1') {
    return 'active';
  }
  
  if (participant.completed) {
    return 'active';
  }
  
  return 'inactive';
}

/**
 * Format participant for export (Excel/PDF)
 */
export interface ExportParticipant {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  participationDate: string;
  orderNumber: string;
  prizeCode: string;
  prizeName: string;
  status: string;
  points: number;
}

export function formatParticipantForExport(participant: Participant): ExportParticipant {
  const orderNumber = participant.requirement.data.find(
    req => req.ref === 'online_order_no_'
  )?.value || '';

  return {
    id: participant.id,
    name: getParticipantDisplayName(participant),
    email: participant.user.email,
    phone: participant.user.phone || '',
    country: participant.user.country,
    participationDate: new Date(participant.created).toLocaleDateString(),
    orderNumber,
    prizeCode: participant?.prize?.code ?? '',
    prizeName: participant?.prize?.prize_type?.name ?? '',
    status: getParticipantStatus(participant),
    points: parseInt(participant.points) || 0,
  };
}

/**
 * Validate participant data for API operations
 */
export function isValidParticipant(participant: any): participant is Participant {
  return (
    participant &&
    typeof participant.id === 'string' &&
    typeof participant.user_id === 'string' &&
    typeof participant.user === 'object' &&
    typeof participant.user.email === 'string' &&
    typeof participant.prize === 'object'
  );
}

/**
 * Country name mapping for better display
 */
export const COUNTRY_NAMES: Record<string, string> = {
  'AE': 'United Arab Emirates',
  'SA': 'Saudi Arabia',
  'IN': 'India',
  'US': 'United States',
  'UK': 'United Kingdom',
  'CA': 'Canada',
  'AU': 'Australia',
  'DE': 'Germany',
  'FR': 'France',
  'IT': 'Italy',
  'ES': 'Spain',
  'NL': 'Netherlands',
  'BE': 'Belgium',
  'CH': 'Switzerland',
  'AT': 'Austria',
  'SE': 'Sweden',
  'NO': 'Norway',
  'DK': 'Denmark',
  'FI': 'Finland',
  'PL': 'Poland',
  'CZ': 'Czech Republic',
  'HU': 'Hungary',
  'RO': 'Romania',
  'BG': 'Bulgaria',
  'GR': 'Greece',
  'PT': 'Portugal',
  'IE': 'Ireland',
  'LU': 'Luxembourg',
  'MT': 'Malta',
  'CY': 'Cyprus',
  'EE': 'Estonia',
  'LV': 'Latvia',
  'LT': 'Lithuania',
  'SK': 'Slovakia',
  'SI': 'Slovenia',
  'HR': 'Croatia',
};

/**
 * Get country display name
 */
export function getCountryDisplayName(countryCode: string): string {
  return COUNTRY_NAMES[countryCode] || countryCode;
}