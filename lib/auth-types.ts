export interface AuthUser {
  id: string;
  email: string;
  is_active: boolean;
}

export interface UserProfile {
  id: number;
  user_id: string;
  full_name: string;
  user_role: string;
  institution: string | null;
  bio: string | null;
  experience_level: string;
  preferred_sdk: string;
  learning_goal: string | null;
  avatar_url: string | null;
  xp: number;
  last_visited_path?: string | null;
  updated_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface LearningProgress {
  module_id: string;
  progress: number;
  quiz_score: number | null;
  completed: boolean;
  completed_lessons: string[];
  updated_at: string;
}

export interface CloudProject {
  id: string;
  name: string;
  circuit_json: any;
  sdk: string;
  created_at: string;
  updated_at: string;
}
