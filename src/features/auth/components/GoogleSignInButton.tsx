import { Alert } from 'react-native';

import { GoogleIcon } from '@/components/brand/GoogleIcon';
import { Button } from '@/components/ui/Button';

import { authService } from '../auth.service';
import { useAsyncAction } from '../hooks/useAsyncAction';

/** "Continue with Google". On success the root auth gate opens the app. */
export function GoogleSignInButton() {
  const google = useAsyncAction(authService.signInWithGoogle);

  return (
    <Button
      variant="secondary"
      label="Continue with Google"
      labelWeight="medium"
      leading={<GoogleIcon />}
      loading={google.pending}
      onPress={async () => {
        const { error } = await google.run();
        // No form field to attach this to, so show it as an alert.
        if (error) Alert.alert('Google sign-in', error);
      }}
    />
  );
}
