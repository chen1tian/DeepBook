export interface LocationNode {
  id: string;
  name: string;
  description: string;
  firstVisitedAt: string;
  lastVisitedAt: string;
}

export interface LocationConnection {
  from: string;       // location id
  to: string;         // location id
  description: string; // e.g., "步行10分钟", "乘坐电梯到1楼"
}

export interface LocationNetwork {
  nodes: LocationNode[];
  connections: LocationConnection[];
  currentNodeId: string | null;
  lastAnalyzedAt: string;
}
