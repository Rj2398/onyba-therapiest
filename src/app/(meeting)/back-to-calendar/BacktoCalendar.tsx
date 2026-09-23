"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { requestApi } from '@/src/utils/api';
import { Base_image_url } from '@/src/config';

const parseDocList = (docData: any) => {
  if (!docData) return [];

  const processItem = (item: any, idx: number) => {
    if (!item) return null;
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (!trimmed) return null;
      const parts = trimmed.split('/');
      const fileName = parts[parts.length - 1] || trimmed;
      const fullUrl =
        trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')
          ? trimmed
          : `${Base_image_url.replace(/\/+$/, '')}/${trimmed.replace(/^\/+/, '')}`;
      return {
        id: idx,
        name: fileName,
        date: 'Uploaded Document',
        url: fullUrl,
      };
    }
    if (typeof item === 'object') {
      const rawUrl = item.file_url || item.url || item.path || item.file_name || item.document || '';
      const fullUrl = rawUrl
        ? rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('data:')
          ? rawUrl
          : `${Base_image_url.replace(/\/+$/, '')}/${rawUrl.replace(/^\/+/, '')}`
        : '#';
      const fileName = item.file_name || item.name || (rawUrl ? rawUrl.split('/').pop() : `Document_${idx + 1}`);

      return {
        id: item.id || idx,
        name: fileName,
        date: item.created_at || item.date || 'Uploaded Document',
        url: fullUrl,
      };
    }
    return null;
  };

  if (typeof docData === 'string') {
    const paths = docData.split(',').map((s) => s.trim()).filter(Boolean);
    return paths.map((path, idx) => processItem(path, idx)).filter(Boolean);
  }

  if (Array.isArray(docData)) {
    return docData.map((item, idx) => processItem(item, idx)).filter(Boolean);
  }

  if (typeof docData === 'object') {
    const item = processItem(docData, 0);
    return item ? [item] : [];
  }

  return [];
};

