import { Redirect } from 'expo-router';

import { useAuthStore } from '@/store/authStore';

export default function Index() {
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  return <Redirect href={signedIn ? '/home' : '/login'} />;
}
