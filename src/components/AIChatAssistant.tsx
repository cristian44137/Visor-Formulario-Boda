import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Bot, User, PhoneCall, PhoneOff, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Guest } from '../types';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

interface AIChatAssistantProps {
  guests: Guest[];
}

export function AIChatAssistant({ guests }: AIChatAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isCalling, setIsCalling] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [callState, setCallState] = useState<'idle' | 'listening' | 'speaking' | 'processing'>('idle');
  
  const [activeInput, setActiveInput] = useState('');
  const [activeOutput, setActiveOutput] = useState('');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const liveSessionRef = useRef<any>(null);
  const liveAudioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  
  const currentInputRef = useRef('');
  const currentOutputRef = useRef('');
  const nextPlayTimeRef = useRef<number>(0);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeInput, activeOutput, isConnecting]);

  const stopCall = () => {
    if (liveSessionRef.current) {
      try {
        liveSessionRef.current.close();
      } catch (e) {
        console.error("Error closing session:", e);
      }
      liveSessionRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (liveAudioContextRef.current) {
      liveAudioContextRef.current.close();
      liveAudioContextRef.current = null;
    }
    setIsCalling(false);
    setIsConnecting(false);
    setCallState('idle');
    nextPlayTimeRef.current = 0;
    
    // Flush any remaining active text
    if (currentInputRef.current) {
      setMessages(prev => [...prev, { id: Date.now().toString() + '-user', role: 'user', text: currentInputRef.current }]);
      currentInputRef.current = '';
      setActiveInput('');
    }
    if (currentOutputRef.current) {
      setMessages(prev => [...prev, { id: Date.now().toString() + '-model', role: 'model', text: currentOutputRef.current }]);
      currentOutputRef.current = '';
      setActiveOutput('');
    }
  };

  const toggleCall = async () => {
    if (isCalling || isConnecting) {
      stopCall();
      return;
    }

    setIsConnecting(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000 } });
      mediaStreamRef.current = stream;
      
      if (!liveAudioContextRef.current) {
        liveAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }
      const audioCtx = liveAudioContextRef.current;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      nextPlayTimeRef.current = audioCtx.currentTime;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-3.1-flash-live-preview',
        callbacks: {
          onopen: () => {
            const source = audioCtx.createMediaStreamSource(stream);
            const processor = audioCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            source.connect(processor);
            
            // Connect to a silent gain node to avoid feedback but keep the processor running
            const silentGain = audioCtx.createGain();
            silentGain.gain.value = 0;
            processor.connect(silentGain);
            silentGain.connect(audioCtx.destination);

            processor.onaudioprocess = (e) => {
              if (!liveSessionRef.current) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
              }
              
              const buffer = new ArrayBuffer(pcm16.length * 2);
              const view = new DataView(buffer);
              for (let i = 0; i < pcm16.length; i++) {
                view.setInt16(i * 2, pcm16[i], true);
              }
              
              let binary = '';
              const bytes = new Uint8Array(buffer);
              for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              const base64 = btoa(binary);
              
              sessionPromise.then((session) => {
                session.sendRealtimeInput({
                  audio: { data: base64, mimeType: 'audio/pcm;rate=16000' }
                });
              });
            };
            
            setIsConnecting(false);
            setIsCalling(true);
            setCallState('listening');
          },
          onmessage: async (message: any) => {
            // Handle audio playback
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts) {
              for (const part of parts) {
                const base64Audio = part?.inlineData?.data;
                if (base64Audio) {
                  setCallState('speaking');
                  const binary = atob(base64Audio);
                  const buffer = new ArrayBuffer(binary.length);
                  const view = new DataView(buffer);
                  for (let i = 0; i < binary.length; i++) {
                    view.setUint8(i, binary.charCodeAt(i));
                  }
                  const pcmData = new Int16Array(Math.floor(binary.length / 2));
                  for (let i = 0; i < pcmData.length; i++) {
                    pcmData[i] = view.getInt16(i * 2, true);
                  }
                  
                  const audioBuffer = audioCtx.createBuffer(1, pcmData.length, 24000);
                  const channelData = audioBuffer.getChannelData(0);
                  for (let i = 0; i < pcmData.length; i++) {
                    channelData[i] = pcmData[i] / 32768.0;
                  }
                  const audioSource = audioCtx.createBufferSource();
                  audioSource.buffer = audioBuffer;
                  audioSource.connect(audioCtx.destination);
                  
                  const startTime = Math.max(nextPlayTimeRef.current, audioCtx.currentTime);
                  audioSource.start(startTime);
                  nextPlayTimeRef.current = startTime + audioBuffer.duration;
                  
                  audioSource.onended = () => {
                    if (audioCtx.currentTime >= nextPlayTimeRef.current - 0.1) {
                      setCallState('listening');
                    }
                  };
                }
              }
            }
            
            // Handle interruption
            if (message.serverContent?.interrupted) {
              nextPlayTimeRef.current = audioCtx.currentTime;
              setCallState('listening');
            }
            
            // Handle turn complete
            if (message.serverContent?.turnComplete) {
              if (callState === 'processing') {
                 setCallState('listening');
              }
            }
            
            // Handle transcriptions
            if (message.serverContent?.inputTranscription) {
              setCallState('processing');
              const t = message.serverContent.inputTranscription;
              if (t.text) currentInputRef.current += t.text;
              setActiveInput(currentInputRef.current);
              if (t.finished) {
                if (currentInputRef.current.trim()) {
                  setMessages(prev => [...prev, { id: Date.now().toString() + '-user', role: 'user', text: currentInputRef.current }]);
                }
                currentInputRef.current = '';
                setActiveInput('');
              }
            }
            if (message.serverContent?.outputTranscription) {
              const t = message.serverContent.outputTranscription;
              if (t.text) currentOutputRef.current += t.text;
              setActiveOutput(currentOutputRef.current);
              if (t.finished) {
                if (currentOutputRef.current.trim()) {
                  setMessages(prev => [...prev, { id: Date.now().toString() + '-model', role: 'model', text: currentOutputRef.current }]);
                }
                currentOutputRef.current = '';
                setActiveOutput('');
              }
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } }
          },
          systemInstruction: {
            parts: [{
              text: `Eres el asistente de la boda de Silvina y Luis. Habla en español de España.
Datos de invitados: ${JSON.stringify(guests)}
IMPORTANTE: Empieza la conversación saludando al usuario inmediatamente y preguntando en qué puedes ayudarle.`
            }]
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        }
      });

      sessionPromise.then((session) => {
        session.sendRealtimeInput({
          text: 'Hola, acabo de conectarme.'
        });
      });

      liveSessionRef.current = await sessionPromise;

    } catch (error) {
      console.error("Error starting live call:", error);
      alert("No se pudo iniciar la llamada. Comprueba los permisos del micrófono.");
      setIsConnecting(false);
      setIsCalling(false);
    }
  };

  return (
    <Card className="flex flex-col h-[600px] border-primary/20 shadow-sm">
      <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
        <CardTitle className="font-serif text-xl flex items-center gap-2 text-primary">
          <Bot className="w-5 h-5" />
          Asistente de la Boda (Voz)
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-0 relative">
        <div ref={scrollRef} className="absolute inset-0 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !activeInput && !activeOutput && !isConnecting && !isCalling && (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-6">
              <Bot className="w-12 h-12 mb-4 opacity-20" />
              <p>Pulsa el botón de abajo para empezar a hablar con el asistente de la boda.</p>
            </div>
          )}
          
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'model' && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user' 
                  ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                  : 'bg-muted/50 text-foreground rounded-tl-sm'
              }`}>
                {msg.role === 'model' ? (
                  <div className="text-sm leading-relaxed">
                    <ReactMarkdown
                      components={{
                        p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2" {...props} />,
                        li: ({node, ...props}) => <li className="mb-1" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                )}
              </div>
              
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}
          
          {/* Active Input Transcription */}
          {activeInput && (
            <div className="flex gap-3 justify-end">
              <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-primary/80 text-primary-foreground rounded-tr-sm">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{activeInput}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                <User className="w-4 h-4 text-primary-foreground" />
              </div>
            </div>
          )}
          
          {/* Active Output Transcription */}
          {activeOutput && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-muted/50 text-foreground rounded-tl-sm">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{activeOutput}</p>
              </div>
            </div>
          )}
          
          {isConnecting && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Conectando llamada...</span>
              </div>
            </div>
          )}
          
          {isCalling && !isConnecting && callState !== 'idle' && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                {callState === 'listening' && (
                  <>
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse delay-75" />
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse delay-150" />
                    </div>
                    <span className="text-sm text-muted-foreground ml-2">Escuchando...</span>
                  </>
                )}
                {callState === 'processing' && (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Procesando...</span>
                  </>
                )}
                {callState === 'speaking' && (
                  <>
                    <div className="flex gap-1 items-center h-4">
                      <div className="w-1 bg-primary animate-[bounce_1s_infinite] h-2" />
                      <div className="w-1 bg-primary animate-[bounce_1s_infinite_0.2s] h-4" />
                      <div className="w-1 bg-primary animate-[bounce_1s_infinite_0.4s] h-3" />
                      <div className="w-1 bg-primary animate-[bounce_1s_infinite_0.6s] h-4" />
                      <div className="w-1 bg-primary animate-[bounce_1s_infinite_0.8s] h-2" />
                    </div>
                    <span className="text-sm text-muted-foreground ml-2">Hablando...</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="p-4 border-t border-border/50 bg-muted/20 flex justify-center">
        <Button 
          size="lg" 
          onClick={toggleCall}
          className={`rounded-full px-8 py-6 shadow-md transition-all w-full max-w-md ${
            isCalling 
              ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' 
              : 'bg-primary hover:bg-primary/90'
          }`}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Conectando...
            </>
          ) : isCalling ? (
            <>
              <PhoneOff className="w-5 h-5 mr-2" />
              Finalizar Llamada
            </>
          ) : (
            <>
              <PhoneCall className="w-5 h-5 mr-2" />
              Iniciar Llamada de Voz
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
