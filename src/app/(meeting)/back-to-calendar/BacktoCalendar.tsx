"use client";

import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

const BacktoCalendar = () => {
  const [recordingTime, setRecordingTime] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Notes State
  const [noteText, setNoteText] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  // Upload State
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string, date: string }[]>([
    { name: "Anxiety_Worksheet.pdf", date: "May 24, 2026" }
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setAudioUrl(null);

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
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        // Auto-download for testing
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `session-recording-${new Date().getTime()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
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

  const clearNotes = () => {
    setNoteText("");
    if (editorRef.current) {
      editorRef.current.innerHTML = "";
    }
  };

  const saveNotes = () => {
    if (noteText.trim()) {
      toast.success("Notes saved successfully!");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const newFile = {
        name: file.name,
        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      };
      setUploadedFiles(prev => [...prev, newFile]);
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

  return (
    <>
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
                {audioUrl && !isRecording && (
                  <div style={{ marginTop: '12px', marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
                    <audio controls src={audioUrl} style={{ height: '36px', width: '90%', borderRadius: '18px' }} />
                  </div>
                )}
                <h4 className="ps-dash-status-heading">{isRecording ? "Your session is in progress" : "Click the mic to start"}</h4>
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
                  {/* <div
                    ref={editorRef}
                    className="ps-dash-textarea-box"
                    contentEditable={true}
                    placeholder="Write your private observation during the session..."
                    onInput={(e) => setNoteText(e.currentTarget.innerHTML)}
                    style={{ minHeight: '120px', overflowY: 'auto', outline: 'none' }}
                  ></div> */}

                  <textarea
                    className="ps-dash-textarea-box"
                    placeholder="Write your private observation during the session..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
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

                  <button className="ps-dash-btn-save" onClick={saveNotes}>Save Notes</button>
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
                  <div className="ps-dash-tab ps-dash-active-tab">
                    Shared by you <span className="ps-dash-tab-count">{uploadedFiles.length}</span>
                  </div>
                  <div className="ps-dash-tab">
                    Shared by Patient <span className="ps-dash-tab-count">0</span>
                  </div>
                </div>

                {uploadedFiles.map((file, index) => (
                  <div className="ps-dash-file-row" key={index}>
                    <div className="ps-dash-file-info">
                      <svg className="ps-dash-pdf-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                      <div>
                        <p className="ps-dash-file-name">{file.name}</p>
                        <p className="ps-dash-file-date">Uploaded on {file.date}</p>
                      </div>
                    </div>
                    <a href="#" className="ps-dash-link-view">
                      View
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                    </a>
                  </div>
                ))}

                <div className="ps-dash-upload-dashed-box" onClick={triggerFileInput} style={{ cursor: 'pointer' }}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                    accept=".pdf,.doc,.docx,.jpg,.png"
                  />
                  <svg className="ps-dash-upload-icon-box" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
                  <p className="ps-dash-upload-text">Upload Document</p>
                  <p className="ps-dash-upload-sub">Allowed: PDF, DOC, DOCX, JPG, PNG (Max: 10MB)</p>
                </div>
              </div>

            </div>

          </div>
        </div>
      </main>
    </>
  )
}

export default BacktoCalendar
