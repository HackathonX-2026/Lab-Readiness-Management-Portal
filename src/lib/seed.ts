import type { Lab } from '../types';
import { SHEET_LABS } from './seedData';

export function seedLabs(): Lab[] {
  return SHEET_LABS.map(l => ({ ...l }));
}
