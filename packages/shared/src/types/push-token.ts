export interface PushToken {
  id: string;
  user_id: string;
  expo_push_token: string;
  platform: 'ios' | 'android';
  updated_at: string;
}
