import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Loader2, Volume2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Guest } from '../types';

interface VoiceAssistantProps {
  guests: Guest[];
}

export function VoiceAssistant({ guests }: VoiceAssistantProps) {
  const [isListening, setIsListening] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [response, setResponse] = useState<string>('');
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const startLiveSession = async () => {
    try {
      setIsConnecting(true);
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      
      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: `Habla con voz de Español de España.`,
        },
        callbacks: {
          onopen: async () => {
            setIsConnecting(false);
            setIsListening(true);
            setTranscript('Conectado. Puedes hablar ahora...');
            
            try {
              mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
              sourceRef.current = audioContextRef.current!.createMediaStreamSource(mediaStreamRef.current);
              processorRef.current = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
              
              processorRef.current.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                // Convert Float32Array to Int16Array
                const pcmData = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                  pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
                }
                
                // Convert Int16Array to Base64
                const buffer = new ArrayBuffer(pcmData.length * 2);
                const view = new DataView(buffer);
                for (let i = 0; i < pcmData.length; i++) {
                  view.setInt16(i * 2, pcmData[i], true);
                }
                
                let binary = '';
                const bytes = new Uint8Array(buffer);
                for (let i = 0; i < bytes.byteLength; i++) {
                  binary += String.fromCharCode(bytes[i]);
                }
                const base64Data = btoa(binary);
                
                sessionPromise.then((session: any) => {
                  session.sendRealtimeInput({
                    audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                  });
                });
              };
              
              sourceRef.current.connect(processorRef.current);
              processorRef.current.connect(audioContextRef.current!.destination);
            } catch (err) {
              console.error("Error accessing microphone:", err);
              setTranscript("Error al acceder al micrófono.");
              stopSession();
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              // Decode and play audio
              const binary = atob(base64Audio);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
              }
              try {
                const audioBuffer = await audioContextRef.current!.decodeAudioData(bytes.buffer);
                const source = audioContextRef.current!.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContextRef.current!.destination);
                source.start();
                setResponse("Reproduciendo respuesta...");
              } catch (e) {
                console.error("Error decoding audio", e);
              }
            }
            
            if (message.serverContent?.interrupted) {
              // Handle interruption
            }
          },
          onerror: (err: any) => {
            console.error("Live API Error:", err);
            setTranscript("Error en la conexión.");
            stopSession();
          },
          onclose: () => {
            stopSession();
          }
        }
      });
      
      sessionRef.current = await sessionPromise;
      
    } catch (err) {
      console.error("Failed to start session:", err);
      setIsConnecting(false);
      setTranscript("Error al iniciar el asistente.");
    }
  };

  const stopSession = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (e) {}
      sessionRef.current = null;
    }
    setIsListening(false);
    setIsConnecting(false);
    setTranscript('');
    setResponse('');
  };

  const toggleListening = () => {
    if (isListening || isConnecting) {
      stopSession();
    } else {
      startLiveSession();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSession();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <Card className="border-primary/20 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="font-serif text-xl flex items-center gap-2 text-primary">
          <Volume2 className="w-5 h-5" />
          Asistente de Voz (Gemini Live)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-6">
        <button
          onClick={toggleListening}
          disabled={isConnecting}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-md ${
            isConnecting 
              ? 'bg-muted text-muted-foreground' 
              : isListening 
                ? 'bg-destructive text-destructive-foreground animate-pulse shadow-destructive/30' 
                : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105'
          }`}
        >
          {isConnecting ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : isListening ? (
            <MicOff className="w-8 h-8" />
          ) : (
            <Mic className="w-8 h-8" />
          )}
        </button>
        
        <div className="mt-6 text-center min-h-[40px]">
          {isConnecting && <p className="text-muted-foreground text-sm">Conectando con Gemini...</p>}
          {isListening && !response && <p className="text-primary font-medium">{transcript || 'Escuchando...'}</p>}
          {response && <p className="text-foreground font-medium">{response}</p>}
          {!isListening && !isConnecting && <p className="text-muted-foreground text-sm">Toca para hablar con el asistente</p>}
        </div>
      </CardContent>
    </Card>
  );
}
