import { useStorage } from "@liveblocks/react";
import { memo } from "react";
import { LiveObject } from "@liveblocks/client";
import { Layer, LayerType, EntityLayer, RelationLayer } from "~/types";
import Entity from "./Entity";
import Relation from "./Relation";

type Props = {
  id: string;
  onLayerPointerDown: (e: React.PointerEvent, layerId: string) => void;
  onStartLink?: (entityId: string, anchor: "L" | "R" | "T" | "B") => void;
};

const LayerComponent = memo(({ id, onLayerPointerDown, onStartLink }: Props) => {
  const live = useStorage((root) => root.layers.get(id)) as
    | LiveObject<Layer>
    | Layer
    | undefined;

  if (!live) return null;

  const raw: Layer =
    typeof (live as any)?.toImmutable === "function"
      ? (live as LiveObject<Layer>).toImmutable()
      : (live as Layer);

  switch (raw.type) {
    case LayerType.Entity:
      return (
        <Entity
          id={id}
          layer={raw as EntityLayer}
          onPointerDown={onLayerPointerDown}
          onStartLink={onStartLink}
        />
      );

    case LayerType.Relation:
      // 👇 Importante: pasar onLayerPointerDown para poder seleccionar/borrar la relación
      return (
        <Relation
          id={id}
          layer={raw as RelationLayer}
          onPointerDown={onLayerPointerDown}
        />
      );

    default:
      return null;
  }
});

LayerComponent.displayName = "LayerComponent";
export default LayerComponent;
