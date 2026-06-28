export interface PushToken {
  id: string;
  user_id: string;
  expo_push_token: string;
  platform: 'ios' | 'android';
  timezone?: string | null;
  updated_at: string;
}
