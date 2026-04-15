export interface Companion {
  name: string;
  allergies: string;
  isChild: boolean;
  shoeSize: string;
}

export interface Guest {
  id: string;
  submittedAt: string;
  name: string;
  phone: string;
  attendance: string;
  shoeSize: string;
  allergies: string;
  suggestedSong: string;
  companions: Companion[];
}
