'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Volume2 } from 'lucide-react';
import { VoiceRecognition, TextToSpeech, isVoiceAPISupported } from '@/lib/voice';
import { Button } from '@/components/ui/button';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onSpeakText?: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInput({
  onTranscript,
  onSpeakText,
  disabled,
}: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<VoiceRecognition | null>(null);
  const synthesisRef = useRef<TextToSpeech | null>(null);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const isSupported = isVoiceAPISupported();
    setSupported(isSupported);

    if (isSupported) {
      try {
        recognitionRef.current = new VoiceRecognition();
        synthesisRef.current = new TextToSpeech();
      } catch (err) {
        console.warn('Voice API initialization failed:', err);
        setSupported(false);
      }
    }
  }, []);

  const startListening = () => {
    if (!recognitionRef.current) return;

    setIsListening(true);
    setError(null);
    setTranscript('');

    recognitionRef.current.start(
      (text) => {
        setTranscript(text);
        onTranscript(text);
        setIsListening(false);
      },
      (error) => {
        setError(`Error: ${error}`);
        setIsListening(false);
      }
    );
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const speakText = (text: string) => {
    if (!synthesisRef.current) return;

    setIsSpeaking(true);
    synthesisRef.current.speak(text, () => {
      setIsSpeaking(false);
    });
  };

  const stopSpeaking = () => {
    if (synthesisRef.current) {
      synthesisRef.current.stop();
      setIsSpeaking(false);
    }
  };

  if (!supported) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Microphone Button */}
      <Button
        onClick={isListening ? stopListening : startListening}
        disabled={disabled || isSpeaking}
        variant="outline"
        size="icon"
        className={`${
          isListening
            ? 'bg-destructive/20 border-destructive text-destructive hover:bg-destructive/30'
            : ''
        }`}
        title={isListening ? 'Stop listening' : 'Start voice input'}
      >
        {isListening ? (
          <Square className="w-4 h-4" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </Button>

      {/* Transcript Display */}
      {transcript && (
        <div className="flex-1 px-3 py-2 rounded bg-card border border-border text-sm text-foreground">
          {transcript}
        </div>
      )}

      {/* Speaker Button */}
      {onSpeakText && (
        <Button
          onClick={() => {
            if (isSpeaking) {
              stopSpeaking();
            }
          }}
          disabled={disabled || isListening}
          variant="outline"
          size="icon"
          className={`${
            isSpeaking
              ? 'bg-accent/20 border-accent text-accent hover:bg-accent/30'
              : ''
          }`}
          title={isSpeaking ? 'Stop speaking' : 'Speak last response'}
        >
          <Volume2 className="w-4 h-4" />
        </Button>
      )}

      {/* Error Display */}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
