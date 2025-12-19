
export interface Category {
  name: string;
  emoji: string;
}

export interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  // Years from Big Bang (0 = Big Bang, ~13.8B = Year 0 BC/AD)
  yearsFromStart: number;
  endYearsFromStart?: number; // Optional end of range
  category: string; // Refers to Category.name
  importance: number; // 1-10 (10 being most important)
  color?: string;
  icon?: string; // Emoji
}

export interface ViewportState {
  startYear: number;
  zoom: number; // Pixels per year
}
