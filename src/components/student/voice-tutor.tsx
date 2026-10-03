"use client";

import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useMemo, useState } from "react";
import { Button, ErrorNotice, Spinner } from "@/components/ui";
import { ClientApiError, errorMessage } from "@/lib/client/http";
import { studentApi } from "@/lib/client/student-api";
import { createVoiceTools } from "@/lib/client/voice-tools";

interface VoiceTutorProps {
  lectureId: string;
  onSaveNote: (text: string) => Promise<void>;
  onQuestionSent: () => void;
}

/** Spoken Lecture AI (ElevenLabs Agents). Optional: the text chat keeps working if voice is unavailable. */
export function VoiceTutor(props: VoiceTutorProps) {
  return (
    <ConversationProvider>
      <VoiceTutorPanel {...props} />
    </ConversationProvider>
  );
}

function VoiceTutorPanel({ lectureId, onSaveNote, onQuestionSent }: VoiceTutorProps) {
  const [starting, setStarting] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<{ id: number; role: "user" | "agent"; text: string }[]>([]);
  const [activity, setActivity] = useState<string[]>([]);

  const tools = useMemo(
    () =>
      createVoiceTools({
        getSlideSummary: async () => (await studentApi.voiceSlide(lectureId)).summary,
        markConfused: () => studentApi.confused(lectureId),
        askLecturer: async (question) => {
          await studentApi.ask(lectureId, question);
          onQuestionSent();
        },
        saveNote: onSaveNote,
        onActivity: (entry) => setActivity((a) => [...a, entry].slice(-4)),
      }),
    [lectureId, onSaveNote, onQuestionSent],
  );

  const conversation = useConversation({
    onConnect: () => setStarting(false),
    onMessage: (m) =>
      setTranscript((t) => [...t, { id: m.event_id, role: m.role, text: m.message }].slice(-6)),
    onError: (message) => {
      setStarting(false);
      setError(message || "The voice connection had a problem.");
    },
    onDisconnect: (details) => {
      setStarting(false);
      if (details.reason === "error") setError(details.message || "The voice connection dropped.");
    },
  });
  const active = conversation.status === "connected";
  const connecting = starting || conversation.status === "connecting";

  async function start() {
    setError(null);
    setTranscript([]);
    setActivity([]);
    setStarting(true);
    try {
      // Ask for the microphone up front so a refusal gets a clear message.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      setStarting(false);
      setError("Allow microphone access in your browser to talk to Lecture AI.");
      return;
    }
    try {
      const { signedUrl, dynamicVariables } = await studentApi.voiceSession(lectureId);
      conversation.startSession({ signedUrl, dynamicVariables, clientTools: tools, connectionType: "websocket" });
    } catch (err) {
      setStarting(false);
      if (err instanceof ClientApiError && err.code === "voice_unavailable") setUnavailable(true);
      else setError(errorMessage(err));
    }
  }

  return (
    <section className="border border-violet-200 bg-white p-6" aria-label="Voice tutor">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Talk to Lecture AI</h2>
          <p className="text-xs text-slate-600">
            Ask out loud. It can also mark you as confused, ask the lecturer, or save notes for you.
          </p>
        </div>
        <span className="shrink-0 rounded-none bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-200">
          Private
        </span>
      </div>

      <div className="mt-3" aria-live="polite">
        {unavailable ? (
          <p className="text-sm text-slate-500">The voice tutor isn&apos;t set up on this server yet. Text chat still works.</p>
        ) : active ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2 text-sm font-medium text-violet-700">
              <span className={`size-2.5 rounded-full ${conversation.isSpeaking ? "animate-pulse bg-violet-500" : "bg-emerald-500"}`} aria-hidden />
              {conversation.isSpeaking ? "Lecture AI is speaking…" : "Listening…"}
            </span>
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" onClick={() => conversation.setMuted(!conversation.isMuted)}>
                {conversation.isMuted ? "Unmute" : "Mute"}
              </Button>
              <Button variant="danger" onClick={() => conversation.endSession()}>
                End call
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={start} disabled={connecting} className="w-full bg-violet-600 py-3 hover:bg-violet-700 disabled:bg-violet-300">
            {connecting ? (
              <>
                <Spinner /> Connecting…
              </>
            ) : (
              "Start talking"
            )}
          </Button>
        )}
      </div>

      {error && (
        <div className="mt-3">
          <ErrorNotice message={error} onRetry={active ? undefined : start} />
        </div>
      )}

      {activity.length > 0 && (
        <ul className="mt-3 space-y-1" aria-label="Actions taken by the voice tutor">
          {activity.map((entry, i) => (
            <li key={i} className="text-xs font-medium text-emerald-700">
              ✓ {entry}
            </li>
          ))}
        </ul>
      )}

      {transcript.length > 0 && (
        <ol className="mt-3 max-h-40 space-y-1.5 overflow-y-auto border-t border-slate-100 pt-3" aria-label="Voice transcript">
          {transcript.map((line) => (
            <li key={`${line.role}-${line.id}`} className="text-xs leading-relaxed text-slate-700">
              <span className="font-semibold text-slate-900">{line.role === "agent" ? "Lecture AI: " : "You: "}</span>
              {line.text}
            </li>
          ))}
        </ol>
      )}

      <p className="mt-3 text-[11px] text-slate-400">Voice is processed by ElevenLabs. The lecturer can&apos;t hear or see this conversation.</p>
    </section>
  );
}