const BacktoCalendarContent = () => {
  const searchParams = useSearchParams();
  const rawSessionId =
    searchParams.get("session_id") ||
    searchParams.get("therapy_session_id") ||
    searchParams.get("id") ||
    (typeof window !== "undefined" ? localStorage.getItem("session_id") || localStorage.getItem("current_session_id") : null) ||
    "19";

  const [recordingTime, setRecordingTime] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcriptText, setTranscriptText] = useState<string>("");
  const transcriptTextRef = useRef<string>("");
  const [isSavingRecording, setIsSavingRecording] = useState<boolean>(false);

  // Notes State
  const [noteText, setNoteText] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  // Documents State
  const [activeDocTab, setActiveDocTab] = useState<'therapist' | 'patient'>('therapist');
  const [therapistDocs, setTherapistDocs] = useState<any[]>([]);
  const [patientDocs, setPatientDocs] = useState<any[]>([]);
  const [isFetchingDocs, setIsFetchingDocs] = useState<boolean>(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSessionDocuments = useCallback(async () => {
    if (!rawSessionId) return;
    setIsFetchingDocs(true);
    try {
      const response = await requestApi({
        endpoint: `get-session-documents/${rawSessionId}`,
        method: "POST",
      });

      const docData = response?.data?.documents || response?.data || response;
      if (docData) {
        const therapistList = parseDocList(
          docData.therapist_document || docData.shared_by_therapist || docData.therapist_documents
        );
        const patientList = parseDocList(
          docData.patient_document || docData.shared_by_patient || docData.patient_documents
        );
        setTherapistDocs(therapistList);
        setPatientDocs(patientList);
      }
    } catch (err) {
      console.error("Error fetching session documents:", err);
    } finally {
      setIsFetchingDocs(false);
    }
  }, [rawSessionId]);

  useEffect(() => {
    fetchSessionDocuments();
  }, [fetchSessionDocuments]);

  const uploadRecordingData = async (blob: Blob, transcript: string) => {
    setIsSavingRecording(true);
    try {
      const audioFile = new File([blob], `session_recording_${rawSessionId}_${Date.now()}.webm`, {
        type: blob.type || 'audio/webm',
      });

      const formData = new FormData();
      formData.append("therapy_session_id", String(rawSessionId));
      formData.append("session_recording_url", audioFile);
      formData.append("session_recording_text", transcript.trim() || "Auto-generated session transcript.");

      const response = await requestApi({
        endpoint: "store-session-recording",
        method: "POST",
        data: formData,
        isFormData: true,
      });

      if (response && (response.success || response.code === 200 || response.status)) {
        toast.success("Session recording and transcript saved automatically!");
      } else {
        toast.error(response?.message || "Failed to store session recording.");
      }
    } catch (err: any) {
      console.error("Error storing session recording:", err);
      toast.error(err?.response?.data?.message || err?.message || "Error storing session recording");
    } finally {
      setIsSavingRecording(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setAudioUrl(null);
      setAudioBlob(null);
      setTranscriptText("");
      transcriptTextRef.current = "";

      // Initialize Web Speech API for live auto-transcript generation
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event: any) => {
            let accumulated = '';
            for (let i = 0; i < event.results.length; ++i) {
              accumulated += event.results[i][0].transcript + ' ';
            }
            const cleanTranscript = accumulated.trim();
            setTranscriptText(cleanTranscript);
            transcriptTextRef.current = cleanTranscript;
          };

          recognition.onend = () => {
            // Restart speech recognition automatically if still recording
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
              try {
                recognition.start();
              } catch (e) {}
            }
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch (e) {
          console.error("Web Speech Recognition error:", e);
        }
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        setIsRecording(true);
        timerIntervalRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);
      };

      mediaRecorder.onstop = () => {
        setIsRecording(false);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (e) {}
        }
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Auto-download for testing
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `session-recording-${new Date().getTime()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Automatically store session recording with auto-generated transcript from audio
        const durationFormatted = formatTime(recordingTime);
        const currentTranscript =
          transcriptTextRef.current ||
          transcriptText ||
          `Session audio recording transcript (${durationFormatted}). Conversation auto-recorded.`;

        setTranscriptText(currentTranscript);
        uploadRecordingData(blob, currentTranscript);
      };

      mediaRecorder.start(1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      toast.error("Microphone permission is required to record audio.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (mediaRecorderRef.current?.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  const saveSessionRecording = async () => {
    if (!audioBlob) {
      toast.error("No audio recording available to save.");
      return;
    }
    setIsSavingRecording(true);
    try {
      const audioFile = new File([audioBlob], `session_recording_${rawSessionId}_${Date.now()}.webm`, {
        type: audioBlob.type || 'audio/webm',
      });

      const formData = new FormData();
      formData.append("therapy_session_id", String(rawSessionId));
      formData.append("session_recording_url", audioFile);
      formData.append("session_recording_text", transcriptText.trim() || noteText.trim() || "Session audio recording transcript.");

      const response = await requestApi({
        endpoint: "store-session-recording",
        method: "POST",
        data: formData,
        isFormData: true,
      });

      if (response && (response.success || response.code === 200 || response.status)) {
        toast.success("Session recording stored successfully!");
      } else {
        toast.error(response?.message || "Failed to store session recording.");
      }
    } catch (err: any) {
      console.error("Error storing session recording:", err);
      toast.error(err?.response?.data?.message || err?.message || "Error storing session recording");
    } finally {
      setIsSavingRecording(false);
    }
  };

  const clearNotes = () => {
    setNoteText("");
    if (editorRef.current) {
      editorRef.current.innerHTML = "";
    }
  };

  const saveNotes = async () => {
    if (!noteText.trim()) {
      toast.error("Please enter some notes before saving.");
      return;
    }
    setIsSavingNotes(true);
    try {
      const formData = new FormData();
      formData.append("session_id", String(rawSessionId));
      formData.append("type", "private");
      formData.append("notes", noteText);

      const response = await requestApi({
        endpoint: "submit-notes",
        method: "POST",
        data: formData,
        isFormData: true,
      });

      if (response && (response.success || response.code === 200 || response.status)) {
        toast.success("Private notes saved successfully!");
      } else {
        toast.error(response?.message || "Failed to save private notes.");
      }
    } catch (err: any) {
      console.error("Error saving private notes:", err);
      toast.error(err?.response?.data?.message || err?.message || "Error saving private notes");
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setIsUploadingDoc(true);
      try {
        const formData = new FormData();
        formData.append("session_id", String(rawSessionId));
        formData.append("type", "therapist");
        formData.append("document", file);

        const response = await requestApi({
          endpoint: "upload-session-documents",
          method: "POST",
          data: formData,
          isFormData: true,
        });

        if (response && (response.success || response.code === 200 || response.status)) {
          toast.success("Document uploaded successfully!");
          fetchSessionDocuments();
        } else {
          toast.error(response?.message || "Failed to upload document.");
        }
      } catch (err: any) {
        console.error("Error uploading document:", err);
        toast.error(err?.response?.data?.message || err?.message || "Error uploading document");
      } finally {
        setIsUploadingDoc(false);
        if (e.target) e.target.value = "";
      }
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentDocs = activeDocTab === 'therapist' ? therapistDocs : patientDocs;

  return (
    <main className="gl-content-body">
      <div className="ps-dash-layout-wrapper">
        <div className="ps-dash-grid-container">

          <div className="ps-dash-card">
            <div className="ps-dash-card-header">
              <h3 className="ps-dash-header-title">
                <svg className="ps-dash-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v4M8 23h8" /></svg>
                Session Recording <span className="ps-dash-title-muted">(Voice Only)</span>
              </h3>
              <span className="ps-dash-timer-text">{formatTime(recordingTime)}</span>
            </div>

            <div className="ps-dash-recording-inner">
              <div className="ps-dash-audio-waveform-row">
                <svg className="ps-dash-wave-svg" viewBox="0 0 100 40" fill="currentColor">
                  <rect x="5" y="15" width="3" height="10" rx="1.5" />
                  <rect x="13" y="10" width="3" height="20" rx="1.5" />
                  <rect x="21" y="5" width="3" height="30" rx="1.5" />
                  <rect x="29" y="12" width="3" height="16" rx="1.5" />
                  <rect x="37" y="8" width="3" height="24" rx="1.5" />
                  <rect x="45" y="14" width="3" height="12" rx="1.5" />
                  <rect x="53" y="7" width="3" height="26" rx="1.5" />
                  <rect x="61" y="11" width="3" height="18" rx="1.5" />
                  <rect x="69" y="3" width="3" height="34" rx="1.5" />
                  <rect x="77" y="15" width="3" height="10" rx="1.5" />
                  <rect x="85" y="8" width="3" height="24" rx="1.5" />
                  <rect x="93" y="13" width="3" height="14" rx="1.5" />
                </svg>

                <div
                  className="ps-dash-mic-circle"
                  onClick={toggleRecording}
                  style={{ cursor: 'pointer', borderColor: isRecording ? '#ef4444' : undefined, color: isRecording ? '#ef4444' : undefined }}
                  title={isRecording ? "Stop Recording" : "Start Recording"}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v4M8 23h8" /></svg>
                  {isRecording && <span className="ps-dash-mic-status-dot" style={{ background: '#ef4444' }}></span>}
                </div>

                <svg className="ps-dash-wave-svg" viewBox="0 0 100 40" fill="currentColor">
                  <rect x="5" y="12" width="3" height="16" rx="1.5" />
                  <rect x="13" y="6" width="3" height="28" rx="1.5" />
                  <rect x="21" y="14" width="3" height="12" rx="1.5" />
                  <rect x="29" y="4" width="3" height="32" rx="1.5" />
                  <rect x="37" y="10" width="3" height="20" rx="1.5" />
                  <rect x="45" y="16" width="3" height="8" rx="1.5" />
                  <rect x="53" y="8" width="3" height="24" rx="1.5" />
                  <rect x="61" y="13" width="3" height="14" rx="1.5" />
                  <rect x="69" y="5" width="3" height="30" rx="1.5" />
                  <rect x="77" y="11" width="3" height="18" rx="1.5" />
                  <rect x="85" y="15" width="3" height="10" rx="1.5" />
                  <rect x="93" y="7" width="3" height="26" rx="1.5" />
                </svg>
              </div>

              <div className="ps-dash-live-indicator" style={{ opacity: isRecording ? 1 : 0.5 }}>
                {isRecording && <span className="ps-dash-pulse-dot"></span>} {isRecording ? "Recording..." : "Ready to record"}
              </div>

              {isRecording && (
                <div style={{ marginTop: '14px', padding: '10px 14px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', textAlign: 'left', width: '90%', margin: '14px auto 0' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#166534', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="ps-dash-pulse-dot" style={{ background: '#22c55e' }}></span> Live Speech-to-Text Transcribing...
                  </p>
                  <p style={{ fontSize: '13px', color: '#15803d', fontStyle: transcriptText ? 'normal' : 'italic', margin: 0, maxHeight: '60px', overflowY: 'auto' }}>
                    {transcriptText || "Start speaking into the microphone to auto-generate transcript..."}
                  </p>
                </div>
              )}

              {audioUrl && !isRecording && (
                <div style={{ marginTop: '16px', width: '100%', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                    <audio controls src={audioUrl} style={{ height: '36px', width: '90%', borderRadius: '18px' }} />
                  </div>
                  <div style={{ padding: '0 8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                      Auto-Generated Session Transcript:
                    </label>
                    <textarea
                      className="ps-dash-textarea-box"
                      style={{ minHeight: '70px', fontSize: '13px', padding: '10px', width: '100%' }}
                      placeholder="Auto-generated transcript from audio..."
                      value={transcriptText}
                      onChange={(e) => setTranscriptText(e.target.value)}
                    />
                    <button
                      className="ps-dash-btn-save"
                      style={{ marginTop: '10px', width: '100%', display: 'block' }}
                      onClick={saveSessionRecording}
                      disabled={isSavingRecording}
                    >
                      {isSavingRecording ? "Saving Recording..." : "Re-Save Recording"}
                    </button>
                  </div>
                </div>
              )}

              <h4 className="ps-dash-status-heading" style={{ marginTop: audioUrl ? '16px' : '0px' }}>
                {isRecording ? "Your session is in progress" : "Click the mic to start"}
              </h4>
              <p className="ps-dash-status-desc">The conversation is being recorded securely<br />to help generate your AI journey.</p>
            </div>
          </div>

          <div className="ps-dash-right-col">

            <div className="ps-dash-card">
              <div className="ps-dash-card-header">
                <h3 className="ps-dash-header-title">
                  <svg className="ps-dash-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3Z" /><path d="M12 14c-4.418 0-8 2.239-8 5v2h16v-2c0-2.761-3.582-5-8-5Z" /></svg>
                  Private Notes <span className="ps-dash-title-muted">(Only you)</span>
                </h3>
                <button className="ps-dash-btn-clear" onClick={clearNotes}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                  Clear
                </button>
              </div>

              <div className="ps-dash-editor-wrapper">
                <div
                  ref={editorRef}
                  className="ps-dash-textarea-box"
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  onInput={(e) => setNoteText(e.currentTarget.innerHTML)}
                  data-placeholder="Write your private observation during the session..."
                  style={{
                    minHeight: '130px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    outline: 'none',
                    padding: '12px',
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '14px',
                    color: '#1f2937',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                />

                <div className="ps-dash-toolbar">
                  <div className="ps-dash-toolbar-left">
                    <span className="ps-dash-tool-item" style={{ cursor: 'pointer', position: 'relative' }}>
                      14 ▾
                      <select
                        style={{ position: 'absolute', opacity: 0, top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer', appearance: 'none' }}
                        onChange={(e) => execCommand('fontSize', e.target.value)}
                        defaultValue="3"
                      >
                        <option value="1">10</option>
                        <option value="2">12</option>
                        <option value="3">14</option>
                        <option value="4">18</option>
                        <option value="5">24</option>
                        <option value="6">32</option>
                        <option value="7">48</option>
                      </select>
                    </span>
                    <span className="ps-dash-tool-item" style={{ cursor: 'pointer', position: 'relative' }}>
                      ⚫ ▾
                      <input
                        type="color"
                        style={{ position: 'absolute', opacity: 0, top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                        onChange={(e) => execCommand('foreColor', e.target.value)}
                      />
                    </span>
                    <strong className="ps-dash-tool-item" style={{ cursor: 'pointer' }} onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }}>B</strong>
                    <em className="ps-dash-tool-item" style={{ cursor: 'pointer' }} onMouseDown={(e) => { e.preventDefault(); execCommand('italic'); }}>I</em>
                    <span className="ps-dash-tool-item" style={{ textDecoration: " underline", cursor: 'pointer' }} onMouseDown={(e) => { e.preventDefault(); execCommand('underline'); }}>U</span>
                    <span className="ps-dash-tool-item" style={{ textDecoration: "line-through", cursor: 'pointer' }} onMouseDown={(e) => { e.preventDefault(); execCommand('strikeThrough'); }}>S</span>
                    <svg className="ps-dash-tool-icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ cursor: 'pointer' }} onMouseDown={(e) => { e.preventDefault(); execCommand('justifyLeft'); }}><path d="M4 6h16M4 12h10M4 18h16" /></svg>
                    <svg className="ps-dash-tool-icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ cursor: 'pointer' }} onMouseDown={(e) => { e.preventDefault(); execCommand('justifyCenter'); }}><path d="M4 6h16M4 12h16M4 18h16" /></svg>
                  </div>
                  <svg className="ps-dash-tool-icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ cursor: 'pointer' }} onMouseDown={(e) => { e.preventDefault(); execCommand('insertUnorderedList'); }}><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
                </div>

                <button className="ps-dash-btn-save" onClick={saveNotes} disabled={isSavingNotes}>
                  {isSavingNotes ? "Saving Notes..." : "Save Notes"}
                </button>
              </div>
            </div>

            <div className="ps-dash-card">
              <div className="ps-dash-card-header">
                <h3 className="ps-dash-header-title">
                  <svg className="ps-dash-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                  Documents & Attachments
                </h3>
              </div>

              <div className="ps-dash-tabs-row">
                <div
                  className={`ps-dash-tab ${activeDocTab === 'therapist' ? 'ps-dash-active-tab' : ''}`}
                  onClick={() => setActiveDocTab('therapist')}
                  style={{ cursor: 'pointer' }}
                >
                  Shared by you <span className="ps-dash-tab-count">{therapistDocs.length}</span>
                </div>
                <div
                  className={`ps-dash-tab ${activeDocTab === 'patient' ? 'ps-dash-active-tab' : ''}`}
                  onClick={() => setActiveDocTab('patient')}
                  style={{ cursor: 'pointer' }}
                >
                  Shared by Patient <span className="ps-dash-tab-count">{patientDocs.length}</span>
                </div>
              </div>

              {isFetchingDocs ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
                  Loading documents...
                </div>
              ) : currentDocs.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                  No documents shared yet.
                </div>
              ) : (
                currentDocs.map((file, index) => (
                  <div className="ps-dash-file-row" key={file.id || index}>
                    <div className="ps-dash-file-info">
                      <svg className="ps-dash-pdf-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                      <div>
                        <p className="ps-dash-file-name">{file.name}</p>
                        <p className="ps-dash-file-date">{file.date}</p>
                      </div>
                    </div>
                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="ps-dash-link-view">
                      View
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                    </a>
                  </div>
                ))
              )}

              {activeDocTab === 'therapist' && (
                <div
                  className="ps-dash-upload-dashed-box"
                  onClick={triggerFileInput}
                  style={{ cursor: isUploadingDoc ? 'not-allowed' : 'pointer', opacity: isUploadingDoc ? 0.6 : 1 }}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    disabled={isUploadingDoc}
                  />
                  <svg className="ps-dash-upload-icon-box" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
                  <p className="ps-dash-upload-text">{isUploadingDoc ? "Uploading Document..." : "Upload Document"}</p>
                  <p className="ps-dash-upload-sub">Allowed: PDF, DOC, DOCX, JPG, PNG (Max: 10MB)</p>
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    </main>
  );
};

const BacktoCalendar = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BacktoCalendarContent />
    </Suspense>
  );
};

export default BacktoCalendar;
