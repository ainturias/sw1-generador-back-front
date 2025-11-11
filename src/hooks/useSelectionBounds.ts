import { shallow, useSelf, useStorage } from "@liveblocks/react";
import { Layer, XYWH, LayerType, EntityLayer } from "~/types";

function boundingBox(layers: Layer[]): XYWH | null {
  // Filtrar solo entidades (que tienen x, y, width, height)
  const entities = layers.filter(
    (layer): layer is EntityLayer => layer.type === LayerType.Entity
  );

  const first = entities[0];
  if (!first) return null;

  let left = first.x;
  let right = first.x + first.width;
  let top = first.y;
  let bottom = first.y + first.height;

  for (let i = 1; i < entities.length; i++) {
    const { x, y, width, height } = entities[i]!;
    if (left > x) {
      left = x;
    }
    if (right < x + width) {
      right = x + width;
    }
    if (top > y) {
      top = y;
    }
    if (bottom < y + height) {
      bottom = y + height;
    }
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

export default function useSelectionBounds() {
  const selection = useSelf((me) => me.presence.selection);
  return useStorage((root) => {
    const seletedLayers = selection
      ?.map((layerId) => root.layers.get(layerId)!)
      .filter(Boolean);

    return boundingBox(seletedLayers ?? []);
  }, shallow);
}
