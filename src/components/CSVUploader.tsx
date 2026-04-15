import React, { useCallback, useState, useRef } from 'react';
import Papa from 'papaparse';
import { UploadCloud } from 'lucide-react';
import { Guest, Companion } from '../types';
import { Card, CardContent } from './ui/card';

interface CSVUploaderProps {
  onUpload: (guests: Guest[]) => void;
}

export function CSVUploader({ onUpload }: CSVUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
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
              shoeSize: row['AcompaÃ±Ante 2 Talla Calzado'] || row['Acompañante 2 Talla Calzado'] || '',
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
        }).filter((guest: Guest) => guest.name || guest.attendance); // Filter out completely empty rows

        if (parsedGuests.length === 0) {
          alert("El archivo CSV parece estar vacío o no tiene el formato esperado.");
          return;
        }

        onUpload(parsedGuests);
      },
      error: (error) => {
        console.error("Error parsing CSV:", error);
        alert("Hubo un error al leer el archivo CSV.");
      }
    });
  };

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processFile(file);
    // Reset input so the same file can be uploaded again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onUpload]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
      processFile(file);
    } else {
      alert("Por favor, sube un archivo CSV válido.");
    }
  }, [onUpload]);

  return (
    <Card 
      className={`w-full max-w-md mx-auto border-dashed border-2 transition-colors ${
        isDragging ? 'border-primary bg-primary/10' : 'border-primary/50 bg-secondary/30'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CardContent className="flex flex-col items-center justify-center p-10 text-center">
        <UploadCloud className={`w-12 h-12 mb-4 transition-colors ${isDragging ? 'text-primary' : 'text-primary/70'}`} />
        <h3 className="text-xl font-serif font-semibold mb-2 text-foreground">Sube tu lista de invitados</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Arrastra y suelta tu archivo CSV aquí, o haz clic para seleccionarlo
        </p>
        <label htmlFor="csv-upload" className="cursor-pointer bg-primary text-primary-foreground px-6 py-3 rounded-full font-medium hover:bg-primary/90 transition-colors">
          Seleccionar Archivo
          <input
            id="csv-upload"
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileUpload}
          />
        </label>
      </CardContent>
    </Card>
  );
}
