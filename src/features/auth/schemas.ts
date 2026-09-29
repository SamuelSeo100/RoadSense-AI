import { z } from 'zod';

import { CITIES } from '@/constants/cities';
import { ROUTE_PRIORITIES } from '@/constants/routePriorities';
import { TRANSIT_MODES } from '@/constants/transitModes';

/** Indian mobile: 10 digits, starting 6–9 (no +91). */
export const indianMobileSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');

export const emailLoginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});
export type EmailLoginValues = z.infer<typeof emailLoginSchema>;

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name'),
    // Optional until phone verification exists; stored on the profile.
    phone: z.union([z.literal(''), indianMobileSchema]),
    email: z.email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .regex(/[A-Za-z]/, 'Include at least one letter')
      .regex(/\d/, 'Include at least one number'),
    confirmPassword: z.string().min(1, 'Re-enter your password'),
    preferredModes: z.array(z.enum(TRANSIT_MODES)).min(1, 'Pick at least one way you travel'),
    priority: z.enum(ROUTE_PRIORITIES, { error: 'Pick what matters most to you' }),
    city: z.enum(CITIES),
    acceptTerms: z.boolean().refine((v) => v, 'Please accept the Terms & Privacy Policy'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords don’t match',
    // Check as soon as both password fields are filled, even if other fields are still invalid.
    when: ({ value }) => {
      const v = value as { password?: unknown; confirmPassword?: unknown };
      return (
        typeof v.password === 'string' &&
        typeof v.confirmPassword === 'string' &&
        v.confirmPassword !== ''
      );
    },
  });
/** Form state (before validation) vs. validated output. */
export type SignupFormInput = z.input<typeof signupSchema>;
export type SignupValues = z.output<typeof signupSchema>;
