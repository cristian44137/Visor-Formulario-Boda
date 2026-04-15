import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Mic, MicOff, Send, Play, Square, Loader2, Bot, User, PhoneCall, PhoneOff } from 'lucide-react';
import { Guest } from '../types';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  audioBuffer?: AudioBuffer | null;
  isAudioLoading?: boolean;
}

interface AIChatAssistantProps {
  guests: Guest[];
}

export function AIChatAssistant({ guests }: AIChatAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const liveSessionRef = useRef<any>(null);
  const liveAudioContextRef = useRef<AudioContext | null>(null);

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

Haz un resumen breve y amigable (máximo 3-4 párrafos) destacando:
1. Cuántos han confirmado, cuántos no, y cuántos faltan.
2. Si hay alergias importantes a tener en cuenta.
3. Algún dato curioso (como canciones sugeridas).
No uses formato markdown complejo, solo texto claro.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-preview',
          contents: prompt,
        });
        
        const summaryText = response.text || '';
        const msgId = Date.now().toString();
        
        const newMsg: Message = {
          id: msgId,
          role: 'model',
          text: summaryText,
          isAudioLoading: true
        };
        
        setMessages([newMsg]);
        setIsGenerating(false);
        preloadAudio(msgId, summaryText);
        
      } catch (error) {
        console.error("Error generating summary:", error);
        setIsGenerating(false);
      }
    };
    
    generateInitialSummary();
  }, [guests]);

  const preloadAudio = async (messageId: string, text: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const cleanText = text.replace(/[*#_]/g, '');
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro-preview-tts',
        contents: `Lee este texto con voz natural en español de España:\n\n${cleanText}`,
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Zephyr" }
            }
          }
        }
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) return;

      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = await audioContextRef.current.decodeAudioData(bytes.buffer.slice(0));
      } catch (e) {
        const pcmData = new Int16Array(bytes.buffer);
        audioBuffer = audioContextRef.current.createBuffer(1, pcmData.length, 24000);
        const channelData = audioBuffer.getChannelData(0);
        for (let i = 0; i < pcmData.length; i++) {
          channelData[i] = pcmData[i] / 32768.0;
        }
      }

      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, audioBuffer, isAudioLoading: false } : m
      ));
    } catch (error) {
      console.error("Error preloading audio:", error);
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, isAudioLoading: false } : m
      ));
    }
  };

  const togglePlay = (messageId: string, buffer?: AudioBuffer | null) => {
    if (playingId === messageId) {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }
      setPlayingId(null);
      return;
    }

    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
    }

    if (!buffer || !audioContextRef.current) return;

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => {
      setPlayingId(null);
    };
    source.start();
    sourceNodeRef.current = source;
    setPlayingId(messageId);
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
      const prompt = `Contexto de la lista de invitados:
${JSON.stringify(guests, null, 2)}

Historial de conversación:
${history}

Usuario: ${userText}
Asistente:`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: prompt,
      });
      
      const modelText = response.text || '';
      const modelId = (Date.now() + 1).toString();
      
      setMessages(prev => [...prev, { id: modelId, role: 'model', text: modelText, isAudioLoading: true }]);
      setIsGenerating(false);
      preloadAudio(modelId, modelText);
      
    } catch (error) {
      console.error("Error sending message:", error);
      setIsGenerating(false);
    }
  };

  const toggleListening = async () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Tu navegador no soporta reconocimiento de voz.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error("Microphone permission denied:", err);
      alert("Para usar el micrófono, necesitas conceder permisos en tu navegador.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result: any) => result.transcript)
        .join('');
      setInputValue(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  const toggleCall = async () => {
    if (isCalling) {
      if (liveSessionRef.current) {
        liveSessionRef.current.close();
        liveSessionRef.current = null;
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
      
      if (!liveAudioContextRef.current) {
        liveAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const audioCtx = liveAudioContextRef.current;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const historyText = messages.map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.text}`).join('\n\n');
      
      const session = await ai.live.connect({
        model: 'gemini-3.1-live-preview',
        config: {
          systemInstruction: {
            parts: [{ text: `Eres el asistente de la boda de Silvina y Luis. Habla en español de España.
Datos de invitados: ${JSON.stringify(guests)}
Historial previo de la conversación:
${historyText}
Continúa la conversación de forma natural por voz.` }]
          },
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: "Zephyr" }
              }
            }
          }
        }
      });

      liveSessionRef.current = session;
      setIsCalling(true);

      // Handle incoming audio
      session.on('content', (content: any) => {
        if (content.modelTurn?.parts) {
          content.modelTurn.parts.forEach((part: any) => {
            if (part.inlineData && part.inlineData.data) {
              const base64 = part.inlineData.data;
              const binary = atob(base64);
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
          });
        }
      });

      // Handle outgoing audio
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      source.connect(processor);
      processor.connect(audioCtx.destination);

      processor.onaudioprocess = (e) => {
        if (!isCalling || !liveSessionRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
        }
        const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
        liveSessionRef.current.send({
          realtimeInput: {
            mediaChunks: [{
              mimeType: "audio/pcm;rate=24000",
              data: base64
            }]
          }
        });
      };

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
        <Button 
          variant={isCalling ? "destructive" : "outline"} 
          size="sm" 
          onClick={toggleCall}
          className={`rounded-full gap-2 ${isCalling ? 'animate-pulse' : 'border-primary/30 text-primary hover:bg-primary/10'}`}
        >
          {isCalling ? <PhoneOff className="w-4 h-4" /> : <PhoneCall className="w-4 h-4" />}
          {isCalling ? 'Colgar' : 'Llamar'}
        </Button>
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
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                
                {msg.role === 'model' && (
                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 rounded-full bg-white/50 hover:bg-white"
                      onClick={() => togglePlay(msg.id, msg.audioBuffer)}
                      disabled={msg.isAudioLoading && !msg.audioBuffer}
                    >
                      {msg.isAudioLoading && !msg.audioBuffer ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : playingId === msg.id ? (
                        <Square className="w-3.5 h-3.5 mr-1.5 fill-current" />
                      ) : (
                        <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
                      )}
                      <span className="text-xs font-medium">
                        {msg.isAudioLoading && !msg.audioBuffer ? 'Cargando voz...' : playingId === msg.id ? 'Detener' : 'Escuchar'}
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
                    <Mic className="w-8 h-8 text-primary-foreground" />
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
            variant={isListening ? "destructive" : "secondary"}
            size="icon"
            className={`shrink-0 rounded-full ${isListening ? 'animate-pulse' : ''}`}
            onClick={toggleListening}
            disabled={isCalling}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
          
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={isCalling ? "Llamada en curso..." : isListening ? "Escuchando..." : "Pregunta sobre los invitados..."}
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
