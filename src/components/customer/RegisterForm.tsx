'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { EnvelopeIcon, LockClosedIcon, UserIcon, PhoneIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { isValidEmail, isValidPassword } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { RegisterForm as RegisterFormType } from '@/types';

const registerSchema = yup.object({
  firstName: yup
    .string()
    .required('First name is required')
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name cannot exceed 50 characters'),
  lastName: yup
    .string()
    .required('Last name is required')
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name cannot exceed 50 characters'),
  email: yup
    .string()
    .required('Email is required')
    .email('Please enter a valid email address'),
  phone: yup
    .string()
    .matches(/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number')
    .optional(),
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters long')
    .test('password-strength', 'Password must contain uppercase, lowercase, number, and special character', (value) => {
      if (!value) return false;
      const validation = isValidPassword(value);
      return validation.isValid;
    }),
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('password')], 'Passwords must match'),
});

interface RegisterFormProps {
  onSuccess?: () => void;
  onToggleMode?: () => void;
}

export default function RegisterForm({ onSuccess, onToggleMode }: RegisterFormProps) {
  const { register: registerUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<RegisterFormType & { confirmPassword: string }>({
    resolver: yupResolver(registerSchema),
  });

  const password = watch('password');

  const onSubmit = async (data: RegisterFormType & { confirmPassword: string }) => {
    setIsLoading(true);
    setError(null);

    try {
      const { confirmPassword, ...userData } = data;
      const result = await registerUser(userData);

      if (result.success) {
        onSuccess?.();
      } else {
        setError(result.error || 'Registration failed. Please try again.');
      }
    } catch (error) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrength = (password: string) => {
    if (!password) return { strength: 0, text: '', color: '' };

    const validation = isValidPassword(password);
    const errorsLength = validation.errors.length;
    const totalChecks = 5; // total password requirements

    const strength = Math.max(0, (totalChecks - errorsLength) / totalChecks * 100);

    let text = '';
    let color = '';

    if (strength <= 20) {
      text = 'Very weak';
      color = 'text-red-600';
    } else if (strength <= 40) {
      text = 'Weak';
      color = 'text-orange-600';
    } else if (strength <= 60) {
      text = 'Fair';
      color = 'text-yellow-600';
    } else if (strength <= 80) {
      text = 'Good';
      color = 'text-blue-600';
    } else {
      text = 'Strong';
      color = 'text-green-600';
    }

    return { strength, text, color };
  };

  const passwordStrength = getPasswordStrength(password);

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Create your account</h2>
        <p className="mt-2 text-gray-600">Join us to start ordering</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input
            id="firstName"
            type="text"
            label="First name"
            placeholder="John"
            leftIcon={<UserIcon className="h-5 w-5" />}
            error={errors.firstName?.message}
            {...register('firstName')}
            disabled={isLoading}
          />

          <Input
            id="lastName"
            type="text"
            label="Last name"
            placeholder="Doe"
            leftIcon={<UserIcon className="h-5 w-5" />}
            error={errors.lastName?.message}
            {...register('lastName')}
            disabled={isLoading}
          />
        </div>

        <Input
          id="email"
          type="email"
          label="Email address"
          placeholder="john.doe@example.com"
          leftIcon={<EnvelopeIcon className="h-5 w-5" />}
          error={errors.email?.message}
          {...register('email')}
          disabled={isLoading}
        />

        <Input
          id="phone"
          type="tel"
          label="Phone number (optional)"
          placeholder="+1234567890"
          leftIcon={<PhoneIcon className="h-5 w-5" />}
          error={errors.phone?.message}
          helperText="For order updates and confirmations"
          {...register('phone')}
          disabled={isLoading}
        />

        <div>
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            label="Password"
            placeholder="Create a strong password"
            leftIcon={<LockClosedIcon className="h-5 w-5" />}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </button>
            }
            error={errors.password?.message}
            {...register('password')}
            disabled={isLoading}
          />

          {password && (
            <div className="mt-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-600">Password strength:</span>
                <span className={`text-xs font-medium ${passwordStrength.color}`}>
                  {passwordStrength.text}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    passwordStrength.strength <= 40 ? 'bg-red-500' :
                    passwordStrength.strength <= 60 ? 'bg-yellow-500' :
                    passwordStrength.strength <= 80 ? 'bg-blue-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${passwordStrength.strength}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Password must contain:
                <ul className="mt-1 space-y-1">
                  <li className={password.length >= 8 ? 'text-green-600' : 'text-gray-400'}>
                    ✓ At least 8 characters
                  </li>
                  <li className={/[A-Z]/.test(password) ? 'text-green-600' : 'text-gray-400'}>
                    ✓ One uppercase letter
                  </li>
                  <li className={/[a-z]/.test(password) ? 'text-green-600' : 'text-gray-400'}>
                    ✓ One lowercase letter
                  </li>
                  <li className={/[0-9]/.test(password) ? 'text-green-600' : 'text-gray-400'}>
                    ✓ One number
                  </li>
                  <li className={/[!@#$%^&*(),.?":{}|<>]/.test(password) ? 'text-green-600' : 'text-gray-400'}>
                    ✓ One special character
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <Input
          id="confirmPassword"
          type={showConfirmPassword ? 'text' : 'password'}
          label="Confirm password"
          placeholder="Enter your password again"
          leftIcon={<LockClosedIcon className="h-5 w-5" />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              {showConfirmPassword ? (
                <EyeSlashIcon className="h-5 w-5" />
              ) : (
                <EyeIcon className="h-5 w-5" />
              )}
            </button>
          }
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
          disabled={isLoading}
        />

        <Button
          type="submit"
          className="w-full"
          loading={isLoading}
          disabled={isLoading}
        >
          Create account
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onToggleMode}
            className="font-medium text-primary hover:text-primary/600 focus:outline-none"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}