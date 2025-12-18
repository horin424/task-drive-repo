"use client";
import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import styles from "./SpeakerNameEditor.module.css";
import { useSpeakerEditing } from "@/hooks/useSpeakerEditing";
import { ProcessingSession, Word, SpeechSegment, ProcessingStatus } from "@/types";
import Button from "@/components/ui/Button";
import { parseTranscript } from "@/utils/transcriptParser";
import { useSessionStore } from "@/stores/sessionStore";
import { getAudioUrlAzure as getAudioUrl } from "@/lib/api-azure";

const buildSegmentsFromTranscript = (transcript: string): SpeechSegment[] => {
  const parsedLines = parseTranscript(transcript);
  const speakerLines = parsedLines.filter((line) => line.type === "speaker" && !!line.speakerId);
  if (speakerLines.length === 0) return [];

  let cursor = 0;

  return speakerLines.map((line) => {
    const duration = Math.max(2, Math.min(8, Math.ceil(line.content.length / 20)));
    const startTime = cursor;
    const endTime = cursor + duration;
    cursor = endTime;

    const speakerId = line.speakerId || "speaker_0";

    return {
      id: `line-${line.lineNumber}`,
      speakerId,
      speakerName: speakerId,
      startTime,
      endTime,
      text: line.content,
      words: [],
    };
  });
};

interface SpeakerNameEditorProps {
  session: ProcessingSession;
  transcript: string;
  words?: Word[];
  onSaveSuccess: (updatedTranscript: string) => void;
}

