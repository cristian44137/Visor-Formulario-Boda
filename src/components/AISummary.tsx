import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Guest } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Sparkles, Loader2, Volume2, Square } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AISummaryProps {
  guests: Guest[];
}

export function AISummary({ guests }: AISummaryProps) {
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isAudioLoading, setIsAudioLoading] = useState<boolean>(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    const generateSummary = async () => {
      if (guests.length === 0) return;
      
      setLoading(true);
      setError('');
      
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        const prompt = `
          Eres un asistente de bodas. Genera un resumen MUY conciso, estructurado y fácil de leer de esta lista de invitados.
          Usa viñetas y negritas. No te enrolles. Incluye solo:
          - Total confirmados (incluyendo acompañantes).
          - Total de niños.
          - Alergias/restricciones clave a tener en cuenta.
          - Canciones destacadas sugeridas.
          
          Datos:
          ${JSON.stringify(guests)}
        `;

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
        });

        if (response.text) {
          setSummary(response.text);
        } else {
          setError('No se pudo generar el resumen.');
        }
      } catch (err) {
        console.error(err);
        setError('Error al conectar con la IA. Asegúrate de tener configurada la API KEY.');
      } finally {
        setLoading(false);
      }
    };

    generateSummary();
  }, [guests]);

  const toggleSpeech = async () => {
    if (isPlaying) {
      if (audioSourceRef.current) {
        try { audioSourceRef.current.stop(); } catch (e) {}
        audioSourceRef.current.disconnect();
      }
      setIsPlaying(false);
      return;
    }

    try {
      setIsAudioLoading(true);
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Clean up markdown before speaking
      const cleanText = summary.replace(/[*#_]/g, '');
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: `Lee este texto con voz natural en español de España:\n\n${cleanText}`,
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Zephyr"
              }
            }
          }
        }
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (!base64Audio) {
        throw new Error("No se recibió audio de Gemini");
      }

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
        // Try decoding as WAV/MP3 first
        audioBuffer = await audioContextRef.current.decodeAudioData(bytes.buffer.slice(0));
      } catch (e) {
        // Fallback to raw PCM 16-bit little-endian
        const pcmData = new Int16Array(bytes.buffer);
        audioBuffer = audioContextRef.current.createBuffer(1, pcmData.length, 24000);
        const channelData = audioBuffer.getChannelData(0);
        for (let i = 0; i < pcmData.length; i++) {
          channelData[i] = pcmData[i] / 32768.0;
        }
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => {
        setIsPlaying(false);
      };

      audioSourceRef.current = source;
      source.start();
      setIsPlaying(true);
    } catch (err) {
      console.error("Error generating audio:", err);
      alert("Hubo un error al generar el audio con Gemini.");
    } finally {
      setIsAudioLoading(false);
    }
  };

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      if (audioSourceRef.current) {
        try { audioSourceRef.current.stop(); } catch (e) {}
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  if (guests.length === 0) return null;

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-secondary border-primary/20">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="font-serif text-2xl flex items-center gap-2 text-primary">
          <Sparkles className="w-5 h-5" />
          Resumen Inteligente
        </CardTitle>
        {summary && !loading && !error && (
          <button
            onClick={toggleSpeech}
            disabled={isAudioLoading}
            className={`p-2 rounded-full transition-colors ${isAudioLoading ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
            title={isPlaying ? "Detener" : "Escuchar en voz alta"}
          >
            {isAudioLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isPlaying ? <Square className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Analizando la lista de invitados...
          </div>
        ) : error ? (
          <div className="text-destructive py-4">{error}</div>
        ) : (
          <div className="prose prose-sm md:prose-base prose-p:leading-relaxed prose-headings:font-serif prose-headings:text-primary max-w-none">
            <ReactMarkdown>{summary}</ReactMarkdown>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
