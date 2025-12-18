"use client";
import React, { useState, useRef, useCallback } from "react"; // Added useCallback
import styles from "./MediaUploader.module.css";
import TranscriptionResult from "./TranscriptionResult";
import {
  getLanguagePreference,
  saveLanguagePreference,
} from "../utils/languageUtils";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { useSessionStore } from "@/stores/sessionStore";
import FileDropzone from "./FileDropzone";
import FileInfoDisplay from "./FileInfoDisplay";
import ProcessingIndicator from "./ui/ProcessingIndicator";
import Button from "@/components/ui/Button";

const MediaUploader: React.FC = () => {
  const {
    organization,
    currentSession,
    setCurrentSession,
    clearSpeakerMap,
  } = useSessionStore();

  // const { upload, isLoading, isError, error, uploadProgress } =
  //   useMediaUpload();

  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [localError, setLocalError] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    getLanguagePreference()
  );

  const { upload, isLoading, isError, error, uploadProgress } =
    useMediaUpload();

  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const remainingMinutes = organization?.remainingMinutes ?? 99999;

  const processingStatus = useSessionStore((state) => state.processingStatus);

  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      const fileType = selectedFile.type;
      if (!fileType.startsWith("audio/") && !fileType.startsWith("video/")) {
        setLocalError("音声または動画ファイルのみアップロード可能です");
        return;
      }
      setFile(selectedFile);
      setLocalError("");
      getDuration(selectedFile);
      setCurrentSession(null); // Clear previous session
    },
    [setCurrentSession]
  ); // Added dependency

  const getDuration = (file: File) => {
    const url = URL.createObjectURL(file);
    const mediaRef = file.type.startsWith("audio/") ? audioRef : videoRef;

    if (mediaRef.current) {
      mediaRef.current.src = url;
      const timeoutId = setTimeout(() => {
        console.warn("Duration");
        setDuration(null);
        URL.revokeObjectURL(url);
      }, 10000);

      mediaRef.current.onloadedmetadata = () => {
        clearTimeout(timeoutId);
        if (mediaRef.current) {
          const mediaDuration = mediaRef.current.duration;
          if (isFinite(mediaDuration) && mediaDuration > 0) {
            console.log("Duration");
            setDuration(mediaDuration);
            // --- BYPASS: Don't set error based on duration
            // if (Math.ceil(duration / 60) > remainingMinutes) {
            //   setLocalError("File exceeds remaining time.");
            // }
            // --- END BYPASS ---
          } else {
            console.warn("Invalid");
            setLocalError(
              "音声ファイルの長さを取得できませんでした。ファイル形式を確認してください。"
            );
            setDuration(null);
          }
        }
        URL.revokeObjectURL(url);
      };
      mediaRef.current.onerror = (e) => {
        clearTimeout(timeoutId);
        console.error("Media file loading error:", e, "File:", file.name);
        setLocalError(
          "音声ファイルの読み込みに失敗しました。対応していない形式の可能性があります。"
        );
        setDuration(null);
        URL.revokeObjectURL(url);
      };
      mediaRef.current.load();
    }
  };

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
    saveLanguagePreference(language);
  };

  const handleUploadClick = () => {
    // --- BYPASS: Removed isExceedingRemainingTime from check
    if (!file || !!localError) return;
    // --- END BYPASS ---

    // Call the mutation function from the hook
    upload(
      { file, language: selectedLanguage },
      {
        onSuccess: () => {
          console.log("Upload successful");
        },
        onError: (err) => {
          console.error("Upload error in component:", err);
          setLocalError(`Upload failed: ${err.message}`);
          setFile(null); // Clear file on error
        },
      }
    );
  };

  const handleReset = async () => {
    setFile(null);
    setDuration(null);
    setLocalError("");
    setCurrentSession(null);
    clearSpeakerMap();
  };

  // Check the global processing status
  const isServerProcessing =
    processingStatus &&
    processingStatus !== "Processing Complete" &&
    !processingStatus.startsWith("Error");

  // Check if we should show the results page
  // Show upload/progress overlay during upload or server processing (even if a session id was already created)
  if (isLoading || isServerProcessing) {
    return (
      <ProcessingIndicator
        isLoading={isLoading}
        isServerProcessing={!!isServerProcessing}
        uploadProgress={uploadProgress}
      />
    );
  }

  // Once upload is done and a session exists, hand off to the main flow (Speaker Edit / generation)
  if (currentSession && !isLoading) {
    return (
      <TranscriptionResult
        session={currentSession}
        fileName={file?.name || "transcription"}
        onReset={handleReset}
      />
    );
  }

  // Default state: Show the dropzone
  return (
    <div className={styles.container}>
      <h2 className={styles.title}>メディアファイルのアップロード</h2>

      <audio ref={audioRef} style={{ display: "none" }} />
      <video ref={videoRef} style={{ display: "none" }} />

      <FileDropzone
        onFileSelect={handleFileSelect}
        selectedLanguage={selectedLanguage}
        onLanguageChange={handleLanguageChange}
        remainingMinutes={remainingMinutes} // Will show 99999
      />

      {file && (
        <>
          <FileInfoDisplay
            file={file}
            duration={duration}
            remainingMinutes={remainingMinutes} // Will show 99999
          />
          <div className={styles.actionButtons}>
            <Button
              onClick={handleUploadClick}
              // --- BYPASS: Button is disabled only if there's a localError or upload is in progress
              disabled={!!localError || isLoading}
            >
              文字起こし開始
            </Button>
            <Button
              onClick={handleReset}
              variant="secondary"
              disabled={isLoading}
            >
              キャンセル
            </Button>
          </div>
        </>
      )}

      {(localError || (isError && error)) && (
        <p className={styles.error}>{localError || error?.message}</p>
      )}
    </div>
  );
};

export default MediaUploader;
