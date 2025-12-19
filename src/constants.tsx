
import { TimelineEvent, Category } from './types';

// Approximate Universe Age: 13.8 billion years
export const UNIVERSE_AGE_YEARS = 13_800_000_000;

// Reference for Jesus' birth (Year 0)
export const YEAR_ZERO_FROM_BANG = 13_800_000_000;

export const INITIAL_CATEGORIES: Category[] = [
  { name: 'Cosmic', emoji: '🌌' },
  { name: 'Biological', emoji: '🌿' },
  { name: 'Human History', emoji: '📜' },
  { name: 'Modern Era', emoji: '⚡' },
  { name: 'Speculative Future', emoji: '🔮' }
];

export const INITIAL_EVENTS: TimelineEvent[] = [
  {
    id: '1',
    title: 'The Big Bang',
    description: 'The universe begins as a hot, dense point.',
    yearsFromStart: 0,
    category: 'Cosmic',
    importance: 10,
    color: '#ef4444',
    icon: '💥'
  },
  {
    id: '2',
    title: 'First Stars Form',
    description: 'Protostars ignite from collapsing hydrogen clouds.',
    yearsFromStart: 200_000_000,
    category: 'Cosmic',
    importance: 8,
    color: '#f59e0b',
    icon: '🌟'
  },
  {
    id: '4',
    title: 'Solar System & Earth',
    description: 'The Sun and its planets coalesce from a solar nebula.',
    yearsFromStart: 9_300_000_000,
    category: 'Cosmic',
    importance: 9,
    color: '#10b981',
    icon: '🌍'
  },
  {
    id: '5',
    title: 'Life on Earth',
    description: 'Earliest chemical signatures of life (microbial).',
    yearsFromStart: 10_000_000_000,
    category: 'Biological',
    importance: 9,
    color: '#84cc16',
    icon: '🦠'
  },
  {
    id: '8',
    title: 'Dinosaur Extinction',
    description: 'Chicxulub asteroid impact leads to mass extinction.',
    yearsFromStart: 13_734_000_000,
    category: 'Biological',
    importance: 8,
    color: '#dc2626',
    icon: '☄️'
  },
  {
    id: 'h1',
    title: 'Ancient Mesopotamia',
    description: 'Rise of Sumerian city-states and cuneiform script.',
    yearsFromStart: YEAR_ZERO_FROM_BANG - 4000,
    endYearsFromStart: YEAR_ZERO_FROM_BANG - 1750,
    category: 'Human History',
    importance: 8,
    color: '#f59e0b',
    icon: '📜'
  },
  {
    id: 'h2',
    title: 'Old Kingdom Egypt',
    description: 'The age of the great pyramid builders.',
    yearsFromStart: YEAR_ZERO_FROM_BANG - 2686,
    endYearsFromStart: YEAR_ZERO_FROM_BANG - 2181,
    category: 'Human History',
    importance: 7,
    color: '#f59e0b',
    icon: '📐'
  },
  {
    id: 'h3',
    title: 'The Roman Empire',
    description: 'Peak of Roman power and influence.',
    yearsFromStart: YEAR_ZERO_FROM_BANG - 27,
    endYearsFromStart: YEAR_ZERO_FROM_BANG + 476,
    category: 'Human History',
    importance: 9,
    color: '#f59e0b',
    icon: '🏛️'
  },
  {
    id: 'h4',
    title: 'The Renaissance',
    description: 'A fervent period of European cultural, artistic, and scientific "rebirth".',
    yearsFromStart: YEAR_ZERO_FROM_BANG + 1400,
    endYearsFromStart: YEAR_ZERO_FROM_BANG + 1600,
    category: 'Human History',
    importance: 8,
    color: '#f59e0b',
    icon: '🎨'
  },
  {
    id: 'h5',
    title: 'Industrial Revolution',
    description: 'The transition to new manufacturing processes.',
    yearsFromStart: YEAR_ZERO_FROM_BANG + 1760,
    endYearsFromStart: YEAR_ZERO_FROM_BANG + 1840,
    category: 'Modern Era',
    importance: 9,
    color: '#ffffff',
    icon: '⚙️'
  },
  {
    id: 'h6',
    title: 'The Space Age',
    description: 'From Sputnik to the Moon landing and beyond.',
    yearsFromStart: YEAR_ZERO_FROM_BANG + 1957,
    endYearsFromStart: YEAR_ZERO_FROM_BANG + 2025,
    category: 'Modern Era',
    importance: 10,
    color: '#ffffff',
    icon: '🚀'
  },
  {
    id: '11',
    title: 'Present Day',
    description: 'The modern era of information and exploration.',
    yearsFromStart: UNIVERSE_AGE_YEARS,
    category: 'Modern Era',
    importance: 10,
    color: '#ffffff',
    icon: '📱'
  },
  {
    id: '12',
    title: 'Future Cosmic Expansion',
    description: 'Predicting the fate of the universe.',
    yearsFromStart: 18_800_000_000,
    category: 'Speculative Future',
    importance: 9,
    color: '#ef4444',
    icon: '☀️'
  }
];
