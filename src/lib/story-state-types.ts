export interface LifeEvent {
  date: string;              // "2024年9月" 或 ISO "2024-09-15"
  description: string;       // "升职为技术经理"
  cause: string;             // "周远山在裁员后推荐了他"
  effect: string;            // "开始承担管理职责，与林薇薇产生摩擦"
  relatedCharacters: string[]; // ["周远山", "林薇薇"]
}

export interface CharacterInfo {
  name: string;
  alias: string;
  avatar: string;       // filename: "default" or "abc123.png"
  persona: string;
  appearance: string;
  preferences: string;
  background: string;
  lifeEvents: LifeEvent[];
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
