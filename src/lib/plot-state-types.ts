export interface PlotNode {
  id: string;
  content: string;
  status: "pending" | "active" | "completed" | "skipped";
  order: number;
  activatedAt?: string;
  completedAt?: string;
}

export interface PlotLine {
  id: string;
  title: string;
  nodes: PlotNode[];
  status: "active" | "archived";
  createdAt: string;
}

export interface PlotState {
  plotLines: PlotLine[];
  lastAnalyzedAt: string;
  lastGeneratedAt: string;
}

export function getDefaultPlotState(): PlotState {
  return {
    plotLines: [],
    lastAnalyzedAt: "",
    lastGeneratedAt: "",
  };
}
