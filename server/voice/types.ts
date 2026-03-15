export type TranscriptEntry = {
  speaker: "user" | "assistant" | "system";
  text: string;
  at: string;
};

export type CallStatus =
  | "not_started"
  | "calling_user"
  | "in_progress"
  | "completed_after_call"
  | "call_failed"
  | "user_cancelled";

export type VoiceSession = {
  runId: string;
  run: any;
  userPhoneNumber: string;
  callSid?: string;
  streamSid?: string;
  callStatus: CallStatus;
  transcript: TranscriptEntry[];
  postCallOutcome?: any;
};
