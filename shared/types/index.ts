/**
 * Shared types between frontend and backend.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Hotspot {
  id: string;
  title: string;
  description?: string;
  lat: number;
  lng: number;
  creator_id?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
}

export interface CheckIn {
  id: string;
  user_id: string;
  hotspot_id: string;
  checked_in_at: string;
  xp_awarded: number;
  was_first_visit: boolean;
  was_daily_discovery: boolean;
}

export interface CheckInResult {
  xp_awarded: number;
  new_xp: number;
  new_level: number;
  was_first_visit: boolean;
  was_daily_discovery: boolean;
  distance_m: number;
}

export interface Profile {
  id: string;
  email: string;
  full_name?: string | null;
  xp: number;
  level: number;
}

export interface UserRepo {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  readme_excerpt: string | null;
}

export interface Mood {
  text: string;
}

export interface RankedHotspot {
  hotspot_id: string;
  score: number;
  reason: string;
}

export interface GameCard {
  id: string;
  name: string;
  description: string;
  is_real: boolean;
}

export interface GamePayload {
  cards: GameCard[];
  target_user_id: string;
}

export interface GameResult {
  user_a_pick?: string;
  user_b_pick?: string;
  user_a_correct?: boolean;
  user_b_correct?: boolean;
}

export interface Encounter {
  id: string;
  hotspot_id: string;
  user_a: string;
  user_b: string;
  game_payload?: GamePayload | null;
  game_result?: GameResult | null;
  icebreaker?: string | null;
  user_a_met: boolean;
  user_b_met: boolean;
  xp_awarded: number;
  created_at: string;
}