const SpeakerNameEditor: React.FC<SpeakerNameEditorProps> = ({
  session,
  transcript,
  words,
  onSaveSuccess,
}) => {
  const isLocked = session.status === ProcessingStatus.SPEAKER_EDIT_COMPLETED;
  const {
    speakerIds,
    speakerColors,
    handleNameChange,
    getUpdatedTranscript,
    save,
    isSaving,
    speechSegments,
    updateSegmentSpeakerId,
  } = useSpeakerEditing({
    session,
    initialTranscript: transcript,
    words,
    onSaveSuccess,
  });

  const speakerMap = useSessionStore((state) => state.speakerMap);

  const previewRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const completeButtonRef = useRef<HTMLButtonElement>(null);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [currentPlayingSegment, setCurrentPlayingSegment] = useState<string | null>(null);

  const visibleSpeakerIds = useMemo(() => {
    const ids = speakerIds.filter((id) => id.startsWith("speaker_"));
    return ids
      .map((id) => {
        const suffix = id.split("_")[1] ?? "0";
        const numeric = Number.parseInt(suffix, 10);
        return { id, numeric: Number.isFinite(numeric) ? numeric : 0 };
      })
      .sort((a, b) => a.numeric - b.numeric)
      .map((entry) => entry.id)
      .slice(0, 3);
  }, [speakerIds]);

  const displayNameForSpeakerId = useCallback(
    (speakerId: string) => {
      const name = speakerMap[speakerId];
      return name && name.trim() ? name.trim() : speakerId;
    },
    [speakerMap],
  );

  useEffect(() => {
    const fetchAudioUrl = async () => {
      const sessionId = session?.sessionId || session?.id;
      if (!sessionId) {
        setAudioUrl(null);
        return;
      }
      try {
        setIsLoadingAudio(true);
        const url = await getAudioUrl(sessionId);
        setAudioUrl(url || null);
      } catch {
        setAudioUrl(null);
      } finally {
        setIsLoadingAudio(false);
      }
    };
    fetchAudioUrl();
  }, [session.id, session.sessionId]);

  const currentTimeUpdateHandler = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      const handler = currentTimeUpdateHandler.current;
      if (audio && handler) {
        audio.removeEventListener("timeupdate", handler);
      }
      currentTimeUpdateHandler.current = null;
    };
  }, []);

  const stopAudio = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    if (currentTimeUpdateHandler.current) {
      audioRef.current.removeEventListener("timeupdate", currentTimeUpdateHandler.current);
      currentTimeUpdateHandler.current = null;
    }
    setCurrentPlayingSegment(null);
  };

  const playAudioSegment = async (segmentId: string, startTime: number, endTime: number) => {
    if (!audioRef.current) return;
    if (!audioUrl) return;

    try {
      // Stop any previously playing segment (and remove old listeners)
      stopAudio();

      const audio = audioRef.current;
      if (audio.src !== audioUrl) {
        audio.src = audioUrl;
      }
      if (audio.readyState < 1) {
        audio.load();
      }

      // Ensure metadata is available before seeking
      if (audio.readyState < 1) {
        await new Promise<void>((resolve, reject) => {
          const onLoaded = () => {
            audio.removeEventListener("loadedmetadata", onLoaded);
            audio.removeEventListener("error", onError);
            resolve();
          };
          const onError = () => {
            audio.removeEventListener("loadedmetadata", onLoaded);
            audio.removeEventListener("error", onError);
            reject(new Error("Failed to load audio"));
          };

          audio.addEventListener("loadedmetadata", onLoaded);
          audio.addEventListener("error", onError);
        });
      }

      const safeStart = Math.max(0, startTime);
      const safeEnd = Math.max(safeStart, endTime);

      audio.currentTime = safeStart;
      setCurrentPlayingSegment(segmentId);
      await audio.play();

      const handleTimeUpdate = () => {
        const currentTime = audio.currentTime;
        if (currentTime >= safeEnd) {
          audio.pause();
          setCurrentPlayingSegment(null);
          if (currentTimeUpdateHandler.current === handleTimeUpdate) {
            audio.removeEventListener("timeupdate", handleTimeUpdate);
            currentTimeUpdateHandler.current = null;
          }
        }
      };

      currentTimeUpdateHandler.current = handleTimeUpdate;
      audio.addEventListener("timeupdate", handleTimeUpdate);
    } catch {
      setCurrentPlayingSegment(null);
    }
  };

  const [fallbackSegments, setFallbackSegments] = useState<SpeechSegment[]>(() =>
    buildSegmentsFromTranscript(transcript),
  );

  useEffect(() => {
    setFallbackSegments(buildSegmentsFromTranscript(transcript));
  }, [transcript]);

  const displaySegments = speechSegments.length > 0 ? speechSegments : fallbackSegments;

  const handleSegmentSpeakerIdChange = useCallback(
    (segmentId: string, newSpeakerId: string) => {
      if (speechSegments.length > 0) {
        updateSegmentSpeakerId(segmentId, newSpeakerId);
        return;
      }

      setFallbackSegments((prevSegments) =>
        prevSegments.map((segment) =>
          segment.id === segmentId
            ? { ...segment, speakerId: newSpeakerId, speakerName: newSpeakerId }
            : segment,
        ),
      );
    },
    [speechSegments.length, updateSegmentSpeakerId],
  );

  const scrollToSpeaker = (speakerId: string) => {
    if (!previewRef.current) return;
    const firstSegment = displaySegments.find((segment) => segment.speakerId === speakerId);
    if (firstSegment) {
      const element = previewRef.current.querySelector(`[data-segment-id='${firstSegment.id}']`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleComplete = () => {
    if (isLocked) return;
    const updatedTranscript = getUpdatedTranscript();
    save({ updatedTranscript });
  };

  const handleSpeakerInputKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    if (e.key === "Tab" && !e.shiftKey && currentIndex === visibleSpeakerIds.length - 1) {
      e.preventDefault();
      completeButtonRef.current?.focus();
    }
  };

  return (
    <div className={styles.editorContainer}>
      <div className={styles.header}>
        <h3 className={styles.title}>話者名の編集</h3>
        <p className={styles.description}>文字起こし結果に含まれる話者名を編集できます。</p>
        <p className={styles.warning}>
          {isLocked
            ? "このセッションは編集済みのため、音声再生と話者編集はできません。"
            : "編集を完了すると、音声の再生や話者名の再編集はできなくなります。"}
        </p>
      </div>

      <div className={styles.mainContent}>
        <div className={styles.leftPanel}>
          <div className={styles.speakerList}>
            {visibleSpeakerIds.map((speakerId, index) => (
              <div key={speakerId} className={styles.speakerItem}>
                <label
                  htmlFor={speakerId}
                  className={styles.speakerLabel}
                  style={{ borderLeftColor: speakerColors[speakerId] }}
                >
                  {`話\n者\n${index}:`}
                </label>
                <input
                  id={speakerId}
                  type="text"
                  value={speakerMap[speakerId] || ""}
                  onChange={(e) => handleNameChange(speakerId, e.target.value)}
                  onFocus={() => scrollToSpeaker(speakerId)}
                  onKeyDown={(e) => handleSpeakerInputKeyDown(e, index)}
                  className={styles.speakerInput}
                  disabled={isLocked}
                  placeholder="話者名を入力"
                />
              </div>
            ))}
          </div>
        </div>

        <div className={styles.rightPanel} ref={previewRef}>
          <h4 className={styles.previewTitle}>プレビュー</h4>

          {/* hidden audio element; per-line buttons control playback */}
          <audio
            ref={audioRef}
            src={audioUrl || undefined}
            preload="metadata"
            style={{ display: "none" }}
          />

          <div className={styles.transcriptPreview}>
            {displaySegments.map((segment: SpeechSegment) => {
              const speakerId = segment.speakerId;
              const color = speakerColors[speakerId] || "#6b7280";
              const isPlaying = currentPlayingSegment === segment.id;
              const canPlay = !isLocked && !isLoadingAudio && !!audioUrl;
              const label = displayNameForSpeakerId(speakerId);

              return (
                <div
                  key={segment.id}
                  className={`${styles.transcriptLine} ${styles.speakerChange} ${
                    isPlaying ? styles.playing : ""
                  }`}
                  data-segment-id={segment.id}
                >
                  <div className={styles.segmentHeader}>
                    <div className={styles.speakerInfo}>
                      <strong style={{ color }}>[{label}]</strong>
                      <select
                        className={styles.speakerSelect}
                        disabled={isLocked}
                        value={speakerId}
                        onChange={(e) => handleSegmentSpeakerIdChange(segment.id, e.target.value)}
                      >
                        {visibleSpeakerIds.map((id) => (
                          <option key={id} value={id}>
                            {id}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      className={styles.playButton}
                      onClick={() =>
                        isPlaying
                          ? stopAudio()
                          : playAudioSegment(segment.id, segment.startTime, segment.endTime)
                      }
                      disabled={!canPlay}
                    >
                      <span className={styles.playIcon}>{isPlaying ? "■" : "▶"}</span>
                      <span>{isPlaying ? "停止" : "再生"}</span>
                    </button>
                  </div>

                  <div className={styles.segmentContent}>{segment.text}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <Button ref={completeButtonRef} onClick={handleComplete} disabled={isSaving || isLocked}>
          {isSaving ? "保存中..." : "編集を完了"}
        </Button>
      </div>
    </div>
  );
};

export default SpeakerNameEditor;
