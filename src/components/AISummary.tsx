import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Guest } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Sparkles, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AISummaryProps {
  guests: Guest[];
}

export function AISummary({ guests }: AISummaryProps) {
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const generateSummary = async () => {
      if (guests.length === 0) return;
      
      setLoading(true);
      setError('');
      
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        const prompt = `
          Eres un asistente de planificación de bodas. Aquí tienes una lista de invitados a una boda en formato JSON.
          Por favor, genera un resumen útil para los novios. Incluye:
          - Número total de invitados confirmados (incluyendo acompañantes).
          - Número de niños.
          - Un resumen de las alergias y restricciones alimentarias importantes a tener en cuenta para el catering.
          - Algunas de las canciones sugeridas más destacadas.
          
          Hazlo con un tono alegre, elegante y organizado. Usa formato Markdown.
          
          Datos de invitados:
          ${JSON.stringify(guests, null, 2)}
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

  if (guests.length === 0) return null;

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-secondary border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="font-serif text-2xl flex items-center gap-2 text-primary">
          <Sparkles className="w-5 h-5" />
          Resumen Inteligente
        </CardTitle>
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
