import { Redirect } from 'expo-router';

// Becomes the session-based redirect (login vs. app) in Phase 4.
export default function Index() {
  return <Redirect href="/login" />;
}
