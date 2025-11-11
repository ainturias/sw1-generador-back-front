// src/components/ai/useAudioToErd.ts
"use client";

import { useState, useRef, useCallback } from "react";
import { useMutation, useStorage } from "@liveblocks/react";
import { LiveObject } from "@liveblocks/client";
import { nanoid } from "nanoid";
import type { EntityLayer, RelationLayer, RelationType } from "~/types";
import { LayerType } from "~/types";

type DiagramResponse = {
  entities: Array<{
    name: string;
    attributes: Array<{
      name: string;
      type: string;
      pk?: boolean;
      required?: boolean;
    }>;
  }>;
  relations: Array<{
    sourceEntity: string;
    targetEntity: string;
    relationType: string;
    sourceCard: "ONE" | "MANY";
    targetCard: "ONE" | "MANY";
  }>;
};

export function useAudioToErd() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const layerIds = useStorage((root) => root.layerIds);

  // Iniciar grabación
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      audioChunksRef.current = [];
      setAudioBlob(null);
      setAudioDuration(0);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        setAudioBlob(audioBlob);

        // Detener todas las pistas del stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        // Limpiar intervalo de duración
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      startTimeRef.current = Date.now();

      // Actualizar duración cada 100ms
      durationIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setAudioDuration(elapsed);
      }, 100);
    } catch (err: any) {
      console.error("Error al iniciar grabación:", err);
      setError(
        err.name === "NotAllowedError"
          ? "Permiso de micrófono denegado. Por favor, permite el acceso al micrófono."
          : "Error al acceder al micrófono. Verifica tus permisos."
      );
    }
  }, []);

  // Detener grabación
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  // Limpiar audio grabado
  const clearAudio = useCallback(() => {
    setAudioBlob(null);
    setAudioDuration(0);
    audioChunksRef.current = [];
    setError(null);
  }, []);

  // Mutación para crear entidades y relaciones
  const createDiagram = useMutation(
    ({ storage }, diagram: DiagramResponse) => {
      const layerIds = storage.get("layerIds");
      const layers = storage.get("layers");

      // Mapa de nombres de entidades a IDs
      const entityNameToId = new Map<string, string>();

      // Crear entidades
      let yOffset = 100;
      diagram.entities.forEach((entity, index) => {
        const entityId = nanoid();
        entityNameToId.set(entity.name, entityId);

        const newEntity: EntityLayer = {
          type: LayerType.Entity,
          x: 200 + (index % 3) * 400,
          y: yOffset + Math.floor(index / 3) * 350,
          height: 200,
          width: 280,
          name: entity.name,
          attributes: entity.attributes.map((attr) => ({
            id: nanoid(),
            name: attr.name,
            type: (attr.type || "string") as any,
            pk: attr.pk || false,
            required: attr.required || false,
          })),
        };

        layers.set(entityId, new LiveObject(newEntity));
        layerIds.push(entityId);
      });

      // Crear relaciones
      diagram.relations.forEach((relation) => {
        const sourceId = entityNameToId.get(relation.sourceEntity);
        const targetId = entityNameToId.get(relation.targetEntity);

        if (sourceId && targetId) {
          const relationId = nanoid();

          // Mapear tipo de relación
          let relationType: RelationType = "association";
          const typeMap: Record<string, RelationType> = {
            association: "association",
            composition: "composition",
            aggregation: "aggregation",
            generalization: "generalization",
            realization: "realization",
            dependency: "dependency",
          };
          relationType = typeMap[relation.relationType.toLowerCase()] || "association";

          const newRelation: RelationLayer = {
            type: LayerType.Relation,
            sourceId,
            targetId,
            relationType,
            sourceCard: relation.sourceCard,
            targetCard: relation.targetCard,
            owningSide: "target",
          };

          layers.set(relationId, new LiveObject(newRelation));
          layerIds.push(relationId);
        }
      });
    },
    []
  );

  // Procesar audio con Gemini
  const processAudio = useCallback(
    async (audio: Blob | File) => {
      setIsProcessing(true);
      setError(null);

      try {
        const formData = new FormData();
        
        // Convertir audio a formato compatible si es necesario
        let audioFile: File;
        if (audio instanceof File) {
          audioFile = audio;
        } else {
          // Convertir Blob a File
          audioFile = new File([audio], "recording.webm", { type: "audio/webm" });
        }

        formData.append("audio", audioFile);

        const response = await fetch("/api/ai/audio-to-erd", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || data.details || "Error al procesar el audio");
        }

        // Crear diagrama en el canvas
        createDiagram(data.diagram);

        return {
          success: true,
          message: data.message,
          entitiesCount: data.diagram.entities.length,
          relationsCount: data.diagram.relations.length,
        };
      } catch (err: any) {
        console.error("Error procesando audio:", err);
        setError(err.message || "Error al procesar el audio");
        throw err;
      } finally {
        setIsProcessing(false);
      }
    },
    [createDiagram]
  );

  return {
    // Estado
    isRecording,
    isProcessing,
    error,
    audioBlob,
    audioDuration,

    // Métodos de grabación
    startRecording,
    stopRecording,
    clearAudio,

    // Procesamiento
    processAudio,
  };
}

