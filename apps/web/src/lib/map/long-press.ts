// A long press on the map, or a right click: how a point of the map is picked to look at, as in
// most map apps. Touch browsers do not agree on reporting long presses (iOS Safari sends no
// contextmenu), so touches are timed here.

import type { LatLon } from '@tesel/protocol';
import type { Map as MapLibreMap, MapMouseEvent, MapTouchEvent } from 'maplibre-gl';

/** How long a finger must stay down. */
const HOLD_MS = 600;
/** How far it may drift meanwhile, in CSS pixels. */
const TOLERANCE_PX = 10;

export function onLongPress(map: MapLibreMap, handler: (at: LatLon) => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let start: { x: number; y: number } | null = null;
  /** Android also sends contextmenu after a long touch; the press was already handled. */
  let handledAt = 0;

  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    start = null;
  };
  const fire = (at: LatLon) => {
    handledAt = Date.now();
    handler(at);
  };
  const onTouchStart = (event: MapTouchEvent) => {
    cancel();
    if (event.points.length !== 1) return;
    start = { x: event.point.x, y: event.point.y };
    const at = { lat: event.lngLat.lat, lon: event.lngLat.lng };
    timer = setTimeout(() => {
      cancel();
      fire(at);
    }, HOLD_MS);
  };
  const onTouchMove = (event: MapTouchEvent) => {
    if (start === null) return;
    const moved = Math.hypot(event.point.x - start.x, event.point.y - start.y);
    if (moved > TOLERANCE_PX || event.points.length !== 1) cancel();
  };
  const onContextMenu = (event: MapMouseEvent) => {
    event.preventDefault();
    if (Date.now() - handledAt < 1000) return;
    fire({ lat: event.lngLat.lat, lon: event.lngLat.lng });
  };

  map.on('touchstart', onTouchStart);
  map.on('touchmove', onTouchMove);
  map.on('touchend', cancel);
  map.on('touchcancel', cancel);
  map.on('movestart', cancel);
  map.on('contextmenu', onContextMenu);
  return () => {
    cancel();
    map.off('touchstart', onTouchStart);
    map.off('touchmove', onTouchMove);
    map.off('touchend', cancel);
    map.off('touchcancel', cancel);
    map.off('movestart', cancel);
    map.off('contextmenu', onContextMenu);
  };
}
