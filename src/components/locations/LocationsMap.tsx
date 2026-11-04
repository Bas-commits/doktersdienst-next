'use client';

import { useMemo, useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { Phone, X } from 'lucide-react';
import { DUMMY_LOCATIONS, MAP_REGION, MARKER_BACKGROUND, MARKER_IMAGES, type DummyLocation } from '@/lib/dummy-locations';
import 'leaflet/dist/leaflet.css';

const GREEN = '#00BE92';

function createMarkerIcon(initials: string, role: DummyLocation['role']): L.DivIcon {
  const backgroundImage = MARKER_IMAGES[role];
  return L.divIcon({
    className: 'location-marker-icon',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;">
        <div style="width:44px;height:44px;border-radius:50%;background-color:${MARKER_BACKGROUND};background-image:url('${backgroundImage}');background-size:68%;background-repeat:no-repeat;background-position:center;border:2px solid white;display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700;box-shadow:0 1px 3px rgba(0,0,0,0.2);font-family:Lato,sans-serif;text-shadow:0 1px 2px rgba(0,0,0,0.75);">
          ${initials}
        </div>
        <div style="width:10px;height:10px;border-radius:2px;background:${GREEN};border:1px solid white;margin-top:4px;"></div>
      </div>
    `,
    iconSize: [44, 58],
    iconAnchor: [22, 58],
  });
}

function latitudeDeltaToZoom(latitudeDelta: number): number {
  return Math.round(Math.log2(360 / latitudeDelta)) - 1;
}

export function LocationsMap() {
  const [selectedLocation, setSelectedLocation] = useState<DummyLocation | null>(null);
  const zoom = latitudeDeltaToZoom(MAP_REGION.latitudeDelta);

  const markerIcons = useMemo(
    () =>
      Object.fromEntries(
        DUMMY_LOCATIONS.map((location) => [location.id, createMarkerIcon(location.initials, location.role)])
      ),
    []
  );

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[MAP_REGION.latitude, MAP_REGION.longitude]}
        zoom={zoom}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {DUMMY_LOCATIONS.map((location) => (
          <Marker
            key={location.id}
            position={[location.latitude, location.longitude]}
            icon={markerIcons[location.id]}
            eventHandlers={{
              click: () => setSelectedLocation(location),
            }}
          />
        ))}
      </MapContainer>

      {selectedLocation && (
        <div
          className="absolute inset-x-0 bottom-0 z-[1000] rounded-t-xl border-t bg-white p-5 shadow-lg"
          role="dialog"
          aria-label={`Locatie ${selectedLocation.city}`}
        >
          <button
            type="button"
            onClick={() => setSelectedLocation(null)}
            className="absolute top-3 right-4 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Sluiten"
          >
            <X className="size-4" />
          </button>
          <div className="flex items-start gap-5 pr-8">
            <div
              className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full text-white shadow-sm"
              style={{ background: 'linear-gradient(90deg, #ff6666, #ff0000)' }}
            >
              <Phone className="size-6" aria-hidden />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Locatie</p>
              <p className="text-xl font-bold text-foreground">{selectedLocation.city}</p>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className="inline-block size-2.5 rounded-sm border border-white"
                  style={{ backgroundColor: GREEN }}
                  aria-hidden
                />
                <span className="text-sm text-foreground/90">Dienst</span>
                <span className="text-sm text-muted-foreground">{selectedLocation.initials}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
