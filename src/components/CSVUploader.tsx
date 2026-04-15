import React, { useCallback } from 'react';
import Papa from 'papaparse';
import { UploadCloud } from 'lucide-react';
import { Guest, Companion } from '../types';
import { Card, CardContent } from './ui/card';

interface CSVUploaderProps {
  onUpload: (guests: Guest[]) => void;
}

export function CSVUploader({ onUpload }: CSVUploaderProps) {
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedGuests: Guest[] = results.data.map((row: any, index: number) => {
          const companions: Companion[] = [];
          
          // Check for companion 1
          if (row['AcompaÃ±Ante 1 Nombre'] || row['Acompañante 1 Nombre']) {
            companions.push({
              name: row['AcompaÃ±Ante 1 Nombre'] || row['Acompañante 1 Nombre'] || '',
              allergies: row['AcompaÃ±Ante 1 Alergias'] || row['Acompañante 1 Alergias'] || '',
              isChild: false, // Not in example for comp 1, but let's default
              shoeSize: row['AcompaÃ±Ante 1 Talla Calzado'] || row['Acompañante 1 Talla Calzado'] || '',
            });
          }

          // Check for companion 2
          if (row['AcompaÃ±Ante 2 Nombre'] || row['Acompañante 2 Nombre']) {
            companions.push({
              name: row['AcompaÃ±Ante 2 Nombre'] || row['Acompañante 2 Nombre'] || '',
              allergies: row['AcompaÃ±Ante 2 Alergias'] || row['Acompañante 2 Alergias'] || '',
              isChild: (row['AcompaÃ±Ante 2 Es NiÃ±O'] || row['Acompañante 2 Es Niño']) === 'on',
              shoeSize: '', // Not in example for comp 2
            });
          }

          return {
            id: `guest-${index}`,
            submittedAt: row['Submitted At'] || '',
            name: row['Nombre'] || '',
            phone: row['Telefono'] || row['Teléfono'] || '',
            attendance: row['Asistencia'] || '',
            shoeSize: row['Talla Calzado'] || '',
            allergies: row['Alergias'] || '',
            suggestedSong: row['Cancion Sugerida'] || row['Canción Sugerida'] || '',
            companions,
          };
        });

        onUpload(parsedGuests);
      },
    });
  }, [onUpload]);

  return (
    <Card className="w-full max-w-md mx-auto border-dashed border-2 border-primary/50 bg-secondary/30">
      <CardContent className="flex flex-col items-center justify-center p-10 text-center">
        <UploadCloud className="w-12 h-12 text-primary mb-4" />
        <h3 className="text-xl font-serif font-semibold mb-2 text-foreground">Sube tu lista de invitados</h3>
        <p className="text-sm text-muted-foreground mb-6">Sube el archivo CSV exportado del formulario</p>
        <label className="cursor-pointer bg-primary text-primary-foreground px-6 py-3 rounded-full font-medium hover:bg-primary/90 transition-colors">
          Seleccionar Archivo
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileUpload}
          />
        </label>
      </CardContent>
    </Card>
  );
}
