export type LocationRole = 'doctor' | 'nurse';

export type DummyLocation = {
  id: string;
  initials: string;
  city: string;
  latitude: number;
  longitude: number;
  role: LocationRole;
};

export const MAP_REGION = {
  latitude: 51.22,
  longitude: 5.23,
  latitudeDelta: 1.15,
  longitudeDelta: 1.45,
};

export const DUMMY_LOCATIONS: DummyLocation[] = [
  { id: 'bv1', initials: 'BV1', city: 'Breda', latitude: 51.5719, longitude: 4.7683, role: 'doctor' },
  { id: 'bv2', initials: 'BV2', city: 'Tilburg', latitude: 51.5555, longitude: 5.0913, role: 'nurse' },
  { id: 'bv3', initials: 'BV3', city: 'Eindhoven', latitude: 51.4416, longitude: 5.4697, role: 'doctor' },
  { id: 'bv4', initials: 'BV4', city: 'Maastricht', latitude: 50.8514, longitude: 5.6910, role: 'nurse' },
];

export const MARKER_IMAGES: Record<LocationRole, string> = {
  doctor: '/doctor.png',
  nurse: '/nurse.png',
};

export const MARKER_BACKGROUND = 'rgba(201, 27, 35, 0.5)';
