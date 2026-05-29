export interface CharacterInfo {
  name: string;
  alias: string;
  avatar: string;       // filename: "default" or "abc123.png"
  persona: string;
  appearance: string;
  preferences: string;
  background: string;
}

export interface StoryState {
  characters: CharacterInfo[];
  protagonist: CharacterInfo | null;
  currentLocation: string;
  currentDate: string;
  currentTime: string;
  lastAnalyzedAt: string;
  analyzedMessageIndex: number;
}
