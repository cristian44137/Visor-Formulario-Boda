import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Send, Play, Square, Loader2, Bot, User, PhoneCall, PhoneOff } from 'lucide-react';
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
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const liveSessionRef = useRef<any>(null);
  const liveAudioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Load voices
  useEffect(() => {
    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  // Initial Summary
  useEffect(() => {
    if (guests.length === 0) return;
    
    const generateInitialSummary = async () => {
      setIsGenerating(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `Actúa como un asistente para los novios (Silvina y Luis).
Aquí tienes los datos actuales de la lista de invitados en formato JSON:
${JSON.stringify(guests, null, 2)}

Haz un resumen MUY breve, directo y conciso (máximo 2 párrafos cortos o una lista de viñetas) destacando:
1. Cuántos han confirmado, cuántos no, y cuántos faltan.
2. Si hay alergias importantes a tener en cuenta.
3. Algún dato curioso.
Usa Markdown para formatear el texto (negritas, listas). Sé muy directo, sin introducciones largas.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-preview',
          contents: prompt,
        });
        
        const summaryText = response.text || '';
        const msgId = Date.now().toString();
        
        const newMsg: Message = {
          id: msgId,
          role: 'model',
          text: summaryText
        };
        
        setMessages([newMsg]);
        setIsGenerating(false);
        
      } catch (error) {
        console.error("Error generating summary:", error);
        setIsGenerating(false);
      }
    };
    
    generateInitialSummary();
  }, [guests]);

  const togglePlay = async (messageId: string, text: string) => {
    if (playingId === messageId) {
      if (liveAudioContextRef.current) {
        liveAudioContextRef.current.close();
        liveAudioContextRef.current = null;
      }
      setPlayingId(null);
      return;
    }

    setPlayingId(messageId);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Zephyr' },
              },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        if (liveAudioContextRef.current) {
           liveAudioContextRef.current.close();
        }
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        liveAudioContextRef.current = audioCtx;
        
        const binary = atob(base64Audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const pcmData = new Int16Array(bytes.buffer);
        const audioBuffer = audioCtx.createBuffer(1, pcmData.length, 24000);
        const channelData = audioBuffer.getChannelData(0);
        for (let i = 0; i < pcmData.length; i++) {
          channelData[i] = pcmData[i] / 32768.0;
        }
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.onended = () => setPlayingId(null);
        source.start();
      } else {
        setPlayingId(null);
      }
    } catch (error) {
      console.error("TTS error:", error);
      setPlayingId(null);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isGenerating || isCalling) return;
    
    const userText = inputValue.trim();
    setInputValue('');
    
    const userId = Date.now().toString();
    setMessages(prev => [...prev, { id: userId, role: 'user', text: userText }]);
    setIsGenerating(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const history = messages.map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.text}`).join('\n\n');
      const prompt = `Contexto de invitados: ${guests.length} en total.
Historial:
${history}

Usuario: ${userText}
Asistente (Sé MUY breve, directo y conciso. Usa Markdown para formatear tu respuesta):`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-preview',
        contents: prompt,
      });
      
      const modelText = response.text || '';
      const modelId = (Date.now() + 1).toString();
      
      setMessages(prev => [...prev, { id: modelId, role: 'model', text: modelText }]);
      setIsGenerating(false);
      
    } catch (error) {
      console.error("Error sending message:", error);
      setIsGenerating(false);
    }
  };

  const toggleCall = async () => {
    if (isCalling) {
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
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      if (!liveAudioContextRef.current) {
        liveAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const audioCtx = liveAudioContextRef.current;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const historyText = messages.map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.text}`).join('\n\n');
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-3.1-flash-live-preview',
        callbacks: {
          onopen: () => {
            sessionPromise.then((session) => {
              session.sendClientContent({
                turns: [{ role: 'user', parts: [{ text: 'Hola, acabo de conectarme. Salúdame brevemente y dime que estás escuchando.' }] }],
                turnComplete: true
              });
            });

            const source = audioCtx.createMediaStreamSource(stream);
            const processor = audioCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            source.connect(processor);
            processor.connect(audioCtx.destination);

            processor.onaudioprocess = (e) => {
              if (!isCalling || !liveSessionRef.current) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
              }
              
              const bytes = new Uint8Array(pcm16.buffer);
              let binary = '';
              for (let i = 0; i < bytes.length; i += 1024) {
                binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 1024)));
              }
              const base64 = btoa(binary);
              
              sessionPromise.then((session) => {
                session.sendRealtimeInput({
                  audio: { data: base64, mimeType: 'audio/pcm;rate=24000' }
                });
              });
            };
          },
          onmessage: async (message: any) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              const binary = atob(base64Audio);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
              }
              const pcmData = new Int16Array(bytes.buffer);
              const audioBuffer = audioCtx.createBuffer(1, pcmData.length, 24000);
              const channelData = audioBuffer.getChannelData(0);
              for (let i = 0; i < pcmData.length; i++) {
                channelData[i] = pcmData[i] / 32768.0;
              }
              const source = audioCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioCtx.destination);
              source.start();
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } }
          },
          systemInstruction: `Eres el asistente de la boda de Silvina y Luis. Habla en español de España.
Datos de invitados: ${JSON.stringify(guests)}
Historial previo de la conversación:
${historyText}
Continúa la conversación de forma natural por voz.`
        }
      });

      setIsCalling(true);
      liveSessionRef.current = await sessionPromise;

    } catch (error) {
      console.error("Error starting live call:", error);
      alert("No se pudo iniciar la llamada. Comprueba los permisos del micrófono.");
      setIsCalling(false);
    }
  };

  return (
    <Card className="flex flex-col h-[600px] border-primary/20 shadow-sm">
      <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
        <CardTitle className="font-serif text-xl flex items-center gap-2 text-primary">
          <Bot className="w-5 h-5" />
          Asistente de la Boda
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-0 relative">
        <div ref={scrollRef} className="absolute inset-0 overflow-y-auto p-4 space-y-4">
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
                
                {msg.role === 'model' && (
                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 rounded-full bg-white/50 hover:bg-white"
                      onClick={() => togglePlay(msg.id, msg.text)}
                    >
                      {playingId === msg.id ? (
                        <Square className="w-3.5 h-3.5 mr-1.5 fill-current" />
                      ) : (
                        <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
                      )}
                      <span className="text-xs font-medium">
                        {playingId === msg.id ? 'Detener' : 'Escuchar'}
                      </span>
                    </Button>
                  </div>
                )}
              </div>
              
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}
          
          {isGenerating && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Escribiendo...</span>
              </div>
            </div>
          )}
          
          {isCalling && (
            <div className="flex justify-center items-center py-8">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 bg-primary/20 rounded-full animate-ping absolute inset-0"></div>
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center relative z-10 shadow-lg">
                    <PhoneCall className="w-8 h-8 text-primary-foreground" />
                  </div>
                </div>
                <span className="text-sm font-medium text-primary animate-pulse">Llamada en curso... Habla ahora</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="p-3 border-t border-border/50 bg-muted/20">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex w-full items-center gap-2"
        >
          <Button
            type="button"
            variant={isCalling ? "destructive" : "secondary"}
            size="icon"
            className={`shrink-0 rounded-full ${isCalling ? 'animate-pulse' : ''}`}
            onClick={toggleCall}
          >
            {isCalling ? <PhoneOff className="w-4 h-4" /> : <PhoneCall className="w-4 h-4" />}
          </Button>
          
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={isCalling ? "Llamada en curso..." : "Pregunta sobre los invitados..."}
            className="flex-1 rounded-full bg-white"
            disabled={isGenerating || isCalling}
          />
          
          <Button 
            type="submit" 
            size="icon" 
            className="shrink-0 rounded-full"
            disabled={!inputValue.trim() || isGenerating || isCalling}
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
