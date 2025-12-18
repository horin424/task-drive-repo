"use client";
import React, { useState, useEffect, useMemo } from "react";
import styles from "./TranscriptionResult.module.css";
import { parseTranscript, TranscriptLine } from "@/utils/transcriptParser";
import { useTranscriptionResult } from "@/hooks/useTranscriptionResult";
import { ProcessingSession, ProcessingStatus, TranscriptFormat } from "@/types";
import Spinner from "@/components/ui/Spinner";
import SpeakerNameEditor from "./SpeakerNameEditor";
import { useContentGeneration } from "@/hooks/useContentGeneration";
import { useFileDownload } from "@/hooks/useFileDownload";
import Button from "@/components/ui/Button";
import { toast } from "react-hot-toast";
import { uploadToAzure } from "@/lib/storage-azure";
import GenerationOptions from "./GenerationOptions";
import { useGenerationOptions } from "@/hooks/useGenerationOptions";
import { generateSpeakerColorMap, getSpeakerColor } from "@/utils/speakerColors";
import { useSessionStore } from "@/stores/sessionStore";

interface TranscriptionResultProps {
  session: ProcessingSession;
  fileName?: string;
  onReset?: () => void | Promise<void>;
}

const ResultSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>{title}</h3>
        <button
          className={styles.viewButton}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? "閉じる" : "開く"}
        </button>
      </div>
      {isOpen && children}
    </div>
  );
};

