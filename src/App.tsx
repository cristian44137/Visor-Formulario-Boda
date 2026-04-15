/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Guest } from './types';
import { CSVUploader } from './components/CSVUploader';
import { GuestList } from './components/GuestList';
import { AISummary } from './components/AISummary';
import { VoiceAssistant } from './components/VoiceAssistant';
import { Heart } from 'lucide-react';

export default function App() {
  const [guests, setGuests] = useState<Guest[]>([]);

  const handleUpload = (parsedGuests: Guest[]) => {
    setGuests(parsedGuests);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20 selection:text-primary">
      {/* Header */}
      <header className="py-16 px-4 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background -z-10"></div>
        
        {/* Decorative elements */}
        <div className="absolute top-10 left-10 opacity-20 pointer-events-none hidden md:block">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
            <path d="M12 2v20M2 12h20" />
            <path d="M4.929 4.929l14.142 14.142M4.929 19.071L19.071 4.929" />
          </svg>
        </div>
        <div className="absolute bottom-10 right-10 opacity-20 pointer-events-none hidden md:block">
          <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        </div>

        <div className="container max-w-4xl mx-auto relative z-10">
          <Heart className="w-8 h-8 text-primary mx-auto mb-6 opacity-80" />
          <h1 className="text-5xl md:text-7xl font-serif font-medium tracking-tight text-foreground mb-6">
            Boda Silvina y Luis
          </h1>
          <p className="text-lg md:text-xl text-primary uppercase tracking-[0.3em] font-medium">
            R. S. V. P
          </p>
          <div className="w-24 h-px bg-primary/40 mx-auto mt-10"></div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-6xl mx-auto px-4 pb-24 space-y-12">
        {guests.length === 0 ? (
          <div className="py-12">
            <CSVUploader onUpload={handleUpload} />
          </div>
        ) : (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-center border-b border-border/50 pb-4">
              <h2 className="text-2xl font-serif font-medium">
                Total de Invitados: <span className="text-primary">{guests.length}</span>
              </h2>
              <button 
                onClick={() => setGuests([])}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
              >
                Subir otro archivo
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <GuestList guests={guests} />
              </div>
              <div className="space-y-8">
                <AISummary guests={guests} />
                <VoiceAssistant guests={guests} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
