import { useMemo, useCallback, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ProcessingSession, SpeakerMap, SpeechSegment, Word } from '@/types';
import { useSessionStore } from '@/stores/sessionStore';
import {
  convertWordsToSpeechSegments,
  convertSpeechSegmentsToText,
  convertSpeechSegmentsToJSON,
} from '@/utils/speechSegmentUtils';
import { ProcessingStatusAzure, TranscriptFormatAzure } from '@/types/types-azure';
import { uploadToAzure } from '@/lib/storage-azure';
import { updateSessionAzure } from '@/lib/api-azure';

const SPEAKER_COLORS = [
  '#2563eb',
  '#dc2626',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#c2185b',
  '#4f46e5',
  '#0891b2',
];

interface UseSpeakerEditingProps {
  session: ProcessingSession;
  initialTranscript: string;
  words?: Word[];
  onSaveSuccess?: (updatedTranscript: string) => void;
}

interface SaveTranscriptParams {
  updatedTranscript: string;
}

export const useSpeakerEditing = ({
  session,
  initialTranscript,
  words,
  onSaveSuccess,
}: UseSpeakerEditingProps) => {
  const queryClient = useQueryClient();

  const [speechSegments, setSpeechSegments] = useState<SpeechSegment[]>([]);

  const initialSegments = useMemo(() => {
    if (words && words.length > 0) {
      return convertWordsToSpeechSegments(words);
    }
    return [];
  }, [words]);

  useEffect(() => {
    setSpeechSegments(initialSegments);
  }, [initialSegments]);

  const speakerIds = useMemo(() => {
    const ids = new Set<string>();

    if (speechSegments.length > 0) {
      speechSegments.forEach((segment) => ids.add(segment.speakerId));
    } else {
      const speakerPattern = /\*\*\[(speaker_\d+|[^\]]+)\]\*\*/g;
      let match;
      while ((match = speakerPattern.exec(initialTranscript)) !== null) {
        ids.add(match[1]);
      }
    }

    // Ensure at least three editable slots so the UI always renders name inputs.
    let fillerIndex = 0;
    while (ids.size < 3 && fillerIndex < 3) {
      ids.add(`speaker_${fillerIndex}`);
      fillerIndex += 1;
    }

    return Array.from(ids).sort();
  }, [speechSegments, initialTranscript]);

  const speakerMap = useSessionStore((state) => state.speakerMap);
  const setSpeakerMap = useSessionStore((state) => state.setSpeakerMap);
  const updateSpeakerName = useSessionStore((state) => state.updateSpeakerName);
  const updateCurrentSession = useSessionStore((state) => state.updateCurrentSession);

  useEffect(() => {
    if (speakerIds.length === 0) return;

    const currentSpeakerIds = new Set(Object.keys(speakerMap));
    const newSpeakerIds = speakerIds.filter((id) => !currentSpeakerIds.has(id));

    if (Object.keys(speakerMap).length === 0) {
      const initialMap: SpeakerMap = {};
      speakerIds.forEach((id) => {
        initialMap[id] = id.startsWith('speaker_') ? '' : id;
      });
      const same =
        Object.keys(initialMap).length === Object.keys(speakerMap).length &&
        Object.keys(initialMap).every((k) => speakerMap[k] === initialMap[k]);
      if (!same) {
        setSpeakerMap(initialMap);
      }
    } else if (newSpeakerIds.length > 0) {
      const updatedMap = { ...speakerMap };
      newSpeakerIds.forEach((id) => {
        updatedMap[id] = id.startsWith('speaker_') ? '' : id;
      });
      setSpeakerMap(updatedMap);
    }
  }, [speakerIds, speakerMap, setSpeakerMap]);

  const speakerColors = useMemo<Record<string, string>>(() => {
    const colors: Record<string, string> = {};
    const usedNameColors: Record<string, string> = {};
    let colorIndex = 0;

    speakerIds.forEach((id) => {
      const speakerName = speakerMap[id];

      if (speakerName && speakerName.trim() !== '') {
        if (usedNameColors[speakerName]) {
          colors[id] = usedNameColors[speakerName];
        } else {
          const color = SPEAKER_COLORS[colorIndex % SPEAKER_COLORS.length];
          colors[id] = color;
          usedNameColors[speakerName] = color;
          colorIndex++;
        }
      } else {
        colors[id] = SPEAKER_COLORS[colorIndex % SPEAKER_COLORS.length];
        colorIndex++;
      }
    });

    return colors;
  }, [speakerIds, speakerMap]);

  const handleNameChange = useCallback(
    (speakerId: string, newName: string) => {
      updateSpeakerName(speakerId, newName);
    },
    [updateSpeakerName],
  );

  const uniqueSpeakerNames = useMemo(() => {
    const names = new Set<string>();
    Object.values(speakerMap).forEach((name) => {
      if (name && name.trim() !== '') {
        names.add(name);
      }
    });
    speechSegments.forEach((segment) => {
      if (segment.isIndividuallyEdited && segment.speakerName && segment.speakerName.trim() !== '') {
        names.add(segment.speakerName);
      }
    });
    return Array.from(names).sort();
  }, [speakerMap, speechSegments]);

  const updateSegmentSpeaker = useCallback((segmentId: string, newSpeakerName: string) => {
    setSpeechSegments((prevSegments) =>
      prevSegments.map((segment) =>
        segment.id === segmentId
          ? { ...segment, speakerName: newSpeakerName, isIndividuallyEdited: true }
          : segment,
      ),
    );
  }, []);

  const updateSegmentSpeakerId = useCallback(
    (segmentId: string, newSpeakerId: string) => {
      setSpeechSegments((prevSegments) =>
        prevSegments.map((segment) =>
          segment.id === segmentId
            ? {
                ...segment,
                speakerId: newSpeakerId,
                isIndividuallyEdited: false,
                speakerName: speakerMap[newSpeakerId] || newSpeakerId,
              }
            : segment,
        ),
      );
    },
    [speakerMap],
  );

  const getUpdatedTranscript = useCallback((): string => {
    if (speechSegments.length > 0) {
      const updatedSegments = speechSegments.map((segment) => ({
        ...segment,
        speakerName: segment.isIndividuallyEdited
          ? segment.speakerName
          : speakerMap[segment.speakerId] || segment.speakerId,
      }));
      return convertSpeechSegmentsToText(updatedSegments);
    }

    let updatedTranscript = initialTranscript;
    for (const [id, name] of Object.entries(speakerMap)) {
      if (name && name !== id) {
        const searchRegex = new RegExp(`\\*\\*\\[${id}\\]\\*\\*`, 'g');
        updatedTranscript = updatedTranscript.replace(searchRegex, `**[${name}]**`);
      }
    }
    return updatedTranscript;
  }, [speechSegments, speakerMap, initialTranscript]);

  const saveMutation = useMutation({
    mutationFn: async ({ updatedTranscript }: SaveTranscriptParams) => {
      if (!session.transcriptKey) {
        throw new Error('Transcript key is not available.');
      }

      const blobName = session.transcriptKey;
      let dataToSave: string;
      let contentType: string;

      if (speechSegments.length > 0) {
        const updatedSegments = speechSegments.map((segment) => ({
          ...segment,
          speakerName: segment.isIndividuallyEdited
            ? segment.speakerName
            : speakerMap[segment.speakerId] || segment.speakerId,
        }));
        dataToSave = convertSpeechSegmentsToJSON(updatedSegments);
        contentType = 'application/json';
      } else {
        dataToSave = updatedTranscript;
        contentType = 'text/plain';
      }

      await uploadToAzure({
        sessionId: session.sessionId,
        purpose: 'transcript',
        blobName,
        data: dataToSave,
        contentType,
      });

      const updatedSession = await updateSessionAzure(session.sessionId || session.id, {
        status: ProcessingStatusAzure.SPEAKER_EDIT_COMPLETED,
        transcriptFormat: TranscriptFormatAzure.JSON,
        processingTypes: session.processingTypes ?? [],
        speakerMap,
      });

      if (updatedSession) {
        updateCurrentSession(updatedSession as unknown as ProcessingSession);
      }

      return updatedTranscript;
    },
    onSuccess: (updatedTranscript) => {
      queryClient.invalidateQueries({ queryKey: ['transcriptionResult', session.id] });
      onSaveSuccess?.(updatedTranscript);
    },
    onError: (err) => {
      console.error('Failed to save speaker names:', err);
    },
  });

  return {
    speakerIds,
    speakerMap,
    speakerColors,
    handleNameChange,
    getUpdatedTranscript,
    save: saveMutation.mutate,
    isSaving: saveMutation.isPending,
    speechSegments,
    updateSegmentSpeaker,
    updateSegmentSpeakerId,
    uniqueSpeakerNames,
  };
};