const TranscriptionResult: React.FC<TranscriptionResultProps> = ({
  session,
  fileName = "transcription",
  onReset,
}) => {
  const {
    transcript: initialTranscript,
    bulletPoints,
    minutes,
    customJsonData,
    isLoading,
    isError,
    error,
  } = useTranscriptionResult(session);

  const [transcript, setTranscript] = useState(initialTranscript || "");
  const { options: generationOptions } = useGenerationOptions();
  const { organization, speakerMap } = useSessionStore();

  useEffect(() => {
    const next = initialTranscript || "";
    if (next !== transcript) {
      setTranscript(next);
    }
  }, [initialTranscript, transcript]);

  const { generate, isGenerating } = useContentGeneration(session);
  const { download, isDownloading, isDownloadCompleted } =
    useFileDownload(session);

  const [isEditingNames, setIsEditingNames] = useState(
    session.status === ProcessingStatus.PENDING_SPEAKER_EDIT
  );
  const [taskFile, setTaskFile] = useState<File | null>(null);
  const [informationFile, setInformationFile] = useState<File | null>(null);
  const [isGeneratingRequested, setIsGeneratingRequested] = useState(false);

  useEffect(() => {
    if (
      session.status === ProcessingStatus.PROCESSING_BULLETS ||
      session.status === ProcessingStatus.PROCESSING_MINUTES ||
      session.status === ProcessingStatus.PROCESSING_TASKS
    ) {
      setIsGeneratingRequested(false);
    }
  }, [session.status]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      (globalThis as { __SESSION_DEBUG__?: unknown }).__SESSION_DEBUG__ = {
        session,
        transcriptKey: session.transcriptKey,
        status: session.status,
      };
    }
  }, [session, session.status, session.transcriptKey]);

  const hasSpeakers = useMemo(() => {
    const transcriptHasTags = /\[speaker_\d+\]:/.test(transcript);
    const wordsHaveSpeakers =
      Array.isArray(customJsonData?.words) &&
      customJsonData.words.some(
        (w) => typeof w.speaker_id === "string" && w.speaker_id.length > 0
      );
    return transcriptHasTags || wordsHaveSpeakers;
  }, [transcript, customJsonData?.words]);

  const canEditSpeakers =
    session.transcriptFormat === TranscriptFormat.JSON ||
    !!session.transcriptKey;

  const speakerColorMap = useMemo(() => {
    const parsedLines = parseTranscript(transcript);
    const speakerIds = parsedLines
      .filter((line) => line.type === "speaker" && line.speakerId)
      .map((line) => line.speakerId!)
      .filter((id, index, arr) => arr.indexOf(id) === index);
    return generateSpeakerColorMap(speakerIds);
  }, [transcript]);

  const titleText = useMemo(() => {
    switch (session.status) {
      case ProcessingStatus.SPEAKER_EDIT_COMPLETED:
        return "話者名編集完了";
      case ProcessingStatus.ALL_COMPLETED:
        return "結果";
      default:
        return "進行状況";
    }
  }, [session.status]);

  const speakerCards = useMemo(
    () =>
      parseTranscript(transcript).filter(
        (line: TranscriptLine) => line.type === "speaker"
      ),
    [transcript]
  );

  const handleSaveSuccess = (updatedTranscript: string) => {
    setTranscript(updatedTranscript);
    setIsEditingNames(false);
  };

  useEffect(() => {
    if (
      session.status === ProcessingStatus.PENDING_SPEAKER_EDIT &&
      !isEditingNames
    ) {
      setIsEditingNames(true);
    }
    if (
      session.status === ProcessingStatus.SPEAKER_EDIT_COMPLETED &&
      isEditingNames
    ) {
      setIsEditingNames(false);
    }
  }, [session.status, isEditingNames]);

  const handleGenerateClick = async () => {
    if (isGenerating || isGeneratingRequested) {
      return;
    }

    let taskFileKey: string | undefined;
    let informationFileKey: string | undefined;

    const processingTypes: ("bullets" | "minutes" | "tasks")[] = [];
    if (generationOptions.bullets) processingTypes.push("bullets");
    if (generationOptions.minutes) processingTypes.push("minutes");

    const isTaskGenerationDisabled =
      (organization?.remainingTaskGenerations ?? 0) <= 0;
    if (generationOptions.tasks && !isTaskGenerationDisabled)
      processingTypes.push("tasks");

    try {
      if (taskFile) {
        const uploadedTask = await uploadToAzure({
          sessionId: session.sessionId,
          purpose: "tasks",
          fileName: taskFile.name,
          data: taskFile,
        });
        taskFileKey = uploadedTask.blobName;
      }
      if (informationFile) {
        const uploadedInfo = await uploadToAzure({
          sessionId: session.sessionId,
          purpose: "information",
          fileName: informationFile.name,
          data: informationFile,
        });
        informationFileKey = uploadedInfo.blobName;
      }
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "ファイルのアップロードに失敗しました。";
      toast.error(message);
      return;
    }

    try {
      setIsGeneratingRequested(true);
      await generate({
        transcript,
        processingTypes,
        taskFileKey,
        informationFileKey,
      });
      setIsGeneratingRequested(false);
    } catch (genError) {
      const message =
        genError instanceof Error
          ? genError.message
          : "生成処理でエラーが発生しました。";
      toast.error(message);
      setIsGeneratingRequested(false);
    }
  };

  const shouldShowSpeakerEditor =
    session.status === ProcessingStatus.PENDING_SPEAKER_EDIT ||
    (isEditingNames && canEditSpeakers && hasSpeakers);

  if (session.status === "PROCESSING_TRANSCRIPTION") {
    return (
      <div className={styles.loadingContainer}>
        <Spinner />
        <p>文字起こしを実行中...</p>
      </div>
    );
  }

  if (session.status === ProcessingStatus.PENDING_SPEAKER_EDIT && isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <Spinner />
        <p>スピーカー編集の準備中です...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <Spinner />
        <p>読み込み中です...</p>
      </div>
    );
  }

  if (session.status === ProcessingStatus.TRANSCRIPTION_FAILED) {
    return (
      <div className={styles.errorContainer}>
        <h3>文字起こしに失敗しました</h3>
        {session.errorMessage && (
          <p className={styles.errorMessage}>{session.errorMessage}</p>
        )}
        <button onClick={onReset} className={styles.resetButton}>
          やり直す
        </button>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.errorContainer}>
        <h3>エラーが発生しました</h3>
        <p className={styles.errorMessage}>{error?.message}</p>
        <button onClick={onReset} className={styles.resetButton}>
          やり直す
        </button>
      </div>
    );
  }

  if (shouldShowSpeakerEditor) {
    return (
      <SpeakerNameEditor
        session={session}
        transcript={transcript}
        words={customJsonData?.words}
        onSaveSuccess={handleSaveSuccess}
      />
    );
  }

  const isResultsReady = session.status === ProcessingStatus.ALL_COMPLETED;
  const isGenerationInProgress =
    session.status?.startsWith("PROCESSING_") || isGenerating;

  return (
    <div className={styles.container}>
      <div className={styles.resultHeader}>
        <h2 className={styles.resultTitle}>{titleText}</h2>
      </div>

      {isGenerationInProgress ? (
        <div className={styles.generationProgressContainer}>
          <div className={styles.generationProgress}>
            <Spinner />
            <div className={styles.generationMessage}>
              <p className={styles.generationText}>コンテンツを生成中です...</p>
              <p className={styles.generationSubText}>しばらくそのままでお待ちください。</p>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.actionArea}>
          <div className={styles.mainActions}>
            {session.status === ProcessingStatus.SPEAKER_EDIT_COMPLETED && (
              <div className={styles.generationControlsContainer}>
                <GenerationOptions />
                {generationOptions.tasks && (
                  <div className={styles.taskUploadArea}>
                    <h4 className={styles.taskUploadTitle}>タスク生成用のファイルをアップロード</h4>
                    <div className={styles.taskFileInputContainer}>
                      <input
                        type="file"
                        onChange={(e) => setTaskFile(e.target.files?.[0] ?? null)}
                      />
                      <input
                        type="file"
                        onChange={(e) => setInformationFile(e.target.files?.[0] ?? null)}
                      />
                    </div>
                  </div>
                )}
                <Button
                  onClick={handleGenerateClick}
                  disabled={
                    isGenerationInProgress ||
                    isGeneratingRequested ||
                    (!generationOptions.minutes &&
                      !generationOptions.bullets &&
                      !generationOptions.tasks)
                  }
                >
                  指定コンテンツを生成
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {session.status === ProcessingStatus.SPEAKER_EDIT_COMPLETED && (
          <div className={styles.content}>
            <ResultSection title="文字起こし結果">
              <div className={styles.transcriptCards}>
                {speakerCards.map((line: TranscriptLine) => {
                  const displayName =
                    (line.speakerId && speakerMap[line.speakerId]) ||
                    line.speakerTag?.replace(/\[|\]/g, "") ||
                    line.speakerId ||
                    "Speaker";
                const color = getSpeakerColor(line.speakerId || "speaker_0");
                  return (
                    <div
                      key={line.lineNumber}
                      className={styles.transcriptCard}
                      style={{ borderColor: color }}
                    >
                      <div
                        className={styles.transcriptCardHeader}
                        style={{ backgroundColor: color }}
                      >
                        <strong>[{displayName}]</strong>
                      </div>
                      <div className={styles.transcriptCardBody}>{line.content}</div>
                    </div>
                  );
                })}
              </div>
            </ResultSection>
          </div>
        )}

      {isResultsReady && (
        <>
          <div className={styles.content}>
            <ResultSection title="文字起こし結果">
              <div className={styles.transcriptCards}>
                {speakerCards.map((line: TranscriptLine) => {
                  const displayName =
                    (line.speakerId && speakerMap[line.speakerId]) ||
                    line.speakerTag?.replace(/\[|\]/g, "") ||
                    line.speakerId ||
                    "Speaker";
                  const color =
                    line.speakerId && speakerColorMap[line.speakerId]
                      ? speakerColorMap[line.speakerId]
                      : "#6b7280";
                  return (
                    <div
                      key={line.lineNumber}
                      className={styles.transcriptCard}
                      style={{ borderColor: color }}
                    >
                      <div
                        className={styles.transcriptCardHeader}
                        style={{ backgroundColor: color }}
                      >
                        <strong>[{displayName}]</strong>
                      </div>
                      <div className={styles.transcriptCardBody}>{line.content}</div>
                    </div>
                  );
                })}
              </div>
            </ResultSection>

            <ResultSection title="議事録">
              <pre className={styles.transcript}>{minutes}</pre>
            </ResultSection>

            <ResultSection title="箇条書き">
              <pre className={styles.transcript}>
                {Array.isArray(bulletPoints)
                  ? bulletPoints.join("\n")
                  : bulletPoints}
              </pre>
            </ResultSection>
          </div>

          <div className={styles.footer}>
            <Button
              onClick={() =>
                download({
                  transcript,
                  minutes,
                  bulletPoints: Array.isArray(bulletPoints)
                    ? bulletPoints
                    : bulletPoints
                    ? String(bulletPoints).split("\n").filter(Boolean)
                    : [],
                  fileName,
                })
              }
              disabled={isDownloading}
            >
              {isDownloading
                ? "ダウンロード中..."
                : isDownloadCompleted
                ? "ダウンロード完了"
                : "ダウンロード"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default TranscriptionResult;

