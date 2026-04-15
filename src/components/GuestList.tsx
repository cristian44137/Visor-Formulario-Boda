import React, { useState, useMemo } from 'react';
import { Guest } from '../types';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Search, Users, Music, Utensils, Phone, CheckCircle2, XCircle, HelpCircle, Footprints } from 'lucide-react';

interface GuestListProps {
  guests: Guest[];
}

export function GuestList({ guests }: GuestListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showOnlyAllergies, setShowOnlyAllergies] = useState(false);

  const filteredGuests = useMemo(() => {
    return guests.filter((guest) => {
      const matchesSearch = guest.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            guest.companions.some(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
      
      let matchesStatus = true;
      if (filterStatus === 'attending') {
        matchesStatus = guest.attendance.toLowerCase().includes('sí') || guest.attendance.toLowerCase().includes('si');
      } else if (filterStatus === 'not_attending') {
        matchesStatus = guest.attendance.toLowerCase().includes('no');
      }

      let matchesAllergies = true;
      if (showOnlyAllergies) {
        matchesAllergies = !!guest.allergies || guest.companions.some(c => !!c.allergies);
      }

      return matchesSearch && matchesStatus && matchesAllergies;
    });
  }, [guests, searchQuery, filterStatus, showOnlyAllergies]);

  const getStatusBadge = (attendance: string) => {
    const text = attendance.toLowerCase();
    if (text.includes('sí') || text.includes('si')) {
      return <Badge className="bg-green-600/10 text-green-700 border-green-200 hover:bg-green-600/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Asistirá</Badge>;
    }
    if (text.includes('no')) {
      return <Badge className="bg-red-600/10 text-red-700 border-red-200 hover:bg-red-600/20"><XCircle className="w-3 h-3 mr-1" /> No asistirá</Badge>;
    }
    return <Badge variant="outline" className="text-muted-foreground"><HelpCircle className="w-3 h-3 mr-1" /> Pendiente</Badge>;
  };

  const stats = useMemo(() => {
    let totalAttending = 0;
    let totalNotAttending = 0;
    let totalChildren = 0;

    guests.forEach(g => {
      const text = g.attendance.toLowerCase();
      if (text.includes('sí') || text.includes('si')) {
        totalAttending++; // Main guest
        totalAttending += g.companions.length; // Companions
        totalChildren += g.companions.filter(c => c.isChild).length;
      } else if (text.includes('no')) {
        totalNotAttending++;
      }
    });

    return { totalAttending, totalNotAttending, totalChildren };
  }, [guests]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4 mb-2">
        <Card className="bg-primary/5 border-primary/10 shadow-sm">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-serif text-primary mb-1">{stats.totalAttending}</span>
            <span className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-medium">Asistentes</span>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/10 shadow-sm">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-serif text-primary mb-1">{stats.totalChildren}</span>
            <span className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-medium">Niños</span>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/10 shadow-sm">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-serif text-primary mb-1">{stats.totalNotAttending}</span>
            <span className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-medium">No Asistirán</span>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar invitado o acompañante..." 
            className="pl-9 bg-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-[160px] bg-white">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="attending">Asistirán</SelectItem>
              <SelectItem value="not_attending">No asistirán</SelectItem>
            </SelectContent>
          </Select>
          <button
            onClick={() => setShowOnlyAllergies(!showOnlyAllergies)}
            className={`px-3 py-2 rounded-md border text-sm font-medium transition-colors flex items-center gap-2 shrink-0 ${
              showOnlyAllergies 
                ? 'bg-primary text-primary-foreground border-primary' 
                : 'bg-white text-muted-foreground border-input hover:bg-muted'
            }`}
            title="Filtrar invitados con alergias"
          >
            <Utensils className="w-4 h-4" />
            <span className="hidden sm:inline">Alergias</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGuests.map((guest) => (
          <Card key={guest.id} className="overflow-hidden border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <div className="h-2 bg-primary/20 w-full"></div>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start gap-2">
                <CardTitle className="font-serif text-2xl leading-tight">{guest.name || 'Sin nombre'}</CardTitle>
                {getStatusBadge(guest.attendance)}
              </div>
              {guest.phone && (
                <div className="flex items-center text-sm text-muted-foreground mt-1">
                  <Phone className="w-3 h-3 mr-1.5" />
                  {guest.phone}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {guest.allergies && (
                <div className="flex items-start gap-2">
                  <Utensils className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground block mb-0.5">Alergias / Preferencias</span>
                    <span className="text-foreground">{guest.allergies}</span>
                  </div>
                </div>
              )}

              {guest.shoeSize && (
                <div className="flex items-start gap-2">
                  <Footprints className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground block mb-0.5">Talla de Calzado</span>
                    <span className="text-foreground">{guest.shoeSize}</span>
                  </div>
                </div>
              )}

              {guest.suggestedSong && (
                <div className="flex items-start gap-2">
                  <Music className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground block mb-0.5">Canción Sugerida</span>
                    <span className="text-foreground italic">"{guest.suggestedSong}"</span>
                  </div>
                </div>
              )}

              {guest.companions.length > 0 && (
                <div className="pt-3 border-t border-border/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Acompañantes ({guest.companions.length})</span>
                  </div>
                  <div className="space-y-3">
                    {guest.companions.map((comp, idx) => (
                      <div key={idx} className="pl-6 border-l-2 border-primary/20">
                        <div className="font-medium flex items-center gap-2">
                          {comp.name}
                          {comp.isChild && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">Niño/a</Badge>}
                        </div>
                        {comp.allergies && (
                          <div className="flex items-start gap-1.5 mt-1.5">
                            <Utensils className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                            <div className="text-muted-foreground text-xs">
                              <span className="font-medium text-foreground">Alergias:</span> {comp.allergies}
                            </div>
                          </div>
                        )}
                        {comp.shoeSize && (
                          <div className="flex items-start gap-1.5 mt-1.5">
                            <Footprints className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                            <div className="text-muted-foreground text-xs">
                              <span className="font-medium text-foreground">Calzado:</span> {comp.shoeSize}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {filteredGuests.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No se encontraron invitados que coincidan con la búsqueda.
          </div>
        )}
      </div>
    </div>
  );
}
