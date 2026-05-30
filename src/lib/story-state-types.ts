export interface CharacterInfo {
  name: string;
  alias: string;
  avatar: string;       // filename: "default" or "abc123.png"
  persona: string;
  appearance: string;
  preferences: string;
  background: string;
}

export interface StorySetting {
  id: string;
  key: string;          // 设定名称，如 "灵力体系"
  value: string;        // 设定内容
  category: string;     // 分类：世界观、人物关系、历史事件、规则体系 等
}

export interface StoryState {
  characters: CharacterInfo[];
  protagonist: CharacterInfo | null;
  currentLocation: string;
  currentDate: string;
  currentTime: string;
  settings: StorySetting[];
  lastAnalyzedAt: string;
  analyzedMessageIndex: number;
}
